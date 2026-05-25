<div align="center">

<img src="assets/logo.png" alt="Lisse" width="128" />

<h1>Lisse</h1>

Smooth-corner SVG primitives for React, Vue, and Svelte.
Pixel-perfect Figma squircles + three other corner curves.

[![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=%40lisse%2Fcore)](https://www.npmjs.com/package/@lisse/core)
[![bundle](https://deno.bundlejs.com/badge?q=%40lisse%2Fcore&label=bundle)](https://bundlejs.com/?q=%40lisse%2Fcore)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

**[Live demo →](https://corne.rs)**

</div>

## What is this?

Standard CSS `border-radius` produces circular arcs at the corners. Designers (and Apple, and Figma) prefer **squircles** — corners where curvature transitions smoothly into the straight edges, creating a more organic shape.

Lisse implements [Figma's corner smoothing algorithm](https://www.figma.com/blog/desperately-seeking-squircles/) and three other corner curves in JavaScript. It generates SVG paths and CSS `clip-path` values, with first-class bindings for React, Vue, and Svelte.

## Quick start

```sh
npm install @lisse/react
```

```tsx
import { SmoothCorners } from "@lisse/react";

function Card() {
  return (
    <SmoothCorners corners={{ radius: 20, smoothing: 0.6 }} style={{ background: "#fff", padding: 24 }}>
      <h2>Hello, squircle</h2>
    </SmoothCorners>
  );
}
```

For Vue, Svelte, or framework-agnostic core, see the [packages](#packages) below.

## Curve types

| Curve | Description |
|---|---|
| `arc` | Quarter circle. Identical to CSS `border-radius`. |
| `squircle` *(default)* | Figma's cubic shoulders + central arc. |
| `superellipse` | `\|x/R\|^n + \|y/R\|^n = 1`. G2 with edges for `n > 2`. |
| `clothoid` | Euler-spiral blend from straight edge to central arc. G2 everywhere. |

Math reference: [`docs/curves.md`](docs/curves.md). Interactive demo: [corne.rs/math](https://corne.rs/math).

## Packages

| Package | npm | Description |
|---|---|---|
| `@lisse/core` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=)](https://www.npmjs.com/package/@lisse/core) | Framework-agnostic path generation + effects |
| `@lisse/react` | [![npm](https://img.shields.io/npm/v/%40lisse%2Freact?label=)](https://www.npmjs.com/package/@lisse/react) | React hook and component |
| `@lisse/vue` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fvue?label=)](https://www.npmjs.com/package/@lisse/vue) | Vue composable and component |
| `@lisse/svelte` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fsvelte?label=)](https://www.npmjs.com/package/@lisse/svelte) | Svelte action |

## Features

- Four corner curves (`arc`, `squircle`, `superellipse`, `clothoid`) with per-corner mixing
- Inner / outer / middle borders with style variants (solid, dashed, dotted, double, groove, ridge)
- Drop shadows and inner shadows, with gradient borders via the API
- Auto-effects: CSS `border` and `box-shadow` are converted to SVG equivalents on mount
- ~1.5 µs per `generatePath()` call; 500 corners re-compute in <1 ms ([details](docs/performance.md))
- Zero runtime dependencies; ESM + CJS dual export; SSR-safe `/path` subpath

## Documentation

- [Configuration](docs/configuration.md) — Per-corner config, which API to use, framework usage
- [Effects](docs/effects.md) — Borders, shadows, gradients, auto-effects
- [Styling hooks](docs/styling.md) — `data-slot` / `data-state` attributes
- [Gotchas](docs/gotchas.md) — `clip-path` quirks: focus outlines, overflow, scrollbars
- [SSR](docs/ssr.md) — Server-side rendering and edge runtimes
- [Performance](docs/performance.md) — Benchmarks and cache architecture
- [API reference](docs/api.md) — Full export table
- [Internals](docs/internals.md) — How borders, shadows, and resize handling work
- [Browser support](docs/browser-support.md) — Compatibility matrix
- [Migration](MIGRATION.md) — Upgrading between versions
- [Curves](docs/curves.md) — Math reference for each curve type

## Contributing

Issues and PRs welcome. Contributor docs (release process, testing strategy, benchmarks) live in [`docs/`](./docs/).

## License

[MIT](./LICENSE)

---

<div align="center">

Built by [Jace](https://ja.mt)
&nbsp;·&nbsp;
[X](https://ja.mt/x) · [Bluesky](https://ja.mt/bsky) · [Instagram](https://ja.mt/ig) · [Threads](https://ja.mt/threads)

</div>
