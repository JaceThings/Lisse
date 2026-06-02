<div align="center">

<img src="assets/logo.png" alt="Lisse" width="128" />

<h1>Lisse</h1>

SVG-Primitive mit glatten Ecken für React, Vue und Svelte.
Pixelgenaue Figma-Squircles + drei weitere Eckkurven.

[![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=%40lisse%2Fcore)](https://www.npmjs.com/package/@lisse/core)
[![bundle](https://deno.bundlejs.com/badge?q=%40lisse%2Fcore&label=bundle)](https://bundlejs.com/?q=%40lisse%2Fcore)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

**[Live-Demo →](https://corne.rs)**

[English](./README.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Português (BR)](./README.pt-BR.md) · [Русский](./README.ru.md) · **Deutsch**

</div>

## Was ist das?

Standard-CSS-`border-radius` erzeugt an den Ecken Kreisbögen. Designer (und Apple und Figma) bevorzugen **Squircles** – Ecken, bei denen die Krümmung glatt in die geraden Kanten übergeht und so eine organischere Form entsteht.

Lisse implementiert [Figmas Algorithmus zur Eckenglättung](https://www.figma.com/blog/desperately-seeking-squircles/) und drei weitere Eckkurven in JavaScript. Es generiert SVG-Pfade und CSS-`clip-path`-Werte, mit erstklassigen Bindings für React, Vue und Svelte.

## Schnellstart

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

Für Vue, Svelte oder den Framework-unabhängigen Kern siehe die [Pakete](#pakete) unten.

## Kurventypen

| Kurve | Beschreibung |
|---|---|
| `arc` | Viertelkreis. Identisch mit CSS-`border-radius`. |
| `squircle` *(Standard)* | Figmas kubische Schultern + zentraler Bogen. |
| `superellipse` | `\|x/R\|^n + \|y/R\|^n = 1`. G2 mit Kanten für `n > 2`. |
| `clothoid` | Euler-Spiral-Übergang von der geraden Kante zum zentralen Bogen. Überall G2. |

Mathematische Referenz: [`docs/curves.md`](docs/curves.md).

## Pakete

| Paket | npm | Beschreibung |
|---|---|---|
| `@lisse/core` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=)](https://www.npmjs.com/package/@lisse/core) | Framework-unabhängige Pfadgenerierung + Effekte |
| `@lisse/react` | [![npm](https://img.shields.io/npm/v/%40lisse%2Freact?label=)](https://www.npmjs.com/package/@lisse/react) | React-Hook und -Komponente |
| `@lisse/vue` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fvue?label=)](https://www.npmjs.com/package/@lisse/vue) | Vue-Composable und -Komponente |
| `@lisse/svelte` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fsvelte?label=)](https://www.npmjs.com/package/@lisse/svelte) | Svelte-Action |

## Funktionen

- Vier Eckkurven (`arc`, `squircle`, `superellipse`, `clothoid`) mit Mischung pro Ecke
- Innen-/Außen-/Mittelrahmen mit Stilvarianten (solid, dashed, dotted, double, groove, ridge)
- Schlagschatten und Innenschatten, mit Verlaufsrahmen über die API
- Auto-Effekte: CSS-`border` und -`box-shadow` werden beim Mount in SVG-Äquivalente umgewandelt
- ~1,5 µs pro `generatePath()`-Aufruf; 500 Ecken werden in <1 ms neu berechnet ([Details](docs/performance.md))
- Keine Laufzeitabhängigkeiten; dualer ESM- + CJS-Export; SSR-sicherer `/path`-Subpfad

## Dokumentation

- [API-Referenz](docs/api.md): vollständige Export-Tabelle
- [Migration](MIGRATION.md): Upgrade zwischen Versionen
- [SSR](docs/ssr.md): serverseitiges Rendering und Edge-Runtimes
- [Kurven](docs/curves.md): mathematische Referenz für jeden Kurventyp
- [Browser-Unterstützung](docs/browser-support.md): Kompatibilitätsmatrix
- [Styling-Hooks](docs/styling.md): `data-slot`- / `data-state`-Attribute
- [Effekte](docs/effects.md): Rahmen, Schatten, Verläufe, Auto-Effekte
- [Performance](docs/performance.md): Benchmarks und Cache-Architektur
- [Interna](docs/internals.md): wie Rahmen, Schatten und Resize-Handling funktionieren
- [Stolperfallen](docs/gotchas.md): `clip-path`-Eigenheiten wie Fokus-Outlines, Overflow, Scrollbars
- [Konfiguration](docs/configuration.md): Konfiguration pro Ecke, welche API zu verwenden ist, Framework-Nutzung

## Mitwirken

Issues und PRs willkommen. Mitwirkenden-Doku (Release-Prozess, Teststrategie, Benchmarks) findet sich in [`docs/`](./docs/).

## Lizenz

[MIT](./LICENSE)

---

<div align="center">

Erstellt von [Jace](https://ja.mt)

[X](https://ja.mt/x) | [Bluesky](https://ja.mt/bsky) | [Instagram](https://ja.mt/ig) | [Threads](https://ja.mt/threads)

</div>
