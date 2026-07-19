<div align="center">

<img src="assets/logo.png" alt="Lisse" width="128" />

<h1>Lisse</h1>

Smooth-corner SVG primitives for React, Vue, and Svelte.
Pixel-perfect Figma squircles + three other corner curves.

[![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=%40lisse%2Fcore)](https://www.npmjs.com/package/@lisse/core)
[![bundle](https://img.shields.io/bundlephobia/minzip/%40lisse%2Fcore?label=bundle)](https://bundlephobia.com/package/@lisse/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

**[Live demo →](https://corne.rs)**

**English** · [日本語](./docs/i18n/README.ja.md) · [한국어](./docs/i18n/README.ko.md) · [Deutsch](./docs/i18n/README.de.md)

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

Math reference: [`docs/curves.md`](docs/curves.md).

## Packages

| Package | npm | Description |
|---|---|---|
| `@lisse/core` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=)](https://www.npmjs.com/package/@lisse/core) | Framework-agnostic path generation + effects |
| `@lisse/react` | [![npm](https://img.shields.io/npm/v/%40lisse%2Freact?label=)](https://www.npmjs.com/package/@lisse/react) | React hook and component |
| `@lisse/vue` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fvue?label=)](https://www.npmjs.com/package/@lisse/vue) | Vue composable and component |
| `@lisse/svelte` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fsvelte?label=)](https://www.npmjs.com/package/@lisse/svelte) | Svelte action |

## Features

- Four corner curves (`arc`, `squircle`, `superellipse`, `clothoid`) with per-corner mixing
- Inner / outer / middle borders with style variants (solid, dashed, dotted)
- Drop shadows and inner shadows
- Auto-effects: CSS `border` and `box-shadow` are converted to SVG equivalents on mount
- ~1.5 µs per `generatePath()` call; 500 corners re-compute in <1 ms ([details](docs/performance.md))
- Zero runtime dependencies; ESM + CJS dual export; SSR-safe `/path` subpath

## Documentation

- [API reference](docs/api.md): full export table
- [Migration](docs/MIGRATION.md): upgrading between versions
- [SSR](docs/ssr.md): server-side rendering and edge runtimes
- [Curves](docs/curves.md): math reference for each curve type
- [Browser support](docs/browser-support.md): compatibility matrix
- [Styling hooks](docs/styling.md): `data-slot` / `data-state` attributes
- [Effects](docs/effects.md): borders, shadows, gradients, auto-effects
- [Performance](docs/performance.md): benchmarks and cache architecture
- [Internals](docs/internals.md): how borders, shadows, and resize handling work
- [Gotchas](docs/gotchas.md): `clip-path` quirks like focus outlines, overflow, scrollbars
- [Configuration](docs/configuration.md): per-corner config, which API to use, framework usage

## Contributing

Issues and PRs welcome. Contributor docs (release process, testing strategy, benchmarks) live in [`docs/`](./docs/).

## License

[MIT](./LICENSE)

---

<div align="center">

Built by [Jace](https://ja.mt)

[X](https://ja.mt/x) | [Bluesky](https://ja.mt/bsky) | [Instagram](https://ja.mt/ig) | [Threads](https://ja.mt/threads)

</div>
