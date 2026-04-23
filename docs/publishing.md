# Publishing

How to ship a new version of the four `@lisse/*` packages on npm.

## TL;DR — the normal flow

Releases are automated via GitHub Actions + OIDC trusted publishing. You never run `npm login`, never enter an OTP, never touch recovery codes.

```bash
# 1. Make your code changes
# 2. Record what changed
pnpm changeset
   # select packages → pick patch / minor / major → write a 1-line summary
# 3. Commit everything (including the generated .changeset/*.md file)
git add .
git commit -m "feat: describe the change"
git push
```

Then on GitHub:

1. The `Release` workflow (`.github/workflows/release.yml`) opens a **"chore: version packages"** PR containing version bumps + auto-generated `CHANGELOG.md` entries across the affected packages.
2. Review that PR. This is your last chance to adjust versions or the changelog text.
3. **Merge the PR.** The workflow re-runs, detects that versions were bumped, runs `changeset publish`, and pushes the new versions to npm via OIDC (with provenance badges).
4. Packages appear on `npmjs.com/package/@lisse/<name>` within ~5 minutes.

No OTP, no CLI auth, no recovery codes burned.

## One-time setup (already done)

Captured here so future-you knows what's been configured:

- **Trusted publisher** is configured on npmjs.com for each of `@lisse/core`, `@lisse/react`, `@lisse/vue`, `@lisse/svelte`. Publisher = GitHub Actions from `JaceThings/Lisse`, workflow file `release.yml`, no environment name.
- **Release workflow** at `.github/workflows/release.yml` uses `changesets/action@v1`, has `id-token: write` permission, and sets `NPM_CONFIG_PROVENANCE: "true"`.
- **`publishConfig.access: public`** is set on every package's `package.json` (scoped `@lisse/*` names publish private by default otherwise).
- **`LICENSE` is copied into each package directory** so it ships in the tarball. The root `LICENSE` alone doesn't propagate to `@scope/pkg` tarballs.
- **Root `build` script** is scoped to `./packages/*` so `pnpm build` skips the playground (which has a private `system-1` dependency).

## Pre-publish sanity checks

Before merging a "chore: version packages" PR:

```bash
pnpm test          # must be all green
pnpm typecheck     # must be clean
pnpm build         # must succeed for all 4 packages
```

CI will run these again in the release workflow, but catching failures locally saves a round-trip.

To preview exactly what will ship in each tarball:

```bash
cd packages/core && npm pack --dry-run
cd ../react && npm pack --dry-run
# etc.
```

Expected contents per package: `LICENSE`, `README.md`, `dist/*`, `package.json`. If anything else appears, something leaked — check the `files` field in `package.json`.

---

# Quirks & gotchas

Things that bit us during the first release (2026-04-23) and how to avoid re-discovering them.

## npm 2FA

### TOTP is no longer offered for new npm accounts

**Problem:** npm's 2FA settings page only lets you add a WebAuthn security key (passkey). There's no button to add an authenticator-app (TOTP) code. This was a surprise mid-publish — we expected to put a TOTP into 1Password and reuse one 6-digit code across all 4 package prompts.

**Cause:** npm deprecated TOTP enrollment for new accounts sometime before 2026-04. Existing accounts with TOTP can keep using it; new accounts are WebAuthn-only.

**Solution — short term:** Use recovery codes (saved in 1Password) when the CLI prompts for an OTP. `changeset publish` prompts once per package, so a 4-package release burns 4 recovery codes.

**Solution — long term:** Use GitHub Actions trusted publishing (already configured — see the TL;DR above). No OTP is ever requested because OIDC replaces the auth challenge entirely.

**Why passkeys don't help:** WebAuthn requires a browser-based challenge-response. The npm CLI can't trigger it, so it falls back to asking for a textual OTP. Your passkey is unreachable in a terminal session.

---

### `changeset publish` prompts for OTP once per package, not once per release

