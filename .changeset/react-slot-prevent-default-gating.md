---
"@lisse/react": minor
---

`Slot` now respects `event.preventDefault()` when composing event handlers: the parent handler is skipped if the child handler called `preventDefault()` on the event. Matches Radix's Slot semantics and gives a child a way to opt out of the composed behaviour. Existing usages where the child does not call `preventDefault()` are unchanged -- both handlers still fire in order (child first, parent second).
