import { appendLog } from "../logger.mjs";
import { MockBacklightBackend } from "./mock.mjs";
import { NativeBacklightBackend } from "./native.mjs";

export async function createBackend(config) {
  const requested = config.backend || "auto";

  if (requested === "mock") {
    return new MockBacklightBackend();
  }

  if (requested === "native") {
    const native = new NativeBacklightBackend();
    const probe = await native.probe();
    if (!probe.available) throw new Error(probe.reason || "native backend unavailable");
    return native;
  }

  if (requested !== "auto") {
    throw new Error(`Unknown backend: ${requested}`);
  }

  const native = new NativeBacklightBackend();
  const probe = await native.probe();
  if (probe.available) return native;

  await appendLog("native backend unavailable; falling back to mock", probe);
  return new MockBacklightBackend();
}
