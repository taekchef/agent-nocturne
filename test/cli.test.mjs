import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const bin = fileURLToPath(new URL("../bin/nocturne.mjs", import.meta.url));
const legacyBin = fileURLToPath(new URL("../bin/agent-light.mjs", import.meta.url));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("both CLI names report the package version", async () => {
  for (const command of [bin, legacyBin]) {
    const { stdout, stderr } = await execFileAsync(process.execPath, [command, "--version"]);
    assert.equal(stdout.trim(), packageJson.version);
    assert.equal(stderr, "");
  }
});

test("--help documents the public command surface", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [bin, "--help"]);
  assert.match(stdout, /Agent Nocturne/);
  assert.match(stdout, /nocturne notify/);
  assert.match(stdout, /nocturne restore/);
  assert.match(stdout, /nocturne daemon/);
  assert.match(stdout, /Compatibility alias: agent-light/);
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
