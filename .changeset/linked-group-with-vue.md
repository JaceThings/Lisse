---
"@lisse/core": patch
"@lisse/react": patch
"@lisse/svelte": patch
---

No functional change. These three move with `@lisse/vue`'s ReDoS-pattern fix so the four linked packages keep releasing on one version — Changesets only rewrites members of a `linked` group that already have a release of their own, so a lone changeset diverges the group and the next patch then skips a version for everyone else.
