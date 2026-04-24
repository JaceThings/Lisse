#!/usr/bin/env tsx
/**
 * Regenerates the root CHANGELOG.md from per-package changelogs.
 *
 * - Reads `packages/<name>/CHANGELOG.md` for every workspace package.
 * - Parses H2 headings (`## <version>`) and groups entries by version.
 * - Writes the root `CHANGELOG.md` with one section per version, each listing
 *   the packages released at that version with a link to their per-package
 *   changelog anchor and a one-line summary.
 *
 * Idempotent: running twice produces identical output.
 *
 * Run with: `pnpm tsx scripts/update-root-changelog.ts`.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const packagesDir = join(repoRoot, "packages");
const rootChangelogPath = join(repoRoot, "CHANGELOG.md");

interface PackageVersionEntry {
  packageName: string;
  packageDir: string;
  version: string;
  body: string;
}

/** Known release dates keyed by version (YYYY-MM-DD, UTC). */
const RELEASE_DATES: Record<string, string> = {
  "0.3.0": "2026-04-24",
  "0.2.0": "2026-04-24",
  "0.1.0": "2026-04-23",
};

/** Slugify a version string to match GitHub's anchor-id rules. */
function versionAnchor(version: string): string {
  return version.replace(/\./g, "");
}

/** Read `name` from a package.json. */
function readPackageName(packageDir: string): string | null {
  const pkgJsonPath = join(packageDir, "package.json");
  if (!existsSync(pkgJsonPath)) return null;
  const raw = readFileSync(pkgJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { name?: string };
  return parsed.name ?? null;
}

/**
 * Parse a changesets-style CHANGELOG into a list of version entries.
 * Splits on `## <version>` H2 headings. Source-file ordering is preserved.
 */
function parseChangelog(markdown: string): Array<{ version: string; body: string }> {
  const lines = markdown.split("\n");
  const entries: Array<{ version: string; body: string }> = [];
  let current: { version: string; body: string[] } | null = null;
  const h2Pattern = /^##\s+(\d+\.\d+\.\d+(?:[-+][\w.]+)?)\s*$/;

  for (const line of lines) {
    const match = line.match(h2Pattern);
    if (match) {
      if (current) {
        entries.push({ version: current.version, body: current.body.join("\n").trim() });
      }
      current = { version: match[1], body: [] };
      continue;
    }
    if (current) {
      current.body.push(line);
    }
  }
  if (current) {
    entries.push({ version: current.version, body: current.body.join("\n").trim() });
  }
  return entries;
}

/**
 * Produce a concise one-line summary from a per-package changelog body for one
 * version. Strategy:
 *
 * - If the body contains only `Updated dependencies` patch notes, return
 *   "Version bump only (lockstep).".
 * - Otherwise take the first bullet that is not an `Updated dependencies`
 *   entry, drop its changeset-hash prefix, and return its first sentence.
 */
function summariseBody(body: string): string {
  // Collect top-level bullets (lines beginning with "- " at column 0).
  const lines = body.split("\n");
  const bullets: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    if (/^-\s/.test(line)) {
      if (buf.length) bullets.push(buf.join("\n"));
      buf = [line];
    } else if (buf.length) {
      // Continuation of the current bullet (indented content, blank lines).
      buf.push(line);
    }
  }
  if (buf.length) bullets.push(buf.join("\n"));

  const meaningful = bullets.filter((b) => !/^-\s+Updated dependencies/i.test(b));

  if (meaningful.length === 0) {
    return "Version bump only (lockstep).";
  }

  const first = meaningful[0];
  // Strip leading "- ", optional `<hash>:` prefix, trim.
  let text = first.replace(/^-\s+/, "").trim();
  text = text.replace(/^\*\*?[Bb]reaking\*\*?:\s*/, "Breaking: ");
  text = text.replace(/^[0-9a-f]{7,40}:\s*/, "");

  // Take the first paragraph (stop at blank line) so code blocks are skipped.
  const paragraph = text.split(/\n\s*\n/)[0];

  // Flatten internal newlines and collapse whitespace.
  const flat = paragraph.replace(/\s+/g, " ").trim();

  // First sentence: up to the first ". " followed by a capital letter, or end.
  const sentenceMatch = flat.match(/^(.+?[.!?])(?:\s+[A-Z`]|\s*$)/);
  let summary = sentenceMatch ? sentenceMatch[1] : flat;

  // Guarantee terminal punctuation.
  if (!/[.!?]$/.test(summary)) summary += ".";
  return summary;
}

function collectEntries(): PackageVersionEntry[] {
  const entries: PackageVersionEntry[] = [];
  const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(packagesDir, d.name))
    .sort();

  for (const packageDir of packageDirs) {
    const changelogPath = join(packageDir, "CHANGELOG.md");
    if (!existsSync(changelogPath)) continue;
    const packageName = readPackageName(packageDir);
    if (!packageName) continue;
    const markdown = readFileSync(changelogPath, "utf8");
    for (const { version, body } of parseChangelog(markdown)) {
      entries.push({ packageName, packageDir, version, body });
    }
  }
  return entries;
}

/** Compare two semver-ish versions; returns >0 if a > b. */
function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split(/[.+-]/).map((p) => (/^\d+$/.test(p) ? Number(p) : p));
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai === bi) continue;
    if (typeof ai === "number" && typeof bi === "number") return ai - bi;
    return String(ai) < String(bi) ? -1 : 1;
  }
  return 0;
}

/** Stable package ordering preferred in the root changelog. */
const PACKAGE_ORDER = ["@lisse/react", "@lisse/vue", "@lisse/svelte", "@lisse/core"];

function comparePackages(a: string, b: string): number {
  const ia = PACKAGE_ORDER.indexOf(a);
  const ib = PACKAGE_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

function render(entries: PackageVersionEntry[]): string {
  const byVersion = new Map<string, PackageVersionEntry[]>();
  for (const entry of entries) {
    const list = byVersion.get(entry.version) ?? [];
    list.push(entry);
    byVersion.set(entry.version, list);
  }

  const versions = [...byVersion.keys()].sort((a, b) => compareVersions(b, a));

  const out: string[] = [];
  out.push("# Changelog");
  out.push("");
  out.push(
    "Aggregate release notes across the `@lisse/*` packages. Per-package detail lives in each package's own `CHANGELOG.md`.",
  );
  out.push("");
  out.push("<!-- This file is generated by scripts/update-root-changelog.ts. Do not edit by hand. -->");
  out.push("");

  for (const version of versions) {
    const date = RELEASE_DATES[version];
    const header = date ? `## ${version} (${date})` : `## ${version}`;
    out.push(header);
    out.push("");

    const packages = (byVersion.get(version) ?? [])
      .slice()
      .sort((a, b) => comparePackages(a.packageName, b.packageName));

    for (const entry of packages) {
      const rel = entry.packageDir
        .replace(repoRoot, "")
        .replace(/^\/+/, "")
        .split(/[/\\]/)
        .join("/");
      const link = `./${rel}/CHANGELOG.md#${versionAnchor(entry.version)}`;
      const summary = summariseBody(entry.body);
      out.push(`- [${entry.packageName}](${link}) -- ${summary}`);
    }
    out.push("");
  }

  return out.join("\n").replace(/\n+$/, "\n");
}

function main(): void {
  const entries = collectEntries();
  const markdown = render(entries);
  writeFileSync(rootChangelogPath, markdown, "utf8");
}

main();
