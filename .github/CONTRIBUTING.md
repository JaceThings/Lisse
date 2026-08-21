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

- `pnpm test`: run the Vitest suite
- `pnpm build`: build every package under `packages/*`
- `pnpm typecheck`: type-check every package with TypeScript
- `pnpm bench`: run performance benchmarks (not wired up yet; coming soon)

Run a script in a single package with `pnpm --filter @lisse/core <script>`.

## Branch naming

Use one of the following prefixes so the intent of a branch is clear at a glance:

- `fix/`: a bug fix
- `docs/`: documentation-only changes
- `feat/`: a new feature or capability
- `chore/`: tooling, config, or dependency work
- `perf/`: performance work that doesn't change behaviour

Example: `feat/per-corner-shadow-blur`.

## Changesets

Lisse uses [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs.

Whenever your PR changes code that ships to users (anything under `packages/*` that isn't purely internal), add a changeset:

```sh
pnpm changeset
```

Choose the bump type for each affected package:

- **major**: breaking changes to a public API
- **patch**: bug fixes, internal refactors, docs inside a package
- **minor**: new features, new APIs, new exports (backwards compatible)

### Lockstep versioning

The four published packages move together. `.changeset/config.json` groups `@lisse/core`, `@lisse/react`, `@lisse/vue`, and `@lisse/svelte` under `linked`, so when any one of them gets a bump, they all release at the same version. Pick the highest bump type that applies to any package in your change and Changesets will carry the rest along.

`@lisse/octane` is deliberately outside that group. It tracks a pre-1.0 peer, so it can need a breaking release whenever Octane ships one, and those bumps shouldn't drag the four stable packages' version along. It versions on its own, starting at `0.1.0`.

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
4. Publishing to npm happens via OIDC trusted publishing, so no long-lived tokens are involved.

## Translations (website i18n)

The website (`apps/website`, [corne.rs](https://corne.rs)) is localized with [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs). English is the source of truth; every locale lives in `apps/website/messages/<locale>.json`. Locale routing is URL-prefixed — English at the bare path (`/what`), other locales at `/<locale>/what` (e.g. `/de/what`) — and is derived from `apps/website/project.inlang/settings.json`, so the language switcher, hreflang alternates, `<html lang>`, and sitemap all expand automatically.

**Translation policy** lives in two committed files and is enforced in CI:

- `apps/website/i18n/glossary.json` — register and per-term rules.
- `apps/website/i18n/do-not-translate.json` — tokens that must appear verbatim (the brand `lisse`/`@lisse/*`, coined terms `squircle`/`superellipse`, product names, code, math). Never translate code snippets, install commands, or math formulas.

**To add a language** (one PR per language, e.g. `feat/i18n-ja`):

1. Add the BCP-47 locale to `locales` in `apps/website/project.inlang/settings.json` (single source of truth).
2. Create `apps/website/messages/<locale>.json` with the same keys as `en.json`, translating the values per the glossary/do-not-translate rules.
3. Add a translated `README.<locale>.md` and add the language to the switcher line at the top of every README.
4. Run `pnpm --filter website validate:translations` (valid JSON, identical key set, placeholders + do-not-translate tokens preserved) and `pnpm --filter website typecheck`. CI runs both.
5. Add yourself to the status table below as the locale maintainer.

| Locale | Language | Maintainer | Status |
| --- | --- | --- | --- |
| `en` | English | — | source |

## Style notes

- British spellings in prose where it's natural (colour, behaviour, organisation).
- Keep docs plain and direct; skip marketing adjectives.

Questions? Open a discussion or reach out at hi@ja.mt.
