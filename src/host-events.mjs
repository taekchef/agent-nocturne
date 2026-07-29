import { createHash } from "node:crypto";

export function mapHostHook(host, hookName, payload = {}) {
  if (host === "claude") return mapClaudeHook(hookName, payload);
  if (host === "codex") return mapCodexHook(hookName, payload);
  return [];
}

export function mapClaudeHook(hookName, payload = {}) {
  switch (hookName) {
    case "SessionStart":
      return [{ event: payload.source === "compact" ? "thinking" : "startup" }];
    case "UserPromptSubmit":
      return [{ event: "thinking" }];
    case "PreToolUse":
      return [{ event: "tool-start" }];
    case "PermissionRequest":
      return [{ event: "permission" }];
    case "PermissionDenied":
      return [{ event: "tool-batch-end" }];
    case "PostToolUse":
      return [{ event: "tool-end" }];
    case "PostToolUseFailure":
      return [
        { event: "tool-error", message: failureMessage(payload, "Claude tool failed") },
        { event: "tool-end" },
      ];
    case "PostToolBatch":
      return [{ event: "tool-batch-end" }];
    case "Notification":
      return [{ event: claudeNotificationEvent(payload) }];
    case "PreCompact":
      return [{ event: "compact" }];
    case "PostCompact":
      return [{ event: "thinking" }];
    case "SubagentStart":
      return [{ event: "background" }];
    case "SubagentStop":
      return [{ event: "idle" }];
    case "Stop":
      return [{ event: "done" }];
    case "StopFailure":
      return [{ event: "error", terminal: true, message: failureMessage(payload, "Claude turn failed") }];
    case "SessionEnd":
      return [{ event: "idle" }];
    default:
      return [];
  }
}

export function mapCodexHook(hookName, payload = {}) {
  switch (hookName) {
    case "SessionStart":
      return [{ event: payload.source === "compact" ? "thinking" : "startup" }];
    case "UserPromptSubmit":
      return [{ event: "thinking" }];
    case "PreToolUse":
      return [{ event: "tool-start" }];
    case "PermissionRequest":
      return [{ event: "permission" }];
    case "PostToolUse":
      return codexToolFailed(payload)
        ? [
            { event: "tool-error", message: failureMessage(payload, "Codex tool failed") },
            { event: "tool-end" },
          ]
        : [{ event: "tool-end" }];
    case "PreCompact":
      return [{ event: "compact" }];
    case "PostCompact":
      return [{ event: "thinking" }];
    case "SubagentStart":
      return [{ event: "background" }];
    case "SubagentStop":
      return [{ event: "idle" }];
    case "Stop":
      return [{ event: "done" }];
    case "SessionEnd":
      return [{ event: "idle" }];
    default:
      return [];
  }
}

export function hostSessionId(host, payload = {}) {
  const root = payload.session_id
    || payload.sessionId
    || payload.thread_id
    || payload.transcript_path
    || payload.cwd
    || `${host}-default`;
  const scoped = payload.agent_id ? `${root}:subagent:${payload.agent_id}` : root;
  return createHash("sha1").update(String(scoped)).digest("hex").slice(0, 16);
}

export function codexToolFailed(payload = {}) {
  return hasStructuredFailure(payload.tool_response) || hasStructuredFailure(payload);
}

function hasStructuredFailure(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 4) return false;
  if (value.success === false || value.ok === false || value.is_error === true || value.isError === true) return true;
  if (typeof value.status === "string" && /^(failed|failure|error)$/i.test(value.status)) return true;
  if (Number.isFinite(value.exit_code) && Number(value.exit_code) !== 0) return true;
  if (Number.isFinite(value.exitCode) && Number(value.exitCode) !== 0) return true;
  if (value.error !== undefined && value.error !== null && value.error !== false && value.error !== "") return true;

  for (const key of ["metadata", "result", "details", "response"]) {
    if (hasStructuredFailure(value[key], depth + 1)) return true;
  }
  return false;
}

function claudeNotificationEvent(payload) {
  const type = String(payload.notification_type || payload.notification?.type || payload.type || "").toLowerCase();
  if (type === "permission_prompt") return "permission";
  if (type === "idle_prompt" || type === "agent_needs_input") return "waiting-input";
  return "notification";
}

function failureMessage(payload, fallback) {
  const value = payload.error?.message
    || payload.error
    || payload.tool_response?.error?.message
    || payload.tool_response?.error
    || payload.message
    || fallback;
  return String(value).replace(/\s+/g, " ").slice(0, 200);
}
