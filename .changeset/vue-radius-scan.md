---
"@lisse/vue": patch
---

Detect a corner radius in a `style` string by walking the declaration list instead of matching `border(?:-[a-z]+)*-radius`. CodeQL reads that nested quantifier as a polynomial ReDoS on consumer-supplied input; the walk is also more precise, since a `border-radius:` sitting inside a value no longer counts as one the consumer set.
