---
"@lisse/svelte": patch
---

`autoEffects` is now reactive: calling the Svelte action's `update()` with a different `autoEffects` value starts or stops CSS extraction accordingly. Toggling from `true` to `false` restores the original inline `border` and `box-shadow`; toggling from `false` to `true` re-extracts them. Previously `autoEffects` was read once at mount and every subsequent `update()` ignored it. This aligns Svelte's behaviour with the Vue composable, where `autoEffects` has always been reactive.
