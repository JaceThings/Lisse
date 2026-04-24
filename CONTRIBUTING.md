# Contributing to Lisse

Thanks for your interest in Lisse. This guide covers how to set up the project locally, the commands you'll use day to day, and the process for getting changes merged and released.

Please read our [Code of Conduct](./CODE_OF_CONDUCT.md) before participating.

## Development environment

- Node.js `>=18`
- pnpm (this repo uses pnpm workspaces; install it via `corepack enable` or from [pnpm.io](https://pnpm.io/installation))

Clone the repo and install dependencies:

```sh
pnpm install
```

## Commands

Run these from the repo root:

- `pnpm typecheck` -- type-check every package with TypeScript
- `pnpm test` -- run the Vitest suite
- `pnpm build` -- build every package under `packages/*`
- `pnpm bench` -- run performance benchmarks (not wired up yet; coming soon)

Run a script in a single package with `pnpm --filter @lisse/core <script>`.

## Branch naming

Use one of the following prefixes so the intent of a branch is clear at a glance:

- `feat/` -- a new feature or capability
- `fix/` -- a bug fix
- `docs/` -- documentation-only changes
- `chore/` -- tooling, config, or dependency work
- `perf/` -- performance work that doesn't change behaviour

Example: `feat/per-corner-shadow-blur`.

## Changesets

Lisse uses [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs.

Whenever your PR changes code that ships to users (anything under `packages/*` that isn't purely internal), add a changeset:

```sh
pnpm changeset
```

Choose the bump type for each affected package:

- **patch** -- bug fixes, internal refactors, docs inside a package
- **minor** -- new features, new APIs, new exports (backwards compatible)
- **major** -- breaking changes to a public API

### Lockstep versioning

The four published packages move together. `.changeset/config.json` groups `@lisse/core`, `@lisse/react`, `@lisse/vue`, and `@lisse/svelte` under `linked`, so when any one of them gets a bump, they all release at the same version. Pick the highest bump type that applies to any package in your change and Changesets will carry the rest along.

Skip the changeset only for PRs that don't affect published output (CI config, repo-level docs, tests, internal tooling).

## Pull request process

1. Open a PR against `main` once your branch is ready.
2. In the description, cover:
   - **What** changed and **why**
   - A **test plan**: the commands you ran and what you verified manually
   - Any follow-ups or known limitations
3. Make sure `pnpm typecheck`, `pnpm test`, and `pnpm build` all pass locally.
4. Add a changeset if your change touches a published package.
5. By contributing you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

A maintainer will review, request changes if needed, and merge once CI is green.

## Release flow

1. PRs are merged into `main`.
2. The Changesets bot opens (or updates) a `chore: version packages` PR that consumes pending changesets, bumps versions, and updates changelogs.
3. Merging that version-packages PR triggers the release workflow.
4. Publishing to npm happens via OIDC trusted publishing -- no long-lived tokens involved.

## Style notes

- British spellings in prose where it's natural (colour, behaviour, organisation).
- Prefer `--` to em-dashes when writing plain text.
- Keep docs plain and direct; skip marketing adjectives.

Questions? Open a discussion or reach out at hi@ja.mt.
