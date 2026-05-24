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

echo "[consumer-smoke] installing fixture deps"
( cd "$FIXTURE_DIR" && pnpm install --no-frozen-lockfile --ignore-workspace )

echo "[consumer-smoke] adding packed Lisse tarballs to fixture"
# pnpm add accepts file: specs. The tarballs glob into one add to keep
# resolution consistent.
PACK_ARGS=()
for tarball in "$VENDOR_DIR"/*.tgz; do
  PACK_ARGS+=("file:./vendor/$(basename "$tarball")")
done
( cd "$FIXTURE_DIR" && pnpm add --save-prod --ignore-workspace "${PACK_ARGS[@]}" )

echo "[consumer-smoke] running ESM smoke"
( cd "$FIXTURE_DIR" && node esm-smoke.mjs )

echo "[consumer-smoke] running CJS smoke"
( cd "$FIXTURE_DIR" && node cjs-smoke.cjs )

echo "[consumer-smoke] running subpath smoke"
( cd "$FIXTURE_DIR" && node subpath-smoke.mjs )

echo "[consumer-smoke] running SSR smoke"
( cd "$FIXTURE_DIR" && node ssr-smoke.mjs )

echo "[consumer-smoke] all checks passed"
