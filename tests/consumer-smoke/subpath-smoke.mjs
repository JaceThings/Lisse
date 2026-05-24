// Subpath smoke: @lisse/core exports a `./path` subpath. Resolution
// failure here would mean package.json#exports got broken — a class of
// regression the source-aliased tests cannot see.
import assert from "node:assert/strict";
import * as corePath from "@lisse/core/path";

assert.ok(corePath, "core/path subpath must resolve");
// At least one symbol from the path subpath must be exported (we don't
// pin the exact symbol so this stays resilient to internal renames).
const keys = Object.keys(corePath);
assert.ok(keys.length > 0, "core/path must export at least one symbol");

console.log(`[subpath-smoke] OK (${keys.length} symbols)`);
