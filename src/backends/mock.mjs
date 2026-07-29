import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { appendLog } from "../logger.mjs";
import { normalizeBrightness, statePath } from "../protocol.mjs";

export class MockBacklightBackend {
  name = "mock";

  async probe() {
    return { available: true, backend: this.name };
  }

  async getBrightness() {
    try {
      if (!existsSync(statePath())) return 0.5;
      const parsed = JSON.parse(await fs.readFile(statePath(), "utf8"));
      if (Number.isFinite(parsed.mockBrightness)) return normalizeBrightness(parsed.mockBrightness);
    } catch {
      // Ignore corrupt mock state.
    }
    return 0.5;
  }

  async setBrightness(value) {
    const brightness = normalizeBrightness(value);
    let state = {};
    try {
      if (existsSync(statePath())) state = JSON.parse(await fs.readFile(statePath(), "utf8"));
    } catch {
      state = {};
    }
    state.mockBrightness = brightness;
    await fs.writeFile(statePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await appendLog("mock.setBrightness", { brightness });
  }
}
