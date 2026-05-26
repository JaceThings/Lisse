// Purge the cached HTML shells from Cloudflare's edge after a deploy.
//
// The hashed assets in /assets/ are immutable and get fresh filenames on
// every build, so they never need purging. The HTML shells, however, keep
// the same URLs (/, /what, /playground) while pointing at new asset hashes,
// so a deploy must evict them from the edge or visitors get a stale shell
// referencing bundles the new container no longer serves.
//
// Run this AFTER the new deployment is live (e.g. from a Railway deployment
// webhook or a post-deploy CI step) — purging before cutover can re-cache
// the old shell from the still-serving old container.
//
// Required env:
//   CLOUDFLARE_ZONE_ID    zone for corne.rs
//   CLOUDFLARE_API_TOKEN  token with the "Cache Purge" permission on that zone

import { CANONICAL_PATHS, SITE_ORIGIN } from "../src/lib/route-meta.ts";

const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!zoneId || !apiToken) {
  console.error(
    "missing env: set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN",
  );
  process.exit(1);
}

// Purge the canonical URLs clients actually request. nginx maps these to the
// prerendered <route>.html files internally, but Cloudflare keys its cache on
// the public URL, so that's what we evict.
const files = [...CANONICAL_PATHS].map((path) =>
  path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`,
);

const res = await fetch(
  `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files }),
  },
);

const body = (await res.json()) as {
  success: boolean;
  errors?: { code: number; message: string }[];
};

if (!res.ok || !body.success) {
  console.error(
    `cloudflare purge failed (${res.status}):`,
    JSON.stringify(body.errors ?? body),
  );
  process.exit(1);
}

console.log(`purged ${files.length} url(s) from cloudflare:`);
for (const f of files) console.log(`  ${f}`);
