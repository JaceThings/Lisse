---
"@lisse/react": minor
"@lisse/vue": minor
---

Add `asChild` prop and a tiny internal `Slot` component. With `asChild`, SmoothCorners merges itself onto its single child instead of rendering its own element. This avoids wrapper hell when applying smooth corners to existing elements like custom buttons or links.

```tsx
<SmoothCorners asChild radius={20}>
  <MyButton>Click me</MyButton>
</SmoothCorners>
```

The `Slot` component is exported for advanced composition. No new runtime dependencies.
