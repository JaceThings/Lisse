<div align="center">

<img src="assets/logo.png" alt="Lisse" width="128" />

<h1>Lisse</h1>

Primitivas SVG de cantos suaves para React, Vue e Svelte.
Squircles do Figma pixel-perfect + três outras curvas de canto.

[![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=%40lisse%2Fcore)](https://www.npmjs.com/package/@lisse/core)
[![bundle](https://deno.bundlejs.com/badge?q=%40lisse%2Fcore&label=bundle)](https://bundlejs.com/?q=%40lisse%2Fcore)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

**[Demo ao vivo →](https://corne.rs)**

[English](./README.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · **Português (BR)** · [Русский](./README.ru.md) · [Deutsch](./README.de.md)

</div>

## O que é isso?

O `border-radius` padrão do CSS produz arcos circulares nos cantos. Designers (e a Apple, e o Figma) preferem **squircles** — cantos onde a curvatura faz a transição suavemente para as arestas retas, criando uma forma mais orgânica.

O Lisse implementa o [algoritmo de suavização de cantos do Figma](https://www.figma.com/blog/desperately-seeking-squircles/) e três outras curvas de canto em JavaScript. Ele gera caminhos SVG e valores de `clip-path` do CSS, com bindings de primeira classe para React, Vue e Svelte.

## Início rápido

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

Para Vue, Svelte ou o núcleo agnóstico de framework, veja os [pacotes](#pacotes) abaixo.

## Tipos de curva

| Curva | Descrição |
|---|---|
| `arc` | Quarto de círculo. Idêntico ao `border-radius` do CSS. |
| `squircle` *(padrão)* | Ombros cúbicos do Figma + arco central. |
| `superellipse` | `\|x/R\|^n + \|y/R\|^n = 1`. G2 com arestas para `n > 2`. |
| `clothoid` | Mescla com espiral de Euler da aresta reta ao arco central. G2 em toda parte. |

Referência matemática: [`docs/curves.md`](docs/curves.md).

## Pacotes

| Pacote | npm | Descrição |
|---|---|---|
| `@lisse/core` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=)](https://www.npmjs.com/package/@lisse/core) | Geração de caminhos + efeitos, agnóstica de framework |
| `@lisse/react` | [![npm](https://img.shields.io/npm/v/%40lisse%2Freact?label=)](https://www.npmjs.com/package/@lisse/react) | Hook e componente React |
| `@lisse/vue` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fvue?label=)](https://www.npmjs.com/package/@lisse/vue) | Composable e componente Vue |
| `@lisse/svelte` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fsvelte?label=)](https://www.npmjs.com/package/@lisse/svelte) | Action Svelte |

## Recursos

- Quatro curvas de canto (`arc`, `squircle`, `superellipse`, `clothoid`) com mistura por canto
- Bordas interna / externa / central com variantes de estilo (solid, dashed, dotted, double, groove, ridge)
- Sombras projetadas e sombras internas, com bordas em gradiente via a API
- Auto-efeitos: `border` e `box-shadow` do CSS são convertidos em equivalentes SVG na montagem
- ~1.5 µs por chamada de `generatePath()`; 500 cantos recalculados em <1 ms ([detalhes](docs/performance.md))
- Zero dependências em runtime; exportação dupla ESM + CJS; subcaminho `/path` seguro para SSR

## Documentação

- [Referência da API](docs/api.md): tabela completa de exportações
- [Migração](MIGRATION.md): atualizando entre versões
- [SSR](docs/ssr.md): renderização no servidor e runtimes de edge
- [Curvas](docs/curves.md): referência matemática para cada tipo de curva
- [Suporte de navegadores](docs/browser-support.md): matriz de compatibilidade
- [Hooks de estilização](docs/styling.md): atributos `data-slot` / `data-state`
- [Efeitos](docs/effects.md): bordas, sombras, gradientes, auto-efeitos
- [Performance](docs/performance.md): benchmarks e arquitetura de cache
- [Internals](docs/internals.md): como funcionam bordas, sombras e o tratamento de redimensionamento
- [Pegadinhas](docs/gotchas.md): peculiaridades do `clip-path` como contornos de foco, overflow, barras de rolagem
- [Configuração](docs/configuration.md): config por canto, qual API usar, uso com frameworks

## Contribuindo

Issues e PRs são bem-vindos. A documentação para contribuidores (processo de release, estratégia de testes, benchmarks) fica em [`docs/`](./docs/).

## Licença

[MIT](./LICENSE)

---

<div align="center">

Feito por [Jace](https://ja.mt)

[X](https://ja.mt/x) | [Bluesky](https://ja.mt/bsky) | [Instagram](https://ja.mt/ig) | [Threads](https://ja.mt/threads)

</div>
