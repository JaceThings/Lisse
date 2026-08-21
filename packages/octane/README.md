# @lisse/octane

Octane hook and component for smooth-cornered (squircle) elements, powered by
[Figma's smoothing algorithm](https://www.figma.com/blog/desperately-seeking-squircles/).

> See [Gotchas](https://github.com/JaceThings/Lisse#gotchas) in the root README
> for `clip-path` interaction notes (focus outlines, overflow, scrollbars).

[![npm](https://img.shields.io/npm/v/%40lisse%2Foctane)](https://www.npmjs.com/package/@lisse/octane)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/JaceThings/Lisse/blob/main/LICENSE)

## Installation

```sh
pnpm add @lisse/octane octane
```

**Peer dependency:** `octane ^0.1.38` — that is `>=0.1.38 <0.2.0`.

Octane is pre-1.0 and describes itself as alpha, so this adapter tracks a
moving target. Under semver a `0.x` minor is allowed to break, and Octane uses
that latitude, so the range is deliberately capped below `0.2.0` rather than
opened up to `>=0.1.38`. Expect the floor to move: a new Octane minor needs a
new `@lisse/octane` release that has actually been tested against it, not a
range that silently admits it.

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
