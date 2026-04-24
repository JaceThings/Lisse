---
"@lisse/vue": minor
---

Vue `Slot` now respects `event.preventDefault()` when composing event handlers, matching the React `Slot`. The parent handler is skipped if the child handler called `preventDefault()`. Previously Vue's `cloneVNode(vnode, attrs)` concatenated listeners into an array that always ran both; there was no way for the child to opt out of the parent handler. Error messages are also now per-case (zero children / multiple / text-only / comment-only) instead of a single generic `"exactly one element child"`.
