#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = path.resolve("site");
const expectedFiles = [
  ".nojekyll",
  "404.html",
  "app.js",
  "index.html",
  "keyboard.png",
  "og.png",
  "robots.txt",
  "sitemap.xml",
  "styles.css",
];
const forbiddenProductDirs = ["language", "install", "zh"];

for (const file of expectedFiles) {
  assert(fs.existsSync(path.join(root, file)), `missing site/${file}`);
}
for (const directory of forbiddenProductDirs) {
  assert(!fs.existsSync(path.join(root, directory)), `obsolete product route remains: site/${directory}`);
}

const htmlFiles = walk(root).filter((file) => file.endsWith(".html"));
assert(htmlFiles.length === 2, `expected one product page plus 404, found ${htmlFiles.length} HTML files`);

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert(new Set(ids).size === ids.length, `${relative}: duplicate id`);
  assert(/<meta name="viewport"/.test(html), `${relative}: missing viewport meta`);
  assert(/<title>[^<]+<\/title>/.test(html), `${relative}: missing title`);
  assert(!/[—–]/.test(html), `${relative}: visible dash character is forbidden`);
  assert(!/href="#"/.test(html), `${relative}: empty hash link`);

  for (const match of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const reference = match[1];
    if (/^(https?:|mailto:|data:)/.test(reference)) continue;
    if (reference.startsWith("#")) {
      assert(ids.includes(reference.slice(1)), `${relative}: missing anchor ${reference}`);
      continue;
    }
    const target = resolveLocalReference(file, reference);
    assert(fs.existsSync(target), `${relative}: broken local reference ${reference}`);
  }
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");

for (const marker of [
  'data-room-toggle',
  'data-language-toggle',
  'data-keyboard',
  'data-state-control="waiting"',
  'data-state-control="error"',
  'id="install"',
  'data-install-tab="pi"',
  'data-install-tab="claude"',
  'data-install-tab="codex"',
]) {
  assert(index.includes(marker), `index.html missing ${marker}`);
}

assert((sitemap.match(/<url>/g) || []).length === 1, "sitemap must expose only the root product page");
assert(sitemap.includes("https://taekchef.github.io/agent-nocturne/"), "sitemap missing root URL");

for (const forbidden of [
  [/gradient/i, "gradient"],
  [/backdrop-filter/i, "glass blur"],
  [/transition\s*:\s*all/i, "transition: all"],
  [/prefers-color-scheme\s*:\s*dark/i, "automatic dark theme"],
  [/#[0-9a-f]{0,2}(?:00f|00aaff|7c3aed)/i, "blue or purple accent"],
]) {
  assert(!forbidden[0].test(css), `styles.css contains forbidden ${forbidden[1]}`);
}

assert(css.includes("@property --backlight"), "missing registered global backlight channel");
assert(css.includes('html[data-room="dark"]'), "missing optional room-light mode");
for (const state of ["thinking", "tool", "permission", "waiting", "done", "error"]) {
  assert(css.includes(`data-state="${state}"`), `missing ${state} backlight animation`);
}

const keyBlock = css.match(/\.key \{([\s\S]*?)\n  \}/)?.[1] ?? "";
const legendBlock = css.match(/\.key-label \{([\s\S]*?)\n  \}/)?.[1] ?? "";
assert(keyBlock && legendBlock, "missing key physical styles");
assert(!/transform|animation/.test(keyBlock), "keycaps must not move or animate independently");
assert(!/transform|animation/.test(legendBlock), "legends must not move or animate independently");
assert(legendBlock.includes("opacity: var(--backlight)"), "legends must read the shared backlight channel");
assert(app.includes('root.dataset.room'), "app.js missing room mode state");
assert(app.includes('history.replaceState'), "app.js missing same-page language URL state");
assert(!/fetch\(|XMLHttpRequest|WebSocket|EventSource/.test(app), "site runtime must not send network requests");

for (const file of ["index.html", "404.html", "styles.css", "app.js"]) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  assert(!/https?:\/\/(?:fonts\.|use\.typekit|cdn\.|unpkg|jsdelivr)/i.test(text), `${file}: external runtime asset`);
  assert(!/(google-analytics|googletagmanager|plausible|segment\.com|mixpanel|posthog)/i.test(text), `${file}: analytics reference`);
}

console.log("site check passed: one product page, one 404, shared global backlight, and no obsolete routes");

function resolveLocalReference(sourceFile, reference) {
  const clean = reference.split(/[?#]/, 1)[0];
  if (clean.startsWith("/agent-nocturne/")) {
    const suffix = clean.slice("/agent-nocturne/".length);
    return path.join(root, suffix || "index.html");
  }
  let target = path.resolve(path.dirname(sourceFile), clean || ".");
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
  return target;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
