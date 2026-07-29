import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LOCAL_NOCTURNE_BIN = fileURLToPath(new URL("../../bin/nocturne.mjs", import.meta.url));
const NOCTURNE_BIN = process.env.NOCTURNE_BIN || process.env.AGENT_LIGHT_BIN || (existsSync(LOCAL_NOCTURNE_BIN) ? LOCAL_NOCTURNE_BIN : undefined);
const NOCTURNE_DISABLED = /^(1|true|yes|on)$/i.test(process.env.NOCTURNE_DISABLE_PI || process.env.AGENT_LIGHT_DISABLE_PI || "");

export default function (pi: ExtensionAPI) {
  let notifyQueue: Promise<unknown> = Promise.resolve();

  function fire(ctx: ExtensionContext, event: string, extra: Record<string, string | number | boolean | undefined> = {}) {
    if (NOCTURNE_DISABLED) return;

    const args = [
      ...(NOCTURNE_BIN ? [NOCTURNE_BIN] : []),
      "notify",
      event,
      "--agent",
      "pi",
      "--session",
      sessionId(ctx),
      "--cwd",
      ctx.cwd,
      "--quiet",
    ];

    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined || value === false) continue;
      args.push(`--${key}`);
      if (value !== true) args.push(String(value));
    }

    notifyQueue = notifyQueue
      .then(() => pi.exec(NOCTURNE_BIN ? process.execPath : "nocturne", args, { timeout: 1000 }))
      .catch(() => {
        // Fail open: keyboard feedback must never interrupt Pi.
      });
  }

  pi.on("agent_start", (_event, ctx) => {
    fire(ctx, "thinking");
  });

  pi.on("tool_execution_start", (event, ctx) => {
    fire(ctx, "tool-start", { tool: event.toolName });
  });

  pi.on("tool_execution_end", (event, ctx) => {
    if (event.isError) {
      fire(ctx, "tool-error", { tool: event.toolName, message: `${event.toolName} failed` });
    }
    fire(ctx, "tool-end", { tool: event.toolName });
  });

  pi.on("agent_settled", (_event, ctx) => {
    fire(ctx, "done");
  });

  pi.on("session_before_compact", (_event, ctx) => {
    fire(ctx, "compact");
  });

  pi.on("session_compact", (_event, ctx) => {
    fire(ctx, ctx.isIdle() ? "idle" : "thinking");
  });

  pi.on("session_shutdown", (_event, ctx) => {
    fire(ctx, "idle");
  });
}

function sessionId(ctx: ExtensionContext): string {
  // Pi may expose different session-file state across lifecycle/tool events in print mode.
  // Use process + cwd instead so every event from this Pi runtime lands in one daemon session.
  const source = `${process.pid}:${ctx.cwd}`;
  return createHash("sha1").update(source).digest("hex").slice(0, 16);
}
