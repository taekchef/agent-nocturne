import { normalizeBrightness } from "./protocol.mjs";

const TWO_PI = Math.PI * 2;

export const PRIORITY = Object.freeze({
  permission: 110,
  "waiting-input": 105,
  error: 100,
  blocked: 90,
  "tool-error": 80,
  "tool-start": 76,
  tool: 75,
  compact: 65,
  background: 55,
  done: 50,
  cancelled: 50,
  thinking: 40,
  notification: 10,
  startup: 5,
  idle: 0,
});

export const ONE_SHOT_DURATIONS = Object.freeze({
  startup: 260,
  "tool-start": 460,
  "tool-error": 560,
  notification: 420,
  done: 1200,
  error: 760,
  cancelled: 620,
});

export function brightnessForVisual(visual, now, context) {
  const state = visual?.state || "idle";
  const elapsed = Math.max(0, now - (visual?.startedAt ?? now));
  const { minBrightness, maxBrightness, baseline, longRunning, effects } = context;
  const floor = minBrightness;
  const cap = maxBrightness;

  switch (state) {
    case "startup":
      return softPulse(elapsed, 260, floor, Math.min(cap, 0.35));
    case "thinking": {
      // Real MacBook keyboard backlight fades are subtle; use deep contrast, but
      // keep the cadence calm so thinking does not feel like an alert.
      const low = Math.max(floor, longRunning ? 0.04 : 0.02);
      const high = longRunning ? Math.min(cap, 0.56) : Math.min(cap, 0.80);
      const period = configuredNumber(effects, "thinking", "periodMs", 4800, 1200, 15_000);
      return breath(elapsed, period, low, Math.max(low, high));
    }
    case "tool-start":
      // Acknowledge entry into a tool batch once; parallel tools do not replay it.
      return softPulse(elapsed, 460, Math.max(floor, baseline * 0.45), Math.min(cap, 0.42));
    case "tool-error":
      // Recoverable tool failures are a muted hiccup, not a terminal alarm.
      return mutedHiccup(elapsed, 560, Math.max(floor, 0.08), Math.min(cap, Math.max(baseline, 0.30)));
    case "tool": {
      const period = configuredNumber(effects, "tool", "periodMs", 1800, 600, 10_000);
      return sine(elapsed, period, Math.max(floor, 0.10), Math.min(cap, 0.32));
    }
    case "permission": {
      const period = configuredNumber(effects, "permission", "periodMs", 540, 240, 3000);
      const reminderPeriod = configuredNumber(effects, "permission", "reminderPeriodMs", 2000, 800, 10_000);
      return permissionBlink(elapsed, floor, cap, period, reminderPeriod);
    }
    case "waiting-input":
      return reminderDoubleTap(elapsed, 2500, Math.max(floor, 0.10), Math.min(cap, 0.65));
    case "notification":
      return softPulse(elapsed, 520, Math.max(floor, baseline * 0.35), Math.min(cap, 0.55));
    case "blocked":
      return heartbeat(elapsed, 5000, Math.max(floor, 0.08), Math.min(cap, 0.45));
    case "compact":
      return sine(elapsed, 3000, Math.max(floor, 0.06), Math.min(cap, 0.30));
    case "background":
      return heartbeat(elapsed, 3000, Math.max(floor, 0.06), Math.min(cap, 0.35));
    case "done": {
      const pulses = configuredNumber(effects, "done", "pulses", 1, 1, 3, true);
      const low = Math.max(floor, baseline * 0.55);
      const high = Math.min(cap, 0.52);
      return pulses === 1
        ? completionExhale(elapsed, 1200, low, high)
        : repeatedSoftPulse(elapsed, 1200, pulses, low, high);
    }
    case "error": {
      const pulses = configuredNumber(effects, "error", "pulses", 4, 1, 4, true);
      return stutter(elapsed, pulses, 90, 90, floor, Math.min(cap, 0.9));
    }
    case "cancelled":
      return cancelFade(elapsed, 620, baseline, floor);
    case "idle":
    default:
      return baseline;
  }
}

