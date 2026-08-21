#!/usr/bin/env tsx
// Build `apps/website/public/llms-full.txt` by concatenating the root
// README and each package README. Run before `vite build` (wired into
// the `prebuild` script in apps/website/package.json) so the served file
// always reflects the current source-of-truth READMEs.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const out = join(here, "..", "public", "llms-full.txt");

const sources = [
  { title: "Lisse (root)", path: "README.md" },
  { title: "@lisse/core", path: "packages/core/README.md" },
  { title: "@lisse/react", path: "packages/react/README.md" },
  { title: "@lisse/vue", path: "packages/vue/README.md" },
  { title: "@lisse/svelte", path: "packages/svelte/README.md" },
  { title: "@lisse/octane", path: "packages/octane/README.md" },
];

const header = `# Lisse — full documentation

> Concatenated package READMEs for LLM ingestion. Single-file companion to https://corne.rs/llms.txt. Generated from the corresponding source files in the GitHub repository at https://github.com/JaceThings/Lisse.

`;

let body = "";
for (const { title, path } of sources) {
  const content = await readFile(join(repoRoot, path), "utf8");
  body += `\n---\n\n# ${title}\n\n${content.trim()}\n`;
}

await writeFile(out, header + body);
console.log(`Wrote ${out}`);
