import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { normalizeBrightness } from "../protocol.mjs";

const execFileAsync = promisify(execFile);

export class NativeBacklightBackend {
  name = "native";

  constructor(options = {}) {
    this.helperPath = options.helperPath || defaultHelperPath();
    this.timeoutMs = options.timeoutMs || 1000;
  }

  async probe() {
    if (process.platform !== "darwin") {
      return { available: false, backend: this.name, reason: "native backend requires macOS" };
    }
    if (!existsSync(this.helperPath)) {
      return { available: false, backend: this.name, reason: `native helper not built: ${this.helperPath}` };
    }
    try {
      const { stdout } = await execFileAsync(this.helperPath, ["probe"], { timeout: this.timeoutMs });
      return { available: stdout.trim() === "ok", backend: this.name };
    } catch (error) {
      return { available: false, backend: this.name, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  async getBrightness() {
    const { stdout } = await execFileAsync(this.helperPath, ["get"], { timeout: this.timeoutMs });
    const brightness = Number(stdout.trim());
    if (!Number.isFinite(brightness)) {
      throw new Error(`native helper returned invalid brightness: ${stdout.trim()}`);
    }
    return normalizeBrightness(brightness);
  }

  async getBrightnessState() {
    let stdout;
    try {
      ({ stdout } = await execFileAsync(this.helperPath, ["get-state"], { timeout: this.timeoutMs }));
    } catch {
      return { brightness: await this.getBrightness(), dimmed: false, suppressed: false };
    }
    const state = JSON.parse(stdout.trim());
    if (!Number.isFinite(state?.brightness)) {
      throw new Error(`native helper returned invalid brightness state: ${stdout.trim()}`);
    }
    return {
      brightness: normalizeBrightness(state.brightness),
      dimmed: state.dimmed === true,
      suppressed: state.suppressed === true,
    };
  }

  async setBrightness(value) {
    const brightness = normalizeBrightness(value).toFixed(4);
    await execFileAsync(this.helperPath, ["set", brightness], { timeout: this.timeoutMs });
  }
}

function defaultHelperPath() {
  const current = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(current), "..", "..", "native", "build", "agent-light-backlight");
}
