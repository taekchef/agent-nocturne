import fs from "node:fs/promises";
import { ensureDirs } from "./config.mjs";
import { logPath } from "./protocol.mjs";

export async function appendLog(message, details) {
  await ensureDirs();
  const timestamp = new Date().toISOString();
  const suffix = details === undefined ? "" : ` ${safeJson(details)}`;
  await fs.appendFile(logPath(), `[${timestamp}] ${message}${suffix}\n`, "utf8");
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