**Problem:** Publishing 4 packages = 4 OTP prompts = 4 recovery codes burned (if you don't have TOTP).

**Cause:** Changeset delegates to `npm publish` per package. Each invocation is a separate authenticated request.

**Solution:** Either set up trusted publishing (preferred — see above) or use a TOTP app where one code is valid for all 4 prompts inside a ~30-second window.

**If you're stuck mid-release with recovery codes:** Finish the publish (don't Ctrl+C mid-flight — you'll have some packages published and some not, which is messier than just burning the codes). Immediately regenerate your recovery codes at `https://www.npmjs.com/settings/jace-things/profile` → "Manage Recovery Codes".

---

### The `/dev/tty failed (6): Device not configured` message in automation

**Problem:** When `pnpm release` runs from an agent / CI / non-interactive shell and hits the OTP prompt, it dumps this error, then hangs forever:

```
Opening `/dev/tty` failed (6): Device not configured
🦋  Enter one-time password: ›
```

**Cause:** Changesets tries to open `/dev/tty` directly for the OTP prompt (bypassing stdin), which fails in headless environments. It doesn't abort — it just hangs the prompt.

**Solution:** Don't publish from non-interactive shells. Either:
- Run `pnpm release` from a regular terminal where you can type the OTP
- Or (preferred) use trusted publishing via GitHub Actions, which skips the auth prompt entirely

---

## Registry propagation

### New `@scope/*` packages 404 for 5–15 minutes after publishing

**Problem:** Immediately after a successful publish, `npm view @lisse/core` and `https://registry.npmjs.org/@lisse/core` return 404. The publish email arrives within seconds, but the registry API lags.

**Cause:** npm's public registry cache takes longer to serve brand-new scoped packages (first publish under a new scope) than it does to accept the publish. Subsequent versions under the same scope propagate much faster.

**Solution:** Wait 5–15 minutes. Check `https://www.npmjs.com/package/@lisse/core` in a browser — the web frontend usually shows packages before the registry API catches up. Don't re-run the publish; the packages ARE published, you just can't fetch them yet.

**Failure mode if misdiagnosed:** Re-running `changeset publish` immediately would fail with "You cannot publish over the previously published versions" once propagation catches up, but during the propagation window it might attempt to publish duplicates and return confusing errors.

---

## Build & workspace

### `pnpm -r build` builds the playground, which depends on a private repo

**Problem:** The playground at `/playground` depends on `system-1` (a private repo at `github:JaceThings/taxes`). Running `pnpm build` via the old root script (`pnpm -r build`) tried to build the playground too, which fails in environments that don't have access to the private repo.

**Cause:** `pnpm -r` iterates every workspace listed in `pnpm-workspace.yaml`, which includes `playground`.

**Solution:** The root `build` script is now scoped: `pnpm -r --filter="./packages/*" build`. This skips the playground. The playground still builds via its own `pnpm --filter playground build` command when needed.

**See:** Commit [73e1890](https://github.com/JaceThings/Lisse/commit/73e1890) (2026-04-23).

---

### CI needs `PRIVATE_REPO_TOKEN` secret for `pnpm install`

**Problem:** Even though the release workflow doesn't build the playground, `pnpm install --frozen-lockfile` still tries to resolve the `system-1` entry in `pnpm-lock.yaml`, which points at a private GitHub repo. Without credentials, install fails.

**Cause:** pnpm resolves the full workspace dependency graph regardless of which packages get built afterwards.

**Solution:** Both `.github/workflows/ci.yml` and `.github/workflows/release.yml` include this step before `pnpm install`:

```yaml
- name: Configure private repo access for playground deps
  run: git config --global url."https://${{ secrets.PRIVATE_REPO_TOKEN }}@github.com/".insteadOf "https://github.com/"
```

The secret is a GitHub PAT with `repo` scope that can read the private `taxes` repo. Rotate the PAT when it expires and update the repo secret.

**When to stop needing this:** If the playground is ever rewritten to not depend on `system-1`, remove this step from both workflows and delete the secret.

---

## Package metadata

### `@scope/pkg` tarballs don't auto-include a root-level LICENSE

**Problem:** We had a single `LICENSE` file at the repo root and assumed it'd ship in every package tarball. It didn't — `npm pack` only includes files from the package's own directory.

**Cause:** `npm pack` scopes include logic to the package directory. The `files` field in each `package.json` only affects which files inside that dir are included; it can't reach up to parent directories.

**Solution:** A `LICENSE` file is copied into each `packages/*/` directory. This is the standard pattern for monorepos. The root `LICENSE` stays as the canonical source; the per-package copies are identical.

**Failure mode if the per-package LICENSE is deleted:** The tarball ships without a LICENSE, which violates MIT's requirements for redistribution and can legally block corporate consumers from using the package.

---

### OIDC trusted publishing requires npm ≥11.5.1

**Problem:** `setup-node@v4` with `node-version: 22` ships npm 10.x, which doesn't know how to use GitHub's OIDC token for npm authentication. `changeset publish` would fall back to requiring an `NPM_TOKEN` secret.

**Cause:** OIDC support in the npm CLI landed in npm 11.5.1. Node 22's bundled npm predates that.

**Solution:** The release workflow runs `npm install -g npm@latest` as an explicit step before `pnpm install`. This upgrades the runner's npm to the latest, which supports OIDC.

**When to remove this step:** When Node's bundled npm version is ≥11.5.1 by default. Check the `setup-node` default for whichever Node version the workflow uses.
