#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../site/", import.meta.url));
const required = [
  "index.html",
  "language/index.html",
  "install/index.html",
  "zh/index.html",
  "zh/language/index.html",
  "zh/install/index.html",
  "404.html",
  "styles.css",
  "app.js",
  "og.png",
  "keyboard.png",
  "sitemap.xml",
  "robots.txt",
  ".nojekyll",
];

for (const relative of required) await fs.access(path.join(root, relative));

const htmlFiles = (await walk(root)).filter((file) => file.endsWith(".html"));
const errors = [];
for (const file of htmlFiles) {
  const html = await fs.readFile(file, "utf8");
  const relative = path.relative(root, file);
  if (!/<html lang="(?:en|zh-CN)">/.test(html)) errors.push(`${relative}: missing supported lang`);
  if (!html.includes('href="#main-content"')) errors.push(`${relative}: missing skip link`);
  if (!html.includes('id="main-content"')) errors.push(`${relative}: missing main-content target`);
  if (/[—–]/.test(html)) errors.push(`${relative}: forbidden dash character`);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const link = match[1];
    if (link.startsWith("http://") || link.startsWith("https://") || link.startsWith("/")) continue;
    const [pathname, fragment] = link.split("#", 2);
    if (!pathname) {
      if (fragment && !html.includes(`id="${fragment}"`)) errors.push(`${relative}: missing fragment ${link}`);
      continue;
    }
    let target = path.resolve(path.dirname(file), pathname);
    if (pathname.endsWith("/")) target = path.join(target, "index.html");
    try {
      const stat = await fs.stat(target);
      if (stat.isDirectory()) target = path.join(target, "index.html");
      await fs.access(target);
      if (fragment && target.endsWith(".html")) {
        const targetHtml = await fs.readFile(target, "utf8");
        if (!targetHtml.includes(`id="${fragment}"`)) errors.push(`${relative}: missing target fragment ${link}`);
      }
    } catch {
      errors.push(`${relative}: broken local link ${link}`);
    }
  }
}

for (const relative of ["index.html", "zh/index.html"]) {
  const html = await fs.readFile(path.join(root, relative), "utf8");
  if (!html.includes("data-keyboard")) errors.push(`${relative}: hero keyboard missing`);
  if (!html.includes("hero-demo")) errors.push(`${relative}: hero demo missing`);
}

const css = await fs.readFile(path.join(root, "styles.css"), "utf8");
const js = await fs.readFile(path.join(root, "app.js"), "utf8");
for (const [name, content] of [["styles.css", css], ["app.js", js]]) {
  if (/[—–]/.test(content)) errors.push(`${name}: forbidden dash character`);
}
for (const pattern of [/gradient/i, /backdrop-filter/i, /transition:\s*all/i, /prefers-color-scheme:\s*dark/i]) {
  if (pattern.test(css)) errors.push(`styles.css: forbidden pattern ${pattern}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`site check passed: ${htmlFiles.length} HTML files, bilingual routes, local links, and visual bans`);

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}
