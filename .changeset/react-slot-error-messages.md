---
"@lisse/react": patch
---

`Slot` error messages are now specific to the actual failure:

- Zero children: `"received none"`.
- Multiple children: includes the received count.
- Non-element child: includes the received `typeof` (string, number, ...).
- Fragment child: tells the user to unwrap the Fragment so Slot can merge props onto a real element.

The previous single message (`"expects exactly one child"`) covered all four cases without distinguishing them. Behaviour is otherwise unchanged.
