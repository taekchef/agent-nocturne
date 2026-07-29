import assert from "node:assert/strict";
import test from "node:test";
import { brightnessForVisual } from "../src/effects.mjs";

function context(effects = {}) {
  return {
    baseline: 0.22,
    minBrightness: 0.05,
    maxBrightness: 0.8,
    longRunning: false,
    effects,
  };
}

test("thinking period is driven by effect config", () => {
  const visual = { state: "thinking", startedAt: 1_000 };
  const now = 2_520;
  const fast = brightnessForVisual(visual, now, context({ thinking: { periodMs: 4_000 } }));
  const slow = brightnessForVisual(visual, now, context({ thinking: { periodMs: 8_000 } }));
  assert.ok(fast > slow + 0.2, `expected configured periods to diverge, got ${fast} and ${slow}`);
});

test("done defaults to one long completion exhale but allows multiple pulses", () => {
  const visual = { state: "done", startedAt: 1_000 };
  const now = 1_600;
  const single = brightnessForVisual(visual, now, context({ done: { pulses: 1 } }));
  const double = brightnessForVisual(visual, now, context({ done: { pulses: 2 } }));
  assert.ok(single > double + 0.1, `expected one exhale to differ from repeated pulses, got ${single} and ${double}`);
});

test("recoverable tool error is a muted dip", () => {
  const visual = { state: "tool-error", startedAt: 1_000 };
  const start = brightnessForVisual(visual, 1_000, context());
  const middle = brightnessForVisual(visual, 1_280, context());
  assert.ok(start > middle + 0.15, `expected a visible dip, got ${start} and ${middle}`);
});

test("terminal error pulse count is driven by effect config", () => {
  const visual = { state: "error", startedAt: 1_000 };
  const now = 1_400;
  const twoPulses = brightnessForVisual(visual, now, context({ error: { pulses: 2 } }));
  const fourPulses = brightnessForVisual(visual, now, context({ error: { pulses: 4 } }));
  assert.ok(fourPulses > twoPulses + 0.5, `expected four-pulse warning to remain active, got ${fourPulses} and ${twoPulses}`);
});
