import { accessSync, constants, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { hostSessionId, mapHostHook } from "./host-events.mjs";

const LOCAL_BIN = fileURLToPath(new URL("../bin/nocturne.mjs", import.meta.url));
const LOCAL_NATIVE_HELPER = fileURLToPath(new URL("../native/build/agent-light-backlight", import.meta.url));

export async function runHostHook(host, explicitHookName) {
  try {
    const payload = await readJsonStdin();
    const hookName = explicitHookName || payload.hook_event_name || "unknown";
    const events = mapHostHook(host, hookName, payload);
    if (events.length === 0) return;
    dispatch(events, host, hookName, payload);
  } catch {
    // Fail open: lighting must never interrupt the host agent.
  }
}

function dispatch(events, host, hookName, payload) {
  const cli = resolveCli();
  if (!cli) return;

  const args = [
    ...cli.prefix,
    "notify",
    ...events.map(({ event }) => event),
    "--agent",
    host,
    "--session",
    hostSessionId(host, payload),
    "--quiet",
    "--meta-hook",
    hookName,
  ];
  const tool = payload.tool_name || payload.toolName;
  if (tool) args.push("--tool", String(tool));
  const cwd = payload.cwd || process.cwd();
  if (cwd) args.push("--cwd", String(cwd));
  const message = events.find((event) => event.message)?.message;
  if (message) args.push("--message", message);
  if (events.some((event) => event.terminal)) args.push("--terminal");

  const child = spawn(cli.command, args, {
    detached: true,
    env: process.env,
    stdio: "ignore",
  });
  child.once("error", () => {});
  child.unref();
}

function resolveCli() {
  const explicit = process.env.NOCTURNE_BIN || process.env.AGENT_LIGHT_BIN;
  if (explicit) return commandSpec(explicit);

  for (const name of ["nocturne", "agent-light"]) {
    const found = findOnPath(name);
    if (found) return { command: found, prefix: [] };
  }

  const mockRequested = (process.env.NOCTURNE_BACKEND || process.env.AGENT_LIGHT_BACKEND) === "mock";
  if (existsSync(LOCAL_BIN) && (mockRequested || existsSync(LOCAL_NATIVE_HELPER))) {
    return { command: process.execPath, prefix: [LOCAL_BIN] };
  }
  return undefined;
}

function commandSpec(command) {
  const resolved = path.resolve(command);
  return path.extname(resolved) === ".mjs"
    ? { command: process.execPath, prefix: [resolved] }
    : { command: resolved, prefix: [] };
}

function findOnPath(name) {
  for (const directory of String(process.env.PATH || "").split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Keep searching.
    }
  }
  return undefined;
}

async function readJsonStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}
