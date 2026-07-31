import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import { createBackend } from "./backends/index.mjs";
import { isPaused, loadConfig, setPaused } from "./config.mjs";
import { appendLog } from "./logger.mjs";
import { brightnessForVisual } from "./effects.mjs";
import { baselinePath, createEvent, normalizeBrightness, socketPath } from "./protocol.mjs";
import { AgentLightStateMachine } from "./state-machine.mjs";

const ACTIVE_TICK_MS = 80;
const IDLE_TICK_MS = 1500;
const EPSILON = 0.01;

export class AgentLightDaemon {
  constructor(options = {}) {
    this.config = options.config;
    this.backend = options.backend;
    this.server = undefined;
    this.machine = new AgentLightStateMachine();
    this.baseline = 0.5;
    this.lastBrightness = undefined;
    this.timer = undefined;
    this.loopRunning = false;
    this.renderInFlight = false;
    this.renderPending = false;
    this.previousVisualState = "idle";
    this.lastBaselineCheckAt = 0;
    this.baselineStore = options.baselineStore ?? createFileBaselineStore();
    this.pausedStore = options.pausedStore ?? createFilePausedStore();
    this.baselineSource = "hardware";
    this.baselineSampleIgnored = false;
    this.startedAt = Date.now();
    this.paused = false;
  }

