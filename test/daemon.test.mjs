import assert from "node:assert/strict";
import test from "node:test";
import { AgentLightDaemon } from "../src/daemon.mjs";

function config() {
  return {
    enabled: true,
    backend: "mock",
    minBrightness: 0.05,
    maxBrightness: 0.8,
    respectKeyboardOff: false,
    effects: {},
    agents: {},
  };
}

function fakeBackend(initial = 0.22) {
  return {
    name: "fake",
    value: initial,
    writes: [],
    async getBrightness() {
      return this.value;
    },
    async setBrightness(value) {
      this.value = value;
      this.writes.push(value);
    },
  };
}

test("idle polling adopts a user brightness change as the new baseline", async () => {
  const backend = fakeBackend(0.22);
  const daemon = new AgentLightDaemon({ config: config(), backend });
  daemon.baseline = 0.22;
  daemon.lastBrightness = 0.22;
  daemon.lastBaselineCheckAt = 0;
  backend.value = 0.61;

  await daemon.renderTick(1_500);

  assert.equal(daemon.baseline, 0.61);
  assert.equal(daemon.lastBrightness, 0.61);
  assert.deepEqual(backend.writes, []);
});

test("entering idle restores the captured baseline before polling hardware", async () => {
  const backend = fakeBackend(0.48);
  const daemon = new AgentLightDaemon({ config: config(), backend });
  daemon.baseline = 0.22;
  daemon.lastBrightness = 0.48;
  daemon.previousVisualState = "thinking";

  await daemon.renderTick(2_000);

  assert.equal(daemon.baseline, 0.22);
  assert.equal(backend.value, 0.22);
  assert.deepEqual(backend.writes, [0.22]);
});
