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
    dimmed: false,
    suppressed: false,
    writes: [],
    async getBrightness() {
      return this.value;
    },
    async getBrightnessState() {
      return {
        brightness: this.value,
        dimmed: this.dimmed,
        suppressed: this.suppressed,
      };
    },
    async setBrightness(value) {
      this.value = value;
      this.writes.push(value);
    },
  };
}

function fakeBaselineStore(initial) {
  return {
    value: initial,
    saves: [],
    async load() {
      return this.value;
    },
    async save(value) {
      this.value = value;
      this.saves.push(value);
    },
  };
}

test("idle polling adopts a user brightness change as the new baseline", async () => {
  const backend = fakeBackend(0.22);
  const store = fakeBaselineStore(0.22);
  const daemon = new AgentLightDaemon({ config: config(), backend, baselineStore: store });
  daemon.baseline = 0.22;
  daemon.lastBrightness = 0.22;
  daemon.lastBaselineCheckAt = 0;
  backend.value = 0.61;

  await daemon.renderTick(1_500);

  assert.equal(daemon.baseline, 0.61);
  assert.equal(daemon.lastBrightness, 0.61);
  assert.deepEqual(store.saves, [0.61]);
  assert.deepEqual(backend.writes, []);
});

test("idle polling ignores macOS idle dim and suppression", async () => {
  for (const override of ["dimmed", "suppressed"]) {
    const backend = fakeBackend(0);
    backend[override] = true;
    const store = fakeBaselineStore(0.22);
    const daemon = new AgentLightDaemon({ config: config(), backend, baselineStore: store });
    daemon.baseline = 0.22;
    daemon.lastBrightness = 0.22;
    daemon.lastBaselineCheckAt = 0;

    await daemon.renderTick(1_500);

    assert.equal(daemon.baseline, 0.22, override);
    assert.equal(daemon.lastBrightness, 0, override);
    assert.deepEqual(store.saves, [], override);
    assert.deepEqual(backend.writes, [], override);
  }
});

test("startup uses persisted baseline while the system has temporarily dimmed the keyboard", async () => {
  const backend = fakeBackend(0);
  backend.dimmed = true;
  const store = fakeBaselineStore(0.61);
  const daemon = new AgentLightDaemon({ config: config(), backend, baselineStore: store });

  await daemon.initializeBaseline();

  assert.equal(daemon.baseline, 0.61);
  assert.equal(daemon.baselineSource, "persisted");
  assert.equal(daemon.lastBrightness, 0);
  assert.deepEqual(store.saves, []);
});

test("startup captures and persists an effective user brightness", async () => {
  const backend = fakeBackend(0.37);
  const store = fakeBaselineStore(0.61);
  const daemon = new AgentLightDaemon({ config: config(), backend, baselineStore: store });

  await daemon.initializeBaseline();

  assert.equal(daemon.baseline, 0.37);
  assert.equal(daemon.baselineSource, "hardware");
  assert.equal(daemon.lastBrightness, 0.37);
  assert.deepEqual(store.saves, [0.37]);
});

test("entering idle restores the captured baseline before polling hardware", async () => {
  const backend = fakeBackend(0.48);
  const daemon = new AgentLightDaemon({
    config: config(),
    backend,
    baselineStore: fakeBaselineStore(0.22),
  });
  daemon.baseline = 0.22;
  daemon.lastBrightness = 0.48;
  daemon.previousVisualState = "thinking";

  await daemon.renderTick(2_000);

  assert.equal(daemon.baseline, 0.22);
  assert.equal(backend.value, 0.22);
  assert.deepEqual(backend.writes, [0.22]);
});