export function clampVisualBrightness(value, config) {
  return normalizeBrightness(Math.max(0, Math.min(config.maxBrightness ?? 1, value)));
}

function sine(elapsed, periodMs, low, high) {
  const phase = (elapsed % periodMs) / periodMs;
  const amount = (Math.sin(phase * TWO_PI - Math.PI / 2) + 1) / 2;
  return normalizeBrightness(low + (high - low) * amount);
}

function breath(elapsed, periodMs, low, high) {
  const phase = (elapsed % periodMs) / periodMs;
  // More human than a sine wave: inhale, slight hold, slower exhale, slight rest.
  if (phase < 0.38) {
    return normalizeBrightness(low + (high - low) * easeInOut(phase / 0.38));
  }
  if (phase < 0.50) return normalizeBrightness(high);
  if (phase < 0.92) {
    return normalizeBrightness(high - (high - low) * easeInOut((phase - 0.50) / 0.42));
  }
  return normalizeBrightness(low);
}

function easeInOut(x) {
  return x * x * (3 - 2 * x);
}

function softPulse(elapsed, duration, low, high) {
  const x = Math.min(1, elapsed / duration);
  const amount = Math.sin(Math.PI * x);
  return normalizeBrightness(low + (high - low) * amount);
}

function completionExhale(elapsed, duration, low, high) {
  const phase = Math.min(1, elapsed / duration);
  if (phase < 0.25) return normalizeBrightness(low + (high - low) * easeInOut(phase / 0.25));
  if (phase < 0.35) return normalizeBrightness(high);
  return normalizeBrightness(high - (high - low) * easeInOut((phase - 0.35) / 0.65));
}

function mutedHiccup(elapsed, duration, low, high) {
  const x = Math.min(1, elapsed / duration);
  const amount = Math.sin(Math.PI * x);
  return normalizeBrightness(high - (high - low) * amount);
}

function repeatedSoftPulse(elapsed, duration, pulses, low, high) {
  const pulseDuration = duration / pulses;
  const pulseElapsed = elapsed % pulseDuration;
  return softPulse(pulseElapsed, pulseDuration, low, high);
}

function doublePulse(elapsed, low, high) {
  const slot = Math.floor(elapsed / 120);
  return slot === 0 || slot === 2 ? high : low;
}

function stutter(elapsed, pulses, onMs, offMs, low, high) {
  const cycle = onMs + offMs;
  const slot = Math.floor(elapsed / cycle);
  if (slot >= pulses) return low;
  return elapsed % cycle < onMs ? high : low;
}

function permissionBlink(elapsed, low, high, period, reminderPeriod) {
  if (elapsed < 10_000) {
    return elapsed % period < period * 0.59 ? high : low;
  }
  return heartbeat(elapsed - 10_000, reminderPeriod, low, Math.max(low, high * 0.85));
}

function reminderDoubleTap(elapsed, period, low, high) {
  const t = elapsed % period;
  if (t < 140 || (t >= 260 && t < 400)) return high;
  return low;
}

function heartbeat(elapsed, period, low, high) {
  const t = elapsed % period;
  if (t > 700) return low;
  return softPulse(t, 700, low, high);
}

function cancelFade(elapsed, duration, baseline, floor) {
  const x = Math.min(1, elapsed / duration);
  const amount = 1 - Math.sin(Math.PI * x);
  return normalizeBrightness(Math.max(floor, baseline * Math.max(0, amount)));
}

function configuredNumber(effects, state, key, fallback, min, max, integer = false) {
  const value = Number(effects?.[state]?.[key]);
  if (!Number.isFinite(value)) return fallback;
  const clamped = Math.max(min, Math.min(max, value));
  return integer ? Math.round(clamped) : clamped;
}
