#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LOCAL_AGENT_LIGHT_BIN = fileURLToPath(new URL("../../../bin/agent-light.mjs", import.meta.url));
const AGENT_LIGHT_BIN = process.env.AGENT_LIGHT_BIN || (existsSync(LOCAL_AGENT_LIGHT_BIN) ? LOCAL_AGENT_LIGHT_BIN : undefined);
const hookName = process.argv[2] || "unknown";

try {
  const payload = await readJsonStdin();
  for (const event of mapHook(hookName, payload)) fire(event, payload);
} catch {
  // Fail open: hooks must never interrupt Codex.
}

function mapHook(name, payload) {
  switch (name) {
    case "UserPromptSubmit":
      return ["thinking"];
    case "PreToolUse":
      return ["tool-start"];
    case "PostToolUse":
      return isFailure(payload) ? ["tool-error", "tool-end"] : ["tool-end"];
    case "PermissionRequest":
      return ["permission"];
    case "PreCompact":
      return ["compact"];
    case "PostCompact":
      return ["thinking"];
    case "Stop":
      return isFailure(payload) ? ["error"] : ["done"];
    default:
      return [];
  }
}

function fire(event, payload) {
  const args = [
    ...(AGENT_LIGHT_BIN ? [AGENT_LIGHT_BIN] : []),
    "notify",
    event,
    "--agent",
    "codex",
    "--session",
    sessionId(payload),
    "--quiet",
  ];
  const tool = payload?.tool_name || payload?.toolName;
  if (tool) args.push("--tool", String(tool));
  const cwd = payload?.cwd || process.cwd();
  if (cwd) args.push("--cwd", String(cwd));
  if (event === "error" || event === "tool-error") args.push("--message", failureMessage(payload));

  const child = spawn(AGENT_LIGHT_BIN ? process.execPath : "agent-light", args, { stdio: "ignore", detached: true });
  child.unref();
}

function sessionId(payload) {
  const source = payload?.session_id || payload?.sessionId || payload?.thread_id || payload?.transcript_path || payload?.cwd || "codex-default";
  return createHash("sha1").update(String(source)).digest("hex").slice(0, 16);
}

function isFailure(payload) {
  const text = JSON.stringify(payload || {}).toLowerCase();
  return payload?.success === false || payload?.error || payload?.is_error === true || text.includes('"is_error":true') || text.includes('"status":"failed"');
}

function failureMessage(payload) {
  return String(payload?.error?.message || payload?.error || payload?.tool_response?.error || "codex hook reported failure").slice(0, 200);
}

async function readJsonStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}
