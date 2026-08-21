---
"@lisse/core": patch
"@lisse/react": patch
"@lisse/vue": patch
"@lisse/svelte": patch
---

**No functional change — these four move so that all five `@lisse/*` packages keep releasing on one shared version.** `@lisse/octane` joins the `linked` group in this release, and Changesets only rewrites the version of a package that has a release of its own. Without a changeset here the new adapter would publish alone and the other four would sit a version behind, so the next ordinary patch would skip a version to catch up.
