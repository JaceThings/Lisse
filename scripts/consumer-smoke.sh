#!/usr/bin/env bash
# Pack each public package as a tarball, lint the tarballs with publint
# and attw, install them into a fresh consumer fixture, and run the
# smoke imports. Designed to be runnable both locally (`pnpm
# consumer-smoke`) and from CI without any extra glue.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="$ROOT_DIR/tests/consumer-smoke/vendor"
FIXTURE_DIR="$ROOT_DIR/tests/consumer-smoke"

PACKAGES=("core" "react" "vue" "svelte")

echo "[consumer-smoke] cleaning previous artifacts"
rm -rf "$VENDOR_DIR"
mkdir -p "$VENDOR_DIR"
rm -rf "$FIXTURE_DIR/node_modules" "$FIXTURE_DIR/pnpm-lock.yaml"

echo "[consumer-smoke] building all packages"
pnpm -r --filter="./packages/*" build

echo "[consumer-smoke] packing tarballs"
for pkg in "${PACKAGES[@]}"; do
  PKG_DIR="$ROOT_DIR/packages/$pkg"
  ( cd "$PKG_DIR" && pnpm pack --pack-destination "$VENDOR_DIR" >/dev/null )
done
# Content-hash the filenames. pnpm's store aliases local tarballs by their
# file: spec, so a repacked tarball with the same name-version can serve
# STALE content from a warm store (CI caches the store between runs). A
# hash suffix makes every distinct build a distinct spec.
for tarball in "$VENDOR_DIR"/*.tgz; do
  HASH=$(shasum "$tarball" | cut -c1-8)
  mv "$tarball" "${tarball%.tgz}-$HASH.tgz"
done
ls "$VENDOR_DIR"

echo "[consumer-smoke] linting tarballs with publint"
for tarball in "$VENDOR_DIR"/*.tgz; do
  echo "  -> $(basename "$tarball")"
  pnpm exec publint "$tarball"
done

echo "[consumer-smoke] linting tarballs with arethetypeswrong"
# attw 0.18.x has a known crash reading our packed tarballs ("Cannot
# read properties of undefined (reading 'filename')") on Node 22 and
# Node 26 alike. Soft-fail until upstream is fixed; publint above
# still hard-fails on real packaging issues.
for tarball in "$VENDOR_DIR"/*.tgz; do
  echo "  -> $(basename "$tarball")"
  pnpm exec attw "$tarball" || echo "  (attw warnings — non-fatal pending upstream fix)"
done

echo "[consumer-smoke] pinning tarballs into the fixture manifest"
# The adapters depend on @lisse/core@<version>, which pnpm would happily
# resolve from the npm REGISTRY — silently smoking the published core
# instead of the one packed above. pnpm overrides force every resolution
# (direct and transitive) onto the local tarballs. The manifest is
# restored afterwards so the hash-suffixed specs never leak into git.
cp "$FIXTURE_DIR/package.json" "$FIXTURE_DIR/package.json.orig"
trap 'mv "$FIXTURE_DIR/package.json.orig" "$FIXTURE_DIR/package.json"' EXIT
node -e '
  const fs = require("fs");
  const [manifestPath, vendorDir] = process.argv.slice(1);
  const pkg = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  pkg.pnpm = pkg.pnpm ?? {};
  pkg.pnpm.overrides = pkg.pnpm.overrides ?? {};
  for (const tgz of fs.readdirSync(vendorDir)) {
    const name = "@lisse/" + tgz.replace(/^lisse-/, "").replace(/-\d.*$/, "");
    const spec = "file:./vendor/" + tgz;
    pkg.dependencies[name] = spec;
    pkg.pnpm.overrides[name] = spec;
  }
  fs.writeFileSync(manifestPath, JSON.stringify(pkg, null, 2) + "\n");
' "$FIXTURE_DIR/package.json" "$VENDOR_DIR"

echo "[consumer-smoke] installing fixture deps"
( cd "$FIXTURE_DIR" && pnpm install --no-frozen-lockfile --ignore-workspace )

echo "[consumer-smoke] running ESM smoke"
( cd "$FIXTURE_DIR" && node esm-smoke.mjs )

echo "[consumer-smoke] running CJS smoke"
( cd "$FIXTURE_DIR" && node cjs-smoke.cjs )

echo "[consumer-smoke] running subpath smoke"
( cd "$FIXTURE_DIR" && node subpath-smoke.mjs )

echo "[consumer-smoke] running SSR smoke"
( cd "$FIXTURE_DIR" && node ssr-smoke.mjs )

echo "[consumer-smoke] all checks passed"
