// ESM smoke: import the public API of every Lisse package from the
// packed tarball install and exercise one round-trip from each. Failure
// here means a real consumer running `npm install @lisse/...` would also
// break.
import assert from "node:assert/strict";

import * as core from "@lisse/core";
import * as react from "@lisse/react";
import * as vue from "@lisse/vue";
import * as svelte from "@lisse/svelte";
import * as octane from "@lisse/octane";

// Core: generatePath returns a non-empty string when given a real config.
const path = core.generatePath(200, 100, { radius: 16, smoothing: 0.6 });
assert.equal(typeof path, "string", "generatePath must return a string");
assert.ok(path.length > 0, "generatePath must return a non-empty string");

// React: hook and component are exported.
assert.equal(typeof react.useSmoothCorners, "function", "useSmoothCorners must be a function");
assert.ok(react.SmoothCorners, "SmoothCorners React component must be exported");

// Vue: composable and component are exported.
assert.equal(typeof vue.useSmoothCorners, "function", "useSmoothCorners (vue) must be a function");
assert.ok(vue.SmoothCorners, "SmoothCorners Vue component must be exported");

// Svelte: action is exported.
assert.equal(typeof svelte.smoothCorners, "function", "smoothCorners Svelte action must be a function");

// Octane: hook and component are exported.
assert.equal(typeof octane.useSmoothCorners, "function", "useSmoothCorners (octane) must be a function");
assert.ok(octane.SmoothCorners, "SmoothCorners Octane component must be exported");

console.log("[esm-smoke] OK");
