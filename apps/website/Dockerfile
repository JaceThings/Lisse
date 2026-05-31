# syntax=docker/dockerfile:1.7
# Multistage build for the corne.rs landing site (TanStack Start, SSR).
#
# Stage 1: install workspace deps + build @lisse/* + the website. `vite build`
#          emits .output/ — a self-contained Nitro node-server bundling the
#          SSR handler, all deps, and the static public/ + client assets.
# Stage 2: run that node server. No nginx, no static-file layer.

ARG NODE_VERSION=20-bookworm-slim

# ---------- builder ----------
FROM node:${NODE_VERSION} AS builder

# Pin pnpm explicitly — declaring it as a top-level ARG doesn't make it
# visible inside the build stage, and a bare `pnpm@` resolves to the
# latest release (currently 11.x, which needs Node 22).
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /workspace

# Copy only the lock + workspace + package manifests first so the install
# layer caches independently of source-code changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/react/package.json packages/react/
COPY packages/vue/package.json packages/vue/
COPY packages/svelte/package.json packages/svelte/
COPY benchmarks/package.json benchmarks/
COPY apps/website/package.json apps/website/

RUN pnpm install --frozen-lockfile

# Now bring in the rest of the source. README.md is read by the website's
# prebuild script (apps/website/scripts/build-llms-full.ts) when generating
# public/llms-full.txt, so it has to be present in the build context.
COPY packages packages
COPY apps/website apps/website
COPY README.md ./

# Commit SHA for the build's public/version.json (scripts/write-version.ts, run
# by the website's prebuild). Railway injects RAILWAY_GIT_COMMIT_SHA and passes
# it as a build arg to declared ARGs; a declared ARG is in scope as an env var
# for the RUN below. Unset locally (or for non-GitHub deploys) → write-version
# falls back to "dev", and the purge workflow's version poll simply times out
# and skips — fail-safe, never a broken deploy.
ARG RAILWAY_GIT_COMMIT_SHA

# Build the workspace packages so the website resolves @lisse/react via
# their `dist/` outputs, then build the website (prebuild → llms-full.txt +
# version.json; build → vite build → .output/).
RUN pnpm -r --filter "./packages/*" build \
    && pnpm --filter website build

# ---------- runtime ----------
FROM node:${NODE_VERSION} AS runtime

WORKDIR /app
ENV NODE_ENV=production

# The Nitro node-server output is self-contained — it bundles every dep into
# .output and serves public/ + hashed client assets itself. No node_modules,
# no pnpm install. public/ (favicons, og-image.png, *.webm, grid.svg, fonts/,
# robots.txt, sitemap.xml, llms.txt, generated llms-full.txt) ships inside
# .output/public and is served automatically.
COPY --from=builder /workspace/apps/website/.output ./.output

# The Nitro node-server (srvx) reads PORT and binds 0.0.0.0; Railway injects
# PORT at runtime. Default is 3000 when PORT is unset. EXPOSE is informational.
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
