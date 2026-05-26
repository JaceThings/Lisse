# Styling hooks

Every element managed by Lisse — whether via the React/Vue components, the React/Vue hooks/composables, or the Svelte action — gets two stable attributes:

- `data-slot="smooth-corners"`: present for the lifetime of the binding.
- `data-state="pending" | "ready"`: flips to `"ready"` after the first successful clip-path application.

Use these to mask any first-frame flicker without sprinkling component-specific class names throughout your CSS:

```css
[data-slot="smooth-corners"][data-state="pending"] { opacity: 0; }
[data-slot="smooth-corners"][data-state="ready"]   { opacity: 1; transition: opacity 100ms; }
```
