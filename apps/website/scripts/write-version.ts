// Emit dist/version.json carrying the deployed commit SHA, so the post-deploy
// purge workflow (and optionally the running app) can tell when a new build is
// actually live. The SHA comes from RAILWAY_GIT_COMMIT_SHA, which Railway
// provides at build time — the Dockerfile declares it as an ARG so it reaches
// this script. Local builds (var unset) get "dev".
//
// nginx serves /version.json with `no-store`, so a poll always sees the truth.

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "dist");

const version = process.env.RAILWAY_GIT_COMMIT_SHA || "dev";
const file = join(DIST, "version.json");

await writeFile(file, `${JSON.stringify({ version })}\n`, "utf8");
console.log(`wrote ${file.replace(DIST, "dist")} -> ${version}`);
