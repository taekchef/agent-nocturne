#!/usr/bin/env node
import { runHostHook } from "../../../src/host-hook-runtime.mjs";

await runHostHook("codex", process.argv[2]);
