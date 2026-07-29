import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const claudeHook = fileURLToPath(new URL("../adapters/claude-code/scripts/hook.mjs", import.meta.url));
const codexHook = fileURLToPath(new URL("../adapters/codex/scripts/hook.mjs", import.meta.url));

test("Claude failure hook dispatches one ordered CLI batch", async (t) => {
  const fixture = await captureFixture(t);
  const payload = {
    hook_event_name: "PostToolUseFailure",
    session_id: "claude-session",
    cwd: "/tmp/project",
    tool_name: "Bash",
    error: "exit 1",
  };

  const result = await runScript(claudeHook, JSON.stringify(payload), {
    ...process.env,
    NOCTURNE_BIN: fixture.bin,
    NOCTURNE_CAPTURE: fixture.output,
  });
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");

  const args = await fixture.readArgs();
  assert.deepEqual(args.slice(0, 4), ["notify", "tool-error", "tool-end", "--agent"]);
  assert.equal(args[4], "claude");
  assert.ok(args.includes("--quiet"));
  assert.ok(args.includes("--tool"));
  assert.ok(args.includes("Bash"));
});

test("Codex hook reads hook_event_name from stdin", async (t) => {
  const fixture = await captureFixture(t);
  const result = await runScript(codexHook, JSON.stringify({
    hook_event_name: "PostToolUse",
    session_id: "codex-session",
    tool_name: "Bash",
    tool_response: { metadata: { exit_code: 0 } },
  }), {
    ...process.env,
    NOCTURNE_BIN: fixture.bin,
    NOCTURNE_CAPTURE: fixture.output,
  });
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");

  const args = await fixture.readArgs();
  assert.deepEqual(args.slice(0, 3), ["notify", "tool-end", "--agent"]);
  assert.equal(args[3], "codex");
});

test("malformed stdin and a missing CLI remain fail-open", async () => {
  for (const [script, input] of [[claudeHook, "{"], [codexHook, JSON.stringify({ hook_event_name: "Stop" })]]) {
    const result = await runScript(script, input, {
      ...process.env,
      NOCTURNE_BIN: "/definitely/missing/nocturne",
    });
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  }
});

function runScript(script, input, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`hook exited ${code}: ${stderr}`));
    });
    child.stdin.end(input);
  });
}

async function captureFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nocturne-hook-test-"));
  const bin = path.join(directory, "capture.mjs");
  const output = path.join(directory, "args.json");
  await writeFile(bin, "import fs from 'node:fs'; fs.writeFileSync(process.env.NOCTURNE_CAPTURE, JSON.stringify(process.argv.slice(2)));\n");
  t.after(() => rm(directory, { recursive: true, force: true }));

  return {
    bin,
    output,
    async readArgs() {
      const deadline = Date.now() + 2_000;
      while (Date.now() < deadline) {
        try {
          return JSON.parse(await readFile(output, "utf8"));
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      }
      throw new Error("timed out waiting for detached hook capture");
    },
  };
}
