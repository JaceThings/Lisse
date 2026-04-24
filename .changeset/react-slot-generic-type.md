---
"@lisse/react": minor
---

Add `SlotPropsFor<E>` and make `Slot` generic over the element type it will merge onto. Consumers who need element-specific attributes (`href`, `type`, `name`, ...) can now opt into them via a type parameter:

```tsx
<Slot<"a"> href="/x">
  <a>link</a>
</Slot>;

<Slot<"button"> type="submit">
  <button>submit</button>
</Slot>;
```

The existing `SlotProps` type is unchanged, so non-parameterised usage continues to work. Runtime behaviour is unchanged -- every prop is forwarded to the cloned child regardless of type. The generic parameter is a type-level hint only.
