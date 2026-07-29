import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { configPath, logDir, appSupportDir } from "./protocol.mjs";

export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  backend: "auto",
  maxBrightness: 0.8,
  minBrightness: 0.05,
  restoreOnIdle: true,
  respectKeyboardOff: false,
  quietHours: null,
  agents: {
    pi: { enabled: true },
    claude: { enabled: true },
    codex: { enabled: true },
    unknown: { enabled: true },
  },
  effects: {
    thinking: { periodMs: 4800 },
    permission: { periodMs: 540, reminderPeriodMs: 2000 },
    tool: { periodMs: 1800 },
    done: { pulses: 1 },
    error: { pulses: 4 },
  },
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeDeep(base, override) {
  if (!isObject(override)) return structuredClone(base);
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (isObject(value) && isObject(result[key])) {
      result[key] = mergeDeep(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function ensureDirs() {
  await fs.mkdir(appSupportDir(), { recursive: true });
  await fs.mkdir(logDir(), { recursive: true });
  await fs.mkdir(dirname(configPath()), { recursive: true });
}

export async function loadConfig() {
  await ensureDirs();
  let config = structuredClone(DEFAULT_CONFIG);
  if (existsSync(configPath())) {
    const raw = await fs.readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw);
    config = mergeDeep(DEFAULT_CONFIG, parsed);
  }

  const backend = process.env.NOCTURNE_BACKEND || process.env.AGENT_LIGHT_BACKEND;
  if (backend) config.backend = backend;

  const enabled = process.env.NOCTURNE_ENABLED || process.env.AGENT_LIGHT_ENABLED;
  if (enabled) {
    config.enabled = !["0", "false", "no", "off"].includes(enabled.toLowerCase());
  }

  config.maxBrightness = clampConfigNumber(config.maxBrightness, 0, 1, DEFAULT_CONFIG.maxBrightness);
  config.minBrightness = clampConfigNumber(config.minBrightness, 0, 1, DEFAULT_CONFIG.minBrightness);
  if (config.minBrightness > config.maxBrightness) {
    config.minBrightness = Math.min(config.maxBrightness, DEFAULT_CONFIG.minBrightness);
  }

  return config;
}

function clampConfigNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

export async function writeDefaultConfigIfMissing() {
  await ensureDirs();
  if (existsSync(configPath())) return false;
  await fs.writeFile(configPath(), `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf8");
  return true;
}
