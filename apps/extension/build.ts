import { build } from "tsup";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const dist = resolve(here, "dist");
const coreDist = resolve(repoRoot, "packages/core/dist/index.js");

// tsup bundles @lisse/core from its built output; build it if missing.
if (!existsSync(coreDist)) {
  execFileSync("pnpm", ["--filter", "@lisse/core", "build"], { cwd: repoRoot, stdio: "inherit" });
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(resolve(dist, "chrome"), { recursive: true });

// --- Bundle content + background as IIFE (no module loader in either) ---
await build({
  entry: {
    content: resolve(here, "src/content.ts"),
    background: resolve(here, "src/background.ts"),
  },
  outDir: resolve(dist, "chrome"),
  format: ["iife"],
  outExtension: () => ({ js: ".js" }),
  target: "es2020",
  platform: "browser",
  minify: true,
  dts: false,
  sourcemap: false,
  clean: false,
  splitting: false,
  silent: true,
});

// --- Icons: rasterise the on (green) / off (grey) SVGs into square,
// transparent, centred PNGs. Playwright is a root devDep. ---
const iconsDir = resolve(dist, "chrome/icons");
mkdirSync(iconsDir, { recursive: true });
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const variant of ["on", "off"] as const) {
  // Inline the markup — pages from setContent can't load file:// subresources.
  const svg = readFileSync(resolve(here, `assets/${variant}.svg`), "utf8");
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>*{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`
    );
    await page.screenshot({ path: resolve(iconsDir, `${variant}${size}.png`), omitBackground: true });
  }
}
await browser.close();

// --- Manifest (Chrome MV3) ---
// host_permissions lets the background read tab.url to derive the hostname;
// it adds no install warning beyond the existing <all_urls> content script.
const manifest: Record<string, unknown> = {
  manifest_version: 3,
  name: "Lisse",
  version: "0.1.0",
  description: "Smooth (squircle) corners on every rounded element, on any site.",
  permissions: ["storage"],
  host_permissions: ["<all_urls>"],
  action: {
    default_icon: { "16": "icons/on16.png", "32": "icons/on32.png", "48": "icons/on48.png", "128": "icons/on128.png" },
  },
  icons: { "16": "icons/on16.png", "32": "icons/on32.png", "48": "icons/on48.png", "128": "icons/on128.png" },
  background: { service_worker: "background.js" },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["content.js"],
      run_at: "document_start",
      all_frames: true,
    },
  ],
};
writeFileSync(resolve(dist, "chrome/manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

// --- Firefox: same MV3 plus a gecko id. Firefox MV3 has no service-worker
// background, so it uses a scripts background instead. ---
cpSync(resolve(dist, "chrome"), resolve(dist, "firefox"), { recursive: true });
const firefoxManifest = {
  ...manifest,
  background: { scripts: ["background.js"] },
  browser_specific_settings: { gecko: { id: "extension@corne.rs" } },
};
writeFileSync(resolve(dist, "firefox/manifest.json"), JSON.stringify(firefoxManifest, null, 2) + "\n");

// --- Userscript (Tampermonkey / Violentmonkey / Safari Userscripts) ---
const usDir = resolve(dist, "_us");
await build({
  entry: { "lisse.user": resolve(here, "src/userscript.ts") },
  outDir: usDir,
  format: ["iife"],
  outExtension: () => ({ js: ".js" }),
  target: "es2020",
  platform: "browser",
  minify: false,
  dts: false,
  sourcemap: false,
  clean: false,
  splitting: false,
  silent: true,
});
// --- Store-ready zips (zip is a macOS built-in) ---
for (const target of ["chrome", "firefox"] as const) {
  rmSync(resolve(dist, `lisse-${target}.zip`), { force: true });
  execFileSync("zip", ["-qr", resolve(dist, `lisse-${target}.zip`), "."], {
    cwd: resolve(dist, target),
  });
}

const banner = `// ==UserScript==
// @name         Lisse
// @namespace    https://corne.rs
// @version      0.1.0
// @description  Smooth (squircle) corners on every rounded element, on any site.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

`;
const body = readFileSync(resolve(usDir, "lisse.user.js"), "utf8");
writeFileSync(resolve(dist, "lisse.user.js"), banner + body);
rmSync(usDir, { recursive: true, force: true });

console.log("built dist/chrome, dist/firefox, dist/lisse.user.js");
