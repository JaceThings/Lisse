# @lisse/octane

Octane hook and component for smooth-cornered (squircle) elements, powered by
[Figma's smoothing algorithm](https://www.figma.com/blog/desperately-seeking-squircles/).

## Installation

```sh
pnpm add @lisse/octane octane
```

## Quick start

```tsrx
import { SmoothCorners } from "@lisse/octane";

export function Card(props: { children?: unknown }) @{
  <SmoothCorners corners={{ radius: 20, smoothing: 0.6 }} style={{ background: "#fff", padding: 24 }}>
    {props.children}
  </SmoothCorners>
}
```

The adapter mirrors `@lisse/react`: `useSmoothCorners`, `SmoothCorners`,
`Slot`, explicit borders and shadows, automatic CSS effect extraction, and the
`shadowStrategy="box-shadow"` fallback are available from the package root.

Octane uses native delegated events and refs-as-props. The binding is authored
as plain TypeScript with explicit manual hook-slot forwarding, so it can be
consumed from compiled `.tsrx` or `.tsx` applications without a React runtime.