  async start() {
    this.config ??= await loadConfig();
    this.backend ??= await createBackend(this.config);
    this.paused = await this.pausedStore.isPaused();
    await this.initializeBaseline();
    await appendLog("daemon.start", {
      backend: this.backend.name,
      baseline: this.baseline,
      baselineSource: this.baselineSource,
      paused: this.paused,
    });

    await this.removeStaleSocket();
    this.server = net.createServer((socket) => this.handleSocket(socket));
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(socketPath(), () => {
        this.server?.off("error", reject);
        resolve();
      });
    });
    if (process.platform !== "win32") {
      try {
        await fs.chmod(socketPath(), 0o600);
      } catch (error) {
        await new Promise((resolve) => this.server?.close(resolve));
        await this.removeStaleSocket();
        throw error;
      }
    }
    this.startRenderLoop();
  }

  async stop() {
    this.loopRunning = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    await this.restore();
    await new Promise((resolve) => this.server?.close(resolve));
    await this.removeStaleSocket();
    await appendLog("daemon.stop");
  }

  async removeStaleSocket() {
    if (process.platform === "win32") return;
    if (existsSync(socketPath())) {
      try {
        await fs.unlink(socketPath());
      } catch {
        // Ignore stale socket cleanup failures; listen will surface live conflicts.
      }
    }
  }

  handleSocket(socket) {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        this.handleLine(line, socket).catch(async (error) => {
          await appendLog("daemon.handleLine.error", { error: error instanceof Error ? error.message : String(error) });
          socket.write(`${JSON.stringify({ ok: false, error: String(error?.message || error) })}\n`);
        });
      }
    });
  }

  async handleLine(line, socket) {
    if (!line.trim()) return;
    const parsed = JSON.parse(line);
    const event = createEvent(parsed);

    if (event.event === "status") {
      socket.write(`${JSON.stringify({ ok: true, status: await this.status() })}\n`);
      return;
    }

    if (event.event === "shutdown") {
      socket.write(`${JSON.stringify({ ok: true })}\n`);
      setTimeout(() => this.stop().then(() => process.exit(0)), 20);
      return;
    }

    if (event.event === "pause") {
      this.paused = true;
      await this.pausedStore.setPaused(true);
      await this.restore();
      await appendLog("nocturne.paused");
      socket.write(`${JSON.stringify({ ok: true, paused: true })}\n`);
      return;
    }

    if (event.event === "resume") {
      this.paused = false;
      await this.pausedStore.setPaused(false);
      await appendLog("nocturne.resumed");
      socket.write(`${JSON.stringify({ ok: true, paused: false })}\n`);
      return;
    }

    // When paused, drop all agent events so agent hooks cannot revive the light.
    // restore/idle/status/shutdown/pause/resume are still honoured above.
    if (this.paused) {
      socket.write(`${JSON.stringify({ ok: true, ignored: "paused" })}\n`);
      return;
    }

    if (!this.config.enabled && event.event !== "restore" && event.event !== "idle") {
      socket.write(`${JSON.stringify({ ok: true, ignored: "disabled" })}\n`);
      return;
    }

    if (event.agent && this.config.agents?.[event.agent]?.enabled === false) {
      socket.write(`${JSON.stringify({ ok: true, ignored: `agent disabled: ${event.agent}` })}\n`);
      return;
    }

    if (event.event === "restore") {
      this.machine.apply(event);
      await this.restore();
      socket.write(`${JSON.stringify({ ok: true })}\n`);
      return;
    }

    this.machine.apply(event);
    this.wakeRenderLoop();
    await appendLog("event", { event: event.event, agent: event.agent, sessionId: event.sessionId, toolName: event.toolName, message: event.message });
    socket.write(`${JSON.stringify({ ok: true })}\n`);
  }

  startRenderLoop() {
    if (this.loopRunning) return;
    this.loopRunning = true;
    this.scheduleRender(0);
  }

  wakeRenderLoop() {
    if (!this.loopRunning) return;
    if (this.renderInFlight) {
      this.renderPending = true;
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.scheduleRender(0);
  }

  scheduleRender(delayMs) {
    if (!this.loopRunning || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.renderAndSchedule().catch(() => {});
    }, delayMs);
    this.timer.unref?.();
  }

  async renderAndSchedule() {
    if (this.renderInFlight) {
      this.renderPending = true;
      return;
    }

    this.renderInFlight = true;
    try {
      await this.renderTick();
    } catch (error) {
      await appendLog("render.error", { error: error instanceof Error ? error.message : String(error) }).catch(() => {});
    } finally {
      this.renderInFlight = false;
      if (this.loopRunning) {
        const delay = this.renderPending
          ? 0
          : this.machine.visible().state === "idle" ? IDLE_TICK_MS : ACTIVE_TICK_MS;
        this.renderPending = false;
        this.scheduleRender(delay);
      }
    }
  }

  async renderTick(now = Date.now()) {
    const visual = this.machine.visible(now);

    // Paused: keep the keyboard at the user's baseline and do not animate.
    if (this.paused) {
      if (this.lastBrightness !== this.baseline) {
        await this.restore();
      }
      this.previousVisualState = "idle";
      return;
    }

    if (visual.state === "idle") {
      if (this.previousVisualState !== "idle") {
        await this.restore();
        this.lastBaselineCheckAt = now;
      } else if (now - this.lastBaselineCheckAt >= IDLE_TICK_MS) {
        await this.refreshBaseline(now);
      }
      this.previousVisualState = "idle";
      return;
    }

    this.previousVisualState = visual.state;
    const context = {
      baseline: this.baseline,
      minBrightness: this.visibleFloor(),
      maxBrightness: this.config.maxBrightness,
      longRunning: visual.startedAt ? now - visual.startedAt > 60_000 : false,
      effects: this.config.effects,
    };
    await this.setIfChanged(brightnessForVisual(visual, now, context));
  }

  async initializeBaseline() {
    const sample = await this.safeGetBrightnessState();
    const persisted = await this.safeLoadPersistedBaseline();
    const systemOverride = sample.dimmed || sample.suppressed;

    if (systemOverride && persisted !== undefined) {
      this.baseline = persisted;
      this.baselineSource = "persisted";
    } else {
      this.baseline = sample.brightness;
      this.baselineSource = "hardware";
      if (!systemOverride) await this.safePersistBaseline(this.baseline);
    }

    this.baselineSampleIgnored = systemOverride;
    this.lastBrightness = sample.brightness;
    this.lastBaselineCheckAt = Date.now();
  }

  async refreshBaseline(now = Date.now()) {
    this.lastBaselineCheckAt = now;
    try {
      const sample = await this.getBrightnessState();
      if (sample.dimmed || sample.suppressed) {
        if (!this.baselineSampleIgnored) {
          await appendLog("baseline.ignored", {
            brightness: sample.brightness,
            dimmed: sample.dimmed,
            suppressed: sample.suppressed,
          });
        }
        this.baselineSampleIgnored = true;
        this.lastBrightness = sample.brightness;
        return;
      }

      this.baselineSampleIgnored = false;
      const current = sample.brightness;
      if (Math.abs(current - this.baseline) < EPSILON) return;
      this.baseline = current;
      this.baselineSource = "hardware";
      this.lastBrightness = current;
      await this.safePersistBaseline(current);
      await appendLog("baseline.updated", { baseline: current });
    } catch (error) {
      await appendLog("baseline.refresh.failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  visibleFloor() {
    if (this.config.respectKeyboardOff && this.baseline === 0) return 0;
    return this.config.minBrightness;
  }

  async setIfChanged(value) {
    const brightness = normalizeBrightness(value);
    if (this.lastBrightness !== undefined && Math.abs(this.lastBrightness - brightness) < EPSILON) return;
    this.lastBrightness = brightness;
    await this.backend.setBrightness(brightness);
  }

  async restore() {
    await this.backend.setBrightness(this.baseline);
    this.lastBrightness = this.baseline;
  }

  async getBrightnessState() {
    if (typeof this.backend.getBrightnessState === "function") {
      const state = await this.backend.getBrightnessState();
      return {
        brightness: normalizeBrightness(state.brightness),
        dimmed: state.dimmed === true,
        suppressed: state.suppressed === true,
      };
    }
    return {
      brightness: normalizeBrightness(await this.backend.getBrightness()),
      dimmed: false,
      suppressed: false,
    };
  }

  async safeGetBrightnessState() {
    try {
      return await this.getBrightnessState();
    } catch (error) {
      await appendLog("backend.getBrightness.failed", { error: error instanceof Error ? error.message : String(error) });
      return { brightness: 0.5, dimmed: false, suppressed: false };
    }
  }

  async safeLoadPersistedBaseline() {
    try {
      const value = await this.baselineStore.load();
      return Number.isFinite(value) ? normalizeBrightness(value) : undefined;
    } catch (error) {
      await appendLog("baseline.load.failed", { error: error instanceof Error ? error.message : String(error) });
      return undefined;
    }
  }

  async safePersistBaseline(value) {
    try {
      await this.baselineStore.save(normalizeBrightness(value));
    } catch (error) {
      await appendLog("baseline.persist.failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  async status() {
    return {
      pid: process.pid,
      socketPath: socketPath(),
      backend: this.backend.name,
      baseline: this.baseline,
      baselineSource: this.baselineSource,
      lastBrightness: this.lastBrightness,
      uptimeMs: Date.now() - this.startedAt,
      paused: this.paused,
      machine: this.machine.snapshot(),
      config: {
        enabled: this.config.enabled,
        backend: this.config.backend,
        minBrightness: this.config.minBrightness,
        maxBrightness: this.config.maxBrightness,
        respectKeyboardOff: this.config.respectKeyboardOff,
        effects: this.config.effects,
      },
    };
  }
}

function createFileBaselineStore() {
  return {
    async load() {
      if (!existsSync(baselinePath())) return undefined;
      const parsed = JSON.parse(await fs.readFile(baselinePath(), "utf8"));
      return parsed.brightness;
    },
    async save(brightness) {
      const target = baselinePath();
      const temporary = `${target}.${process.pid}.tmp`;
      await fs.writeFile(temporary, `${JSON.stringify({ version: 1, brightness }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await fs.rename(temporary, target);
    },
  };
}

function createFilePausedStore() {
  return {
    isPaused,
    setPaused,
  };
}

export async function runDaemon() {
  const daemon = new AgentLightDaemon();
  await daemon.start();

  const stop = () => daemon.stop().then(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  process.on("SIGHUP", stop);
}
