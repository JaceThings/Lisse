// Validation gate for translated message catalogs. Run in CI and before any
// per-language PR merges (`pnpm --filter website validate:translations`).
//
// For every messages/<locale>.json other than the English source it asserts:
//   1. valid JSON with the inlang $schema,
//   2. key set is IDENTICAL to en.json (no missing or extra keys),
//   3. every {placeholder} in the English value is preserved (same set),
//   4. do-not-translate tokens present in the English value are preserved
//      verbatim in the translation (brand, coined terms, code, product names).
// Exits non-zero with a grouped report on any failure. With only en.json present
// (the base infrastructure state) it passes trivially.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const messagesDir = fileURLToPath(new URL("../messages/", import.meta.url));
const dntPath = fileURLToPath(
  new URL("../i18n/do-not-translate.json", import.meta.url),
);

const SOURCE = "en";

type Catalog = Record<string, unknown>;

const placeholders = (value: string): Set<string> =>
  new Set(value.match(/\{[^}]*\}/g) ?? []);

function readCatalog(file: string): Catalog {
  return JSON.parse(readFileSync(messagesDir + file, "utf8")) as Catalog;
}

const dnt = JSON.parse(readFileSync(dntPath, "utf8")) as { tokens: string[] };
const source = readCatalog(`${SOURCE}.json`);
const sourceKeys = Object.keys(source).filter((k) => k !== "$schema");

const localeFiles = readdirSync(messagesDir).filter(
  (f) => f.endsWith(".json") && f !== `${SOURCE}.json`,
);

let totalErrors = 0;

for (const file of localeFiles) {
  const locale = file.replace(/\.json$/, "");
  const errors: string[] = [];

  let catalog: Catalog;
  try {
    catalog = readCatalog(file);
  } catch (e) {
    console.error(`\n✗ ${locale}: invalid JSON — ${(e as Error).message}`);
    totalErrors++;
    continue;
  }

  if (typeof catalog.$schema !== "string") {
    errors.push("missing $schema");
  }

  const localeKeys = Object.keys(catalog).filter((k) => k !== "$schema");
  const localeSet = new Set(localeKeys);
  const sourceSet = new Set(sourceKeys);

  const missing = sourceKeys.filter((k) => !localeSet.has(k));
  const extra = localeKeys.filter((k) => !sourceSet.has(k));
  if (missing.length)
    errors.push(`missing ${missing.length} key(s): ${missing.join(", ")}`);
  if (extra.length)
    errors.push(`unknown ${extra.length} key(s): ${extra.join(", ")}`);

  for (const key of sourceKeys) {
    if (!localeSet.has(key)) continue;
    const en = String(source[key] ?? "");
    const tr = String(catalog[key] ?? "");

    const enPh = placeholders(en);
    const trPh = placeholders(tr);
    const lostPh = [...enPh].filter((p) => !trPh.has(p));
    const addedPh = [...trPh].filter((p) => !enPh.has(p));
    if (lostPh.length || addedPh.length) {
      errors.push(
        `${key}: placeholder mismatch (missing ${JSON.stringify(lostPh)}, extra ${JSON.stringify(addedPh)})`,
      );
    }

    const droppedTokens = dnt.tokens.filter(
      (tok) => en.includes(tok) && !tr.includes(tok),
    );
    if (droppedTokens.length) {
      errors.push(
        `${key}: do-not-translate token(s) altered/dropped: ${droppedTokens.join(", ")}`,
      );
    }
  }

  if (errors.length) {
    totalErrors += errors.length;
    console.error(`\n✗ ${locale} (${localeKeys.length} keys) — ${errors.length} issue(s):`);
    for (const e of errors) console.error(`    • ${e}`);
  } else {
    console.log(`✓ ${locale} (${localeKeys.length} keys) — valid`);
  }
}

if (localeFiles.length === 0) {
  console.log(
    `No translated locales yet (only ${SOURCE}.json). Source has ${sourceKeys.length} keys.`,
  );
}

if (totalErrors > 0) {
  console.error(`\nTranslation validation FAILED with ${totalErrors} issue(s).`);
  process.exit(1);
}
console.log(`\nTranslation validation passed.`);
