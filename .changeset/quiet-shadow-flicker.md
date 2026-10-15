---
"@lisse/extension": patch
---

**Elements no longer flicker on sites that transition `box-shadow`.** Every inline write the extension made echoed back through its own `MutationObserver`, which queued the element again, which wrote again — a loop that never settled. Each pass released the owned `box-shadow: none` to read the site's value, and on any element with a `box-shadow` transition (Primer, Tailwind's `transition-all`) that release started a transition the next write cancelled, so the shadow toggled every frame. The observer now skips style records that match the extension's last write, and any `box-shadow` transition a pass starts is cancelled before paint.
