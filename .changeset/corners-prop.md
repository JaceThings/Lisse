---
"@lisse/react": minor
"@lisse/vue": minor
"@lisse/svelte": minor
---

**Breaking**: corner options are now passed via a single `corners` prop / config field instead of being spread on the component or action.

```diff
-<SmoothCorners radius={20} smoothing={0.6} />
+<SmoothCorners corners={{ radius: 20, smoothing: 0.6 }} />

-<SmoothCorners topLeft={20} topRight={30} />
+<SmoothCorners corners={{ topLeft: 20, topRight: 30 }} />

-use:smoothCorners={{ radius: 20, smoothing: 0.6 }}
+use:smoothCorners={{ corners: { radius: 20, smoothing: 0.6 } }}
```

This eliminates the discriminated-union type assertion in the React component and aligns the React/Vue/Svelte APIs around a single shape.
