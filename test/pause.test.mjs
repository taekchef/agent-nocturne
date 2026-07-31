import assert from "node:assert/strict";
import test from "node:test";
import { AgentLightDaemon } from "../src/daemon.mjs";
import { createEvent } from "../src/protocol.mjs";

function config() {
  return {
    enabled: true,
    backend: "mock",
    minBrightness: 0.05,
    maxBrightness: 0.8,
    respectKeyboardOff: false,
    effects: {},
    agents: { pi: { enabled: true }, unknown: { enabled: true } },
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
      return { brightness: this.value, dimmed: this.dimmed, suppressed: this.suppressed };
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
    async load() {
      return this.value;
    },
    async save(value) {
      this.value = value;
    },
  };
}

function fakePausedStore() {
  let paused = false;
  return {
    async isPaused() {
      return paused;
    },
    async setPaused(value) {
      paused = value;
    },
  };
}

// A minimal socket double that captures the daemon's JSON responses.
function fakeSocket() {
  const responses = [];
  return {
    writes: responses,
    setEncoding() {},
    on() {},
    write(line) {
      responses.push(JSON.parse(line.trim()));
    },
    end() {},
  };
}

function makeDaemon() {
  const backend = fakeBackend(0.22);
  const pausedStore = fakePausedStore();
  const daemon = new AgentLightDaemon({
    config: config(),
    backend,
    baselineStore: fakeBaselineStore(0.22),
    pausedStore,
  });
  daemon.baseline = 0.22;
  daemon.lastBrightness = 0.22;
  return { daemon, backend, pausedStore };
}

test("pause immediately restores the baseline and persists the paused flag", async () => {
  const { daemon, backend, pausedStore } = makeDaemon();
  backend.value = 0.8; // mid-animation brightness
  daemon.lastBrightness = 0.8;
  const socket = fakeSocket();

  await daemon.handleLine(JSON.stringify(createEvent({ event: "pause", agent: "cli" })), socket);

  assert.equal(daemon.paused, true);
  assert.equal(backend.value, 0.22, "brightness restored to baseline");
  assert.equal(socket.writes[0].ok, true);
  assert.equal(socket.writes[0].paused, true);
  assert.equal(await pausedStore.isPaused(), true, "paused flag persisted");
});

test("agent events are dropped while paused (and do not revive the light)", async () => {
  const { daemon } = makeDaemon();
  daemon.paused = true;
  const socket = fakeSocket();

  await daemon.handleLine(JSON.stringify(createEvent({ event: "thinking", agent: "pi", sessionId: "s1" })), socket);

  assert.equal(socket.writes[0].ok, true);
  assert.equal(socket.writes[0].ignored, "paused");
  assert.equal(daemon.machine.snapshot().sessions.length, 0, "no session was created");
});

test("renderTick stays at the baseline while paused and writes nothing new", async () => {
  const { daemon, backend } = makeDaemon();
  daemon.paused = true;
  backend.value = 0.8; // pretend a previous animation set it high
  daemon.lastBrightness = 0.8;

  await daemon.renderTick(1_000);

  assert.equal(backend.value, daemon.baseline, "forced back to baseline");
  assert.equal(daemon.previousVisualState, "idle");
});

test("resume clears the paused flag and persisted state", async () => {
  const { daemon, pausedStore } = makeDaemon();
  daemon.paused = true;
  const socket = fakeSocket();

  await daemon.handleLine(JSON.stringify(createEvent({ event: "resume", agent: "cli" })), socket);

  assert.equal(daemon.paused, false);
  assert.equal(socket.writes[0].ok, true);
  assert.equal(socket.writes[0].paused, false);
  assert.equal(await pausedStore.isPaused(), false, "paused flag cleared");
});

test("restore and status still work while paused", async () => {
  const { daemon } = makeDaemon();
  daemon.paused = true;
  const socket = fakeSocket();

  await daemon.handleLine(JSON.stringify(createEvent({ event: "status", agent: "cli" })), socket);
  assert.equal(socket.writes[0].ok, true);
  assert.equal(socket.writes[0].status.paused, true);

  const restoreSocket = fakeSocket();
  await daemon.handleLine(JSON.stringify(createEvent({ event: "restore", agent: "cli" })), restoreSocket);
  assert.equal(restoreSocket.writes[0].ok, true);
});

test("status reports the paused flag", async () => {
  const { daemon } = makeDaemon();
  daemon.paused = true;

  const status = await daemon.status();
  assert.equal(status.paused, true);
});
