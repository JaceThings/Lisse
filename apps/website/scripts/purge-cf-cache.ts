// Purge Cloudflare's edge cache after a deploy.
//
// The website serves HTML shells (/, /what, /playground) with a long edge TTL
// while pointing at content-hashed assets that rotate every build. A deploy
// must evict those shells from the edge or visitors get a stale shell
// referencing bundles the new container no longer serves — a 404'd module that
// Firefox refuses, leaving a white screen.
//
// We PURGE EVERYTHING rather than the individual HTML URLs:
//   - purge-by-url only evicts the exact cache key it names, so if a Cache Rule
//     ever caches a route (notably the apex /) under a custom key, a url purge
//     reports success but silently misses the stored object.
//   - purge-by-host / -tag / -prefix are no longer Enterprise-only (Cloudflare's
//     "instant purge for all" rollout opened them to every plan), but they still
//     evict only their named key, so a custom Cache Rule cache key on "/" could
//     slip past them just like a url purge.
//   - purge-everything ignores cache keys and works on every plan. The hashed
//     /assets/ are immutable and content-addressed, so re-fetching them after a
//     full purge just re-caches identical bytes — a momentary origin blip on the
//     next few requests, never a correctness risk.
//
// After purging we run a non-fatal self-check: fetch the apex normally vs with
// a cache-buster and compare the asset hashes they reference. If the purge
// evicted the homepage, both serve the current shell and match; a mismatch
// means the cached apex survived the purge (the exact failure we hit before),
// and the log says so — and to check Cloudflare's Cache Rule cache key.
//
// Run this AFTER the new deployment is live (the purge workflow polls
// version.json until it reports this commit) — purging before cutover can
// re-cache the old shell from the still-serving old container.
//
// Required env:
//   CLOUDFLARE_ZONE_ID    zone for corne.rs
//   CLOUDFLARE_API_TOKEN  token with the "Cache Purge" permission on that zone

// Inlined rather than imported from src/lib/route-meta.ts: that module now pulls
// in Paraglide's generated runtime (src/paraglide/*), which doesn't exist in this
// build-free purge job (npx tsx, no install/compile). Same self-contained origin
// as scripts/build-sitemap.ts.
const SITE_ORIGIN = "https://corne.rs";

const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!zoneId || !apiToken) {
  console.error(
    "missing env: set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN",
  );
  process.exit(1);
}

const res = await fetch(
  `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ purge_everything: true }),
  },
);

const body = (await res.json()) as {
  success: boolean;
  result?: unknown;
  errors?: { code: number; message: string }[];
  messages?: { code: number; message: string }[];
};

if (!res.ok || !body.success) {
  console.error(
    `cloudflare purge failed (${res.status}):`,
    JSON.stringify(body.errors ?? body),
  );
  process.exit(1);
}

console.log("purged everything from cloudflare's edge for the zone");
// Full response so a deploy's logs always show exactly what CF reported.
console.log("cloudflare response:", JSON.stringify(body));

// --- post-purge self-check (diagnostic only, never fails the deploy) ---
// Pull the apex shell as a normal visitor (the edge-cached copy) and as a
// cache-buster (forced origin fetch), and compare which JS bundle each
// references. Equal => the edge is serving the current shell. Unequal => the
// purge did not evict the homepage object. The hash alphabet is Vite's
// base64url ([A-Za-z0-9_-]), so the char class must include - and _.
const APEX_ASSET = /assets\/index-[A-Za-z0-9_-]+\.js/;

async function apexShell(bust: boolean) {
  const url = bust
    ? `${SITE_ORIGIN}/?cb=${Date.now()}-${Math.random().toString(36).slice(2)}`
    : `${SITE_ORIGIN}/`;
  const r = await fetch(url);
  const html = await r.text();
  return {
    status: r.headers.get("cf-cache-status") ?? "?",
    age: r.headers.get("age") ?? "?",
    asset: html.match(APEX_ASSET)?.[0] ?? "(no index bundle found)",
  };
}

try {
  // Give the global purge a moment to settle before re-reading the edge.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  let cached = await apexShell(false);
  const fresh = await apexShell(true);

  // One retry to absorb purge-propagation races before crying wolf.
  if (cached.asset !== fresh.asset) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    cached = await apexShell(false);
  }

  console.log(
    `apex self-check: cached(cf=${cached.status} age=${cached.age}) -> ${cached.asset} | origin -> ${fresh.asset}`,
  );

  if (cached.asset !== fresh.asset) {
    console.warn(
      `WARNING: the cached apex still references ${cached.asset} while origin serves ${fresh.asset} — ` +
        `purge_everything did NOT evict the homepage. Inspect Cloudflare → Caching → Cache Rules for a ` +
        `custom cache key on "/" (or APO), which makes the apex un-purgeable by anything but a key/tag purge.`,
    );
  } else {
    console.log("apex verified: edge shell matches origin (purge effective)");
  }
} catch (err) {
  // The purge already succeeded; a flaky self-check must not fail the deploy.
  console.warn("apex self-check skipped (fetch failed):", String(err));
}
