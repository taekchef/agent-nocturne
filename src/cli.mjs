import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { loadConfig, writeDefaultConfigIfMissing } from "./config.mjs";
import { createBackend } from "./backends/index.mjs";
import { runDaemon } from "./daemon.mjs";
import { appendLog } from "./logger.mjs";
import { configPath, createEvent, DEFAULT_TTL_MS, KNOWN_EVENTS, logPath, socketPath } from "./protocol.mjs";

const CONNECT_TIMEOUT_MS = 350;
const START_TIMEOUT_MS = 1200;
const PACKAGE_VERSION = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8")).version;

export async function main(args) {
  const [command, ...rest] = args;

  switch (command) {
    case "notify":
      return notify(rest);
    case "status":
      return status(rest);
    case "test":
      return testEffect(rest);
    case "restore":
      return restore(rest);
    case "config":
      return configCommand(rest);
    case "daemon":
      return daemonCommand(rest);
    case "version":
    case "--version":
    case "-V":
      console.log(PACKAGE_VERSION);
      return;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function notify(args) {
  const { positional, flags } = parseArgs(args);
  const eventName = positional[0];
  if (!eventName) throw new Error("notify requires an event");
  if (!KNOWN_EVENTS.has(eventName)) throw new Error(`Unknown event: ${eventName}`);

  const event = createEvent({
    event: eventName,
    agent: flags.agent || flags.a || "unknown",
    sessionId: flags.session || flags.s,
    toolName: flags.tool || flags.t,
    cwd: flags.cwd,
    ttlMs: flags.ttl ? Number(flags.ttl) : undefined,
    message: flags.message || flags.m,
    terminal: Boolean(flags.terminal),
    metadata: collectMetadata(flags),
  });

  // Hook calls must fail-open. Log but do not fail the agent process.
  try {
    await sendEvent(event, { autoStart: true });
  } catch (error) {
    await appendLog("notify.failed", { error: error instanceof Error ? error.message : String(error), event }).catch(() => {});
    if (!flags.quiet) {
      console.error(`agent-light notify failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function status(args) {
  const { flags } = parseArgs(args);
  try {
    const response = await sendEvent(createEvent({ event: "status", agent: "cli" }), { autoStart: Boolean(flags.start) });
    console.log(JSON.stringify(response.status, null, 2));
  } catch (error) {
    if (flags.json) {
      console.log(JSON.stringify({ running: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
      return;
    }
    throw error;
  }
}

async function testEffect(args) {
  const { positional, flags } = parseArgs(args);
  const effect = positional[0] || "done";
  if (!KNOWN_EVENTS.has(effect)) throw new Error(`Unknown test event: ${effect}`);
  const durationSec = Number(flags.duration || flags.d || 3);
  const durationMs = Math.max(250, durationSec * 1000);
  const sessionId = `test-${Date.now()}`;
  await sendEvent(createEvent({ event: effect, agent: "test", sessionId, ttlMs: durationMs + 1000 }), { autoStart: true });
  if (!["done", "error", "cancelled", "notification", "startup", "tool-start"].includes(effect)) {
    await sleep(durationMs);
    await sendEvent(createEvent({ event: "idle", agent: "test", sessionId }), { autoStart: true });
  } else {
    await sleep(Math.min(durationMs, 1500));
  }
}

async function restore() {
  await sendEvent(createEvent({ event: "restore", agent: "cli" }), { autoStart: true });
}

async function configCommand(args) {
  const [subcommand] = args;
  if (subcommand === "init") {
    const wrote = await writeDefaultConfigIfMissing();
    console.log(wrote ? `created ${configPath()}` : `exists ${configPath()}`);
    return;
  }
  if (subcommand === "path") {
    console.log(configPath());
    return;
  }
  if (subcommand === "show" || !subcommand) {
    console.log(JSON.stringify(await loadConfig(), null, 2));
    return;
  }
  throw new Error(`Unknown config command: ${subcommand}`);
}

async function daemonCommand(args) {
  const [subcommand] = args;
  switch (subcommand) {
    case "run":
      return runDaemon();
    case "start":
      await startDaemon();
      console.log(`agent-light daemon listening on ${socketPath()}`);
      return;
    case "stop":
      try {
        await sendEvent(createEvent({ event: "shutdown", agent: "cli" }), { autoStart: false });
      } catch (error) {
        if (existsSync(socketPath())) await fs.unlink(socketPath()).catch(() => {});
        throw error;
      }
      return;
    case "probe": {
      const config = await loadConfig();
      const backend = await createBackend(config);
      console.log(JSON.stringify(await backend.probe?.() ?? { available: true, backend: backend.name }, null, 2));
      return;
    }
    case undefined:
    case "help":
    case "--help":
      console.log("Usage: agent-light daemon <start|stop|run|probe>");
      return;
    default:
      throw new Error(`Unknown daemon command: ${subcommand}`);
  }
}

async function sendEvent(event, options = {}) {
  try {
    return await connectAndSend(event);
  } catch (error) {
    if (!options.autoStart) throw error;
    await startDaemon();
    return connectAndSend(event, START_TIMEOUT_MS);
  }
}

function connectAndSend(event, timeoutMs = CONNECT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath());
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`timed out connecting to ${socketPath()}`));
    }, timeoutMs);
    let buffer = "";

    socket.setEncoding("utf8");
    socket.once("connect", () => {
      socket.write(`${JSON.stringify(event)}\n`);
    });
    socket.on("data", (chunk) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      clearTimeout(timer);
      const line = buffer.slice(0, newline);
      socket.end();
      const response = JSON.parse(line);
      if (!response.ok) reject(new Error(response.error || "daemon returned failure"));
      else resolve(response);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.once("close", () => clearTimeout(timer));
  });
}

async function startDaemon() {
  if (await isDaemonRunning()) return;
  const binPath = fileURLToPath(new URL("../bin/agent-light.mjs", import.meta.url));
  const child = spawn(process.execPath, [binPath, "daemon", "run"], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();

  const start = Date.now();
  while (Date.now() - start < START_TIMEOUT_MS) {
    if (await isDaemonRunning()) return;
    await sleep(80);
  }
  throw new Error("daemon did not become ready");
}

async function isDaemonRunning() {
  try {
    await connectAndSend(createEvent({ event: "status", agent: "cli" }), CONNECT_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const raw = arg.slice(2);
    const eq = raw.indexOf("=");
    if (eq >= 0) {
      flags[raw.slice(0, eq)] = raw.slice(eq + 1);
      continue;
    }
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      flags[raw] = next;
      i += 1;
    } else {
      flags[raw] = true;
    }
  }
  return { positional, flags };
}

function collectMetadata(flags) {
  const metadata = {};
  for (const [key, value] of Object.entries(flags)) {
    if (key.startsWith("meta-")) metadata[key.slice(5)] = value;
  }
  return metadata;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHelp() {
  const events = [...KNOWN_EVENTS].filter((event) => !["status", "shutdown", "restore"].includes(event)).join("|");
  console.log(`agent-light ${PACKAGE_VERSION}\n\nUsage:\n  agent-light notify <${events}> [--agent pi] [--session id] [--tool bash]\n  agent-light test <event> [--duration seconds]\n  agent-light status [--json]\n  agent-light restore\n  agent-light daemon <start|stop|run|probe>\n  agent-light config <init|show|path>\n\nConfig: ${configPath()}\nLog:    ${logPath()}\nSocket: ${socketPath()}\n`);
}
