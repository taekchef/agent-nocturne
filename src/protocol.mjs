import os from "node:os";
import path from "node:path";

export const VERSION = 1;

export const KNOWN_EVENTS = new Set([
  "startup",
  "thinking",
  "tool-start",
  "tool-error",
  "tool-end",
  "tool-batch-end",
  "permission",
  "waiting-input",
  "blocked",
  "compact",
  "background",
  "notification",
  "done",
  "error",
  "cancelled",
  "idle",
  "restore",
  "status",
  "shutdown",
]);

export const DEFAULT_TTL_MS = {
  startup: 5_000,
  thinking: 120_000,
  "tool-start": 120_000,
  "tool-error": 10_000,
  "tool-end": 120_000,
  "tool-batch-end": 120_000,
  permission: 300_000,
  "waiting-input": 300_000,
  blocked: 600_000,
  compact: 180_000,
  background: 600_000,
  notification: 10_000,
  done: 10_000,
  error: 10_000,
  cancelled: 10_000,
  idle: 1_000,
  restore: 1_000,
};

export function appSupportDir() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "AgentLight");
  }
  return path.join(os.homedir(), ".agent-light");
}

export function logDir() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Logs", "AgentLight");
  }
  return path.join(appSupportDir(), "logs");
}

export function configPath() {
  return path.join(appSupportDir(), "config.json");
}

export function statePath() {
  return path.join(appSupportDir(), "state.json");
}

export function baselinePath() {
  return path.join(appSupportDir(), "baseline.json");
}

export function logPath() {
  return path.join(logDir(), "agent-light.log");
}

export function socketPath() {
  return path.join(os.tmpdir(), `agent-light-${process.getuid?.() ?? "user"}.sock`);
}

export function normalizeBrightness(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function defaultSessionId(agent) {
  return `${agent || "unknown"}:default`;
}

export function createEvent(input = {}) {
  const event = String(input.event || "");
  if (!KNOWN_EVENTS.has(event)) {
    throw new Error(`Unknown event: ${event || "<empty>"}`);
  }

  const agent = String(input.agent || "unknown");
  const sessionId = String(input.sessionId || defaultSessionId(agent));
  const ttlMs = Number.isFinite(input.ttlMs) ? Number(input.ttlMs) : (DEFAULT_TTL_MS[event] ?? 120_000);

  return {
    version: VERSION,
    event,
    agent,
    sessionId,
    toolName: input.toolName ? String(input.toolName) : undefined,
    cwd: input.cwd ? String(input.cwd) : process.cwd(),
    timestamp: Number.isFinite(input.timestamp) ? Number(input.timestamp) : Date.now(),
    ttlMs,
    message: input.message ? String(input.message) : undefined,
    terminal: input.terminal === true,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
}
