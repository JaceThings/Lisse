<div align="center">

<img src="../../assets/logo.png" alt="Lisse" width="128" />

<h1>Lisse</h1>

React、Vue、Svelte 向けのなめらかな角の SVG プリミティブ。
ピクセルパーフェクトな Figma squircle と、その他 3 種類の角の曲線。

[![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=%40lisse%2Fcore)](https://www.npmjs.com/package/@lisse/core)
[![bundle](https://img.shields.io/bundlephobia/minzip/%40lisse%2Fcore?label=bundle)](https://bundlephobia.com/package/@lisse/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

**[Live demo →](https://corne.rs)**

[English](../../README.md) · **日本語** · [한국어](./README.ko.md) · [Deutsch](./README.de.md) · [简体中文](./README.zh-Hans.md) · [Português (BR)](./README.pt-BR.md) · [Русский](./README.ru.md)

</div>

## これは何?

標準的な CSS の `border-radius` は角に円弧を生成します。デザイナー（そして Apple や Figma）は **squircle** を好みます。これは曲率が直線エッジへとなめらかに遷移する角で、より有機的な形状を生み出します。

Lisse は [Figma の角スムージングアルゴリズム](https://www.figma.com/blog/desperately-seeking-squircles/) と、その他 3 種類の角の曲線を JavaScript で実装します。SVG パスと CSS の `clip-path` 値を生成し、React、Vue、Svelte 向けの第一級のバインディングを備えています。

## クイックスタート

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

Vue、Svelte、またはフレームワーク非依存のコアについては、以下の [パッケージ](#packages) を参照してください。

## 曲線の種類

| 曲線 | 説明 |
|---|---|
| `arc` | 1/4 円。CSS の `border-radius` と同一。 |
| `squircle` *(デフォルト)* | Figma の 3 次ショルダー + 中央の円弧。 |
| `superellipse` | `\|x/R\|^n + \|y/R\|^n = 1`。`n > 2` でエッジを伴う G2。 |
| `clothoid` | 直線エッジから中央の円弧への Euler 螺旋ブレンド。どこでも G2。 |

数学リファレンス: [`docs/curves.md`](../curves.md)。

## パッケージ

| パッケージ | npm | 説明 |
|---|---|---|
| `@lisse/core` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=)](https://www.npmjs.com/package/@lisse/core) | フレームワーク非依存のパス生成 + エフェクト |
| `@lisse/react` | [![npm](https://img.shields.io/npm/v/%40lisse%2Freact?label=)](https://www.npmjs.com/package/@lisse/react) | React フックとコンポーネント |
| `@lisse/vue` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fvue?label=)](https://www.npmjs.com/package/@lisse/vue) | Vue コンポーザブルとコンポーネント |
| `@lisse/svelte` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fsvelte?label=)](https://www.npmjs.com/package/@lisse/svelte) | Svelte アクション |

## 機能

- 角ごとのミキシングに対応した 4 種類の角の曲線（`arc`、`squircle`、`superellipse`、`clothoid`）
- スタイルのバリエーション（solid、dashed、dotted、double、groove、ridge）を備えた内側 / 外側 / 中央のボーダー
- ドロップシャドウと内側シャドウ、API 経由のグラデーションボーダー
- 自動エフェクト: マウント時に CSS の `border` と `box-shadow` を SVG 相当に変換
- キャッシュ済みの `generatePath()` 呼び出しあたり約 3.5 µs（未キャッシュは約 8 µs）。500 個の角を 1.5〜3 ms で再計算（[詳細](../performance.md)）
- ランタイム依存ゼロ。ESM + CJS のデュアルエクスポート。SSR セーフな `/path` サブパス

## ドキュメント

- [API リファレンス](../api.md): 完全なエクスポート表
- [移行](../MIGRATION.md): バージョン間のアップグレード
- [SSR](../ssr.md): サーバーサイドレンダリングとエッジランタイム
- [曲線](../curves.md): 各曲線の種類の数学リファレンス
- [ブラウザサポート](../browser-support.md): 互換性マトリクス
- [スタイリングフック](../styling.md): `data-slot` / `data-state` 属性
- [エフェクト](../effects.md): ボーダー、シャドウ、グラデーション、自動エフェクト
- [パフォーマンス](../performance.md): ベンチマークとキャッシュアーキテクチャ
- [内部構造](../internals.md): ボーダー、シャドウ、リサイズ処理の仕組み
- [注意点](../gotchas.md): フォーカスのアウトライン、オーバーフロー、スクロールバーなど `clip-path` の癖
- [設定](../configuration.md): 角ごとの設定、使用すべき API、フレームワークでの利用

## コントリビュート

Issue と PR を歓迎します。コントリビューター向けドキュメント（リリースプロセス、テスト戦略、ベンチマーク）は [`docs/`](../) にあります。

## ライセンス

[MIT](../../LICENSE)

---

<div align="center">

Built by [Jace](https://ja.mt)

[X](https://ja.mt/x) | [Bluesky](https://ja.mt/bsky) | [Instagram](https://ja.mt/ig) | [Threads](https://ja.mt/threads)

</div>
