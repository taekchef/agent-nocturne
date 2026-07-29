#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const bin = fileURLToPath(new URL("../bin/nocturne.mjs", import.meta.url));
const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-nocturne-smoke-"));
const home = path.join(root, "home");
const temp = path.join(root, "tmp");
await fs.mkdir(home);
await fs.mkdir(temp);

const env = {
  ...process.env,
  HOME: home,
  TMPDIR: temp,
  NOCTURNE_BACKEND: "mock",
};

try {
  await Promise.all(Array.from({ length: 8 }, (_, index) => (
    run("notify", "thinking", "--agent", "race", "--session", String(index), "--quiet")
  )));
  const log = await fs.readFile(path.join(home, "Library", "Logs", "AgentLight", "agent-light.log"), "utf8");
  const starts = log.split("\n").filter((line) => line.includes("daemon.start")).length;
  if (starts !== 1) throw new Error(`expected one daemon start, got ${starts}`);

  await run("notify", "thinking", "tool-start", "tool-error", "tool-end", "--agent", "smoke", "--session", "ordered", "--quiet");
  const { stdout } = await run("status", "--json");
  const status = JSON.parse(stdout);
  const session = status.machine.sessions.find((item) => item.agent === "smoke" && item.sessionId === "ordered");
  if (status.backend !== "mock") throw new Error(`expected mock backend, got ${status.backend}`);
  if (session?.toolCount !== 0 || session?.latch !== "thinking") {
    throw new Error(`ordered event batch did not reconcile: ${JSON.stringify(session)}`);
  }
  await run("notify", "idle", "--agent", "smoke", "--session", "ordered", "--quiet");
  console.log(JSON.stringify({ backend: status.backend, singleDaemonStart: true, orderedBatch: true, socketMode: await socketMode(status.socketPath) }));
} finally {
  await run("daemon", "stop").catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 150));
  await fs.rm(root, { recursive: true, force: true });
}

function run(...args) {
  return execFileAsync(process.execPath, [bin, ...args], { env, timeout: 5_000 });
}

async function socketMode(socketPath) {
  const stat = await fs.stat(socketPath);
  return (stat.mode & 0o777).toString(8).padStart(3, "0");
}
