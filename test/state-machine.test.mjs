import assert from "node:assert/strict";
import test from "node:test";
import { createEvent } from "../src/protocol.mjs";
import { AgentLightStateMachine } from "../src/state-machine.mjs";

test("thinking transitions to tool and back to thinking after tool-end", () => {
  const machine = new AgentLightStateMachine();
  const now = 1_000;
  machine.apply(createEvent({ event: "thinking", agent: "pi", sessionId: "s" }), now);
  assert.equal(machine.visible(now).state, "thinking");

  machine.apply(createEvent({ event: "tool-start", agent: "pi", sessionId: "s", toolName: "bash" }), now + 100);
  assert.equal(machine.visible(now + 100).state, "tool-start");
  assert.equal(machine.visible(now + 700).state, "tool");

  machine.apply(createEvent({ event: "tool-end", agent: "pi", sessionId: "s", toolName: "bash" }), now + 800);
  assert.equal(machine.visible(now + 900).state, "thinking");
});

test("permission preempts tool and thinking", () => {
  const machine = new AgentLightStateMachine();
  const now = 2_000;
  machine.apply(createEvent({ event: "thinking", agent: "pi", sessionId: "s1" }), now);
  machine.apply(createEvent({ event: "tool-start", agent: "pi", sessionId: "s1" }), now + 10);
  machine.apply(createEvent({ event: "permission", agent: "codex", sessionId: "s2" }), now + 20);
  assert.equal(machine.visible(now + 30).state, "permission");
});

test("done is terminal for a session and then expires to idle", () => {
  const machine = new AgentLightStateMachine();
  const now = 3_000;
  machine.apply(createEvent({ event: "thinking", agent: "pi", sessionId: "s" }), now);
  machine.apply(createEvent({ event: "done", agent: "pi", sessionId: "s" }), now + 10);
  assert.equal(machine.visible(now + 20).state, "done");
  assert.equal(machine.visible(now + 2_000).state, "idle");
});

test("TTL expiry returns state to idle", () => {
  const machine = new AgentLightStateMachine();
  const now = 4_000;
  machine.apply(createEvent({ event: "thinking", agent: "pi", sessionId: "s", ttlMs: 1_000 }), now);
  assert.equal(machine.visible(now + 500).state, "thinking");
  assert.equal(machine.visible(now + 1_100).state, "idle");
});

test("parallel tools keep tool state until all end", () => {
  const machine = new AgentLightStateMachine();
  const now = 5_000;
  machine.apply(createEvent({ event: "thinking", agent: "pi", sessionId: "s" }), now);
  machine.apply(createEvent({ event: "tool-start", agent: "pi", sessionId: "s" }), now + 10);
  machine.apply(createEvent({ event: "tool-start", agent: "pi", sessionId: "s" }), now + 700);
  assert.equal(machine.visible(now + 710).state, "tool", "parallel tools must not replay the batch-entry pulse");
  machine.apply(createEvent({ event: "tool-end", agent: "pi", sessionId: "s" }), now + 800);
  assert.equal(machine.visible(now + 1300).state, "tool");
  machine.apply(createEvent({ event: "tool-end", agent: "pi", sessionId: "s" }), now + 1400);
  assert.equal(machine.visible(now + 2000).state, "thinking");
});

test("recoverable tool errors are muted and return to the active tool state", () => {
  const machine = new AgentLightStateMachine();
  const now = 7_000;
  machine.apply(createEvent({ event: "thinking", agent: "pi", sessionId: "s" }), now);
  machine.apply(createEvent({ event: "tool-start", agent: "pi", sessionId: "s" }), now + 10);
  machine.apply(createEvent({ event: "tool-error", agent: "pi", sessionId: "s" }), now + 600);
  assert.equal(machine.visible(now + 610).state, "tool-error");
  assert.equal(machine.visible(now + 1_200).state, "tool");
});
