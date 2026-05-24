// CJS smoke: require @lisse/core. The framework adapters are ESM-first;
// core supports CJS via dual exports and is the surface a CJS consumer
// would actually call.
const assert = require("node:assert/strict");
const core = require("@lisse/core");

const path = core.generatePath(200, 100, { radius: 16, smoothing: 0.6 });
assert.equal(typeof path, "string", "generatePath must return a string");
assert.ok(path.length > 0, "generatePath must return a non-empty string");

console.log("[cjs-smoke] OK");
