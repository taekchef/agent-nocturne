import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const bin = fileURLToPath(new URL("../bin/agent-light.mjs", import.meta.url));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("--version matches package.json", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [bin, "--version"]);
  assert.equal(stdout.trim(), packageJson.version);
  assert.equal(stderr, "");
});

test("--help documents the public command surface", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [bin, "--help"]);
  assert.match(stdout, /agent-light notify/);
  assert.match(stdout, /agent-light restore/);
  assert.match(stdout, /agent-light daemon/);
  assert.equal(stderr, "");
});

test("unknown commands fail on stderr with a non-zero exit", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [bin, "not-a-command"]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Unknown command: not-a-command/);
      return true;
    },
  );
});
