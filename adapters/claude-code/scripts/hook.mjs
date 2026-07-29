#!/usr/bin/env node
import { runHostHook } from "../../../src/host-hook-runtime.mjs";

await runHostHook("claude", process.argv[2] || process.env.CLAUDE_HOOK_EVENT_NAME);
