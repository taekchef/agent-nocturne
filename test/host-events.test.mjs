import assert from "node:assert/strict";
import test from "node:test";
import {
  codexToolFailed,
  hostSessionId,
  mapClaudeHook,
  mapCodexHook,
  mapHostHook,
} from "../src/host-events.mjs";

const names = (events) => events.map(({ event }) => event);

test("Claude lifecycle hooks map to normalized events", () => {
  const cases = [
    ["SessionStart", { source: "startup" }, ["startup"]],
    ["SessionStart", { source: "compact" }, ["thinking"]],
    ["UserPromptSubmit", {}, ["thinking"]],
    ["PreToolUse", {}, ["tool-start"]],
    ["PermissionRequest", {}, ["permission"]],
    ["PermissionDenied", {}, ["tool-batch-end"]],
    ["PostToolUse", {}, ["tool-end"]],
    ["PostToolUseFailure", { error: "command failed" }, ["tool-error", "tool-end"]],
    ["PostToolBatch", {}, ["tool-batch-end"]],
    ["PreCompact", {}, ["compact"]],
    ["PostCompact", {}, ["thinking"]],
    ["SubagentStart", {}, ["background"]],
    ["SubagentStop", {}, ["idle"]],
    ["Stop", {}, ["done"]],
    ["StopFailure", { error: { message: "API unavailable" } }, ["error"]],
    ["SessionEnd", {}, ["idle"]],
  ];

  for (const [hook, payload, expected] of cases) {
    assert.deepEqual(names(mapClaudeHook(hook, payload)), expected, hook);
  }
  assert.equal(mapClaudeHook("StopFailure", {}).at(0).terminal, true);
});

test("Claude notifications distinguish attention from routine notices", () => {
  assert.deepEqual(names(mapClaudeHook("Notification", { notification_type: "permission_prompt" })), ["permission"]);
  assert.deepEqual(names(mapClaudeHook("Notification", { notification_type: "idle_prompt" })), ["waiting-input"]);
  assert.deepEqual(names(mapClaudeHook("Notification", { notification_type: "agent_needs_input" })), ["waiting-input"]);
  assert.deepEqual(names(mapClaudeHook("Notification", { notification_type: "agent_completed" })), ["notification"]);
});

test("Codex lifecycle hooks map without pretending Stop exposes failures", () => {
  const cases = [
    ["SessionStart", { source: "startup" }, ["startup"]],
    ["UserPromptSubmit", {}, ["thinking"]],
    ["PreToolUse", {}, ["tool-start"]],
    ["PermissionRequest", {}, ["permission"]],
    ["PostToolUse", { tool_response: { metadata: { exit_code: 0 } } }, ["tool-end"]],
    ["PostToolUse", { tool_response: { metadata: { exit_code: 7 } } }, ["tool-error", "tool-end"]],
    ["PreCompact", {}, ["compact"]],
    ["PostCompact", {}, ["thinking"]],
    ["SubagentStart", {}, ["background"]],
    ["SubagentStop", {}, ["idle"]],
    ["Stop", { status: "failed" }, ["done"]],
    ["SessionEnd", {}, ["idle"]],
  ];

  for (const [hook, payload, expected] of cases) {
    assert.deepEqual(names(mapCodexHook(hook, payload)), expected, hook);
  }
});

test("Codex tool failures use structured fields instead of matching output text", () => {
  // Codex CLI 0.145 and the tested Desktop 0.146 app-server currently send
  // an empty string here even after Bash exits non-zero. Do not guess failure.
  assert.deepEqual(names(mapCodexHook("PostToolUse", { tool_response: "" })), ["tool-end"]);
  assert.equal(codexToolFailed({ tool_response: { success: false } }), true);
  assert.equal(codexToolFailed({ tool_response: { result: { is_error: true } } }), true);
  assert.equal(codexToolFailed({ tool_response: { status: "failed" } }), true);
  assert.equal(codexToolFailed({ tool_response: "the documentation says status failed" }), false);
  assert.equal(codexToolFailed({ tool_response: { output: "error is a word, not a status" } }), false);
});

test("subagents receive stable session scopes separate from their parent", () => {
  const parent = hostSessionId("claude", { session_id: "session-1" });
  const child = hostSessionId("claude", { session_id: "session-1", agent_id: "agent-7" });
  assert.equal(parent, hostSessionId("claude", { session_id: "session-1" }));
  assert.notEqual(parent, child);
});

test("unknown hosts and hooks fail open with no events", () => {
  assert.deepEqual(mapHostHook("other", "Stop", {}), []);
  assert.deepEqual(mapCodexHook("StopFailure", {}), []);
  assert.deepEqual(mapClaudeHook("Unknown", {}), []);
});
