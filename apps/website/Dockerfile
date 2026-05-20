# syntax=docker/dockerfile:1.7
# Multistage build for the corne.rs landing site.
#
# Stage 1: install workspace deps + build @lisse/* + the website.
# Stage 2: serve the static `dist/` folder via nginx.

ARG NODE_VERSION=20-bookworm-slim
ARG NGINX_VERSION=1.27-alpine

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

# Now bring in the rest of the source. README.md is read by the
# website's prebuild script (scripts/build-llms-full.ts) when generating
# public/llms-full.txt, so it has to be present in the build context.
COPY packages packages
COPY apps/website apps/website
COPY README.md ./

# Build the workspace packages so the website resolves @lisse/react via
# their `dist/` outputs, then build the website itself.
RUN pnpm -r --filter "./packages/*" build \
    && pnpm --filter website build

# ---------- runtime ----------
FROM nginx:${NGINX_VERSION} AS runtime

# SPA-friendly nginx config: serve dist/ and fall back to index.html.
RUN rm /etc/nginx/conf.d/default.conf
COPY apps/website/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /workspace/apps/website/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
