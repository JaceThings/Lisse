<div align="center">

<img src="assets/logo.png" alt="Lisse" width="128" />

<h1>Lisse</h1>

面向 React、Vue 和 Svelte 的平滑边角 SVG 原语。
像素级精确的 Figma squircle，外加另外三种边角曲线。

[![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=%40lisse%2Fcore)](https://www.npmjs.com/package/@lisse/core)
[![bundle](https://deno.bundlejs.com/badge?q=%40lisse%2Fcore&label=bundle)](https://bundlejs.com/?q=%40lisse%2Fcore)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

**[在线演示 →](https://corne.rs)**

[English](./README.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Português (BR)](./README.pt-BR.md) · [Русский](./README.ru.md) · [Deutsch](./README.de.md)

</div>

## 这是什么？

标准的 CSS `border-radius` 在边角处产生圆弧。设计师（以及 Apple 和 Figma）更偏爱 **squircle**——曲率平滑过渡到直边的边角，从而形成更有机的形状。

Lisse 用 JavaScript 实现了 [Figma 的边角平滑算法](https://www.figma.com/blog/desperately-seeking-squircles/)以及另外三种边角曲线。它生成 SVG 路径和 CSS `clip-path` 值，并为 React、Vue 和 Svelte 提供一流的绑定。

## 快速上手

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

如需 Vue、Svelte 或与框架无关的核心，请参见下方的[软件包](#packages)。

## 曲线类型

| Curve | Description |
|---|---|
| `arc` | 四分之一圆。与 CSS `border-radius` 完全相同。 |
| `squircle` *(default)* | Figma 的三次肩部 + 中央圆弧。 |
| `superellipse` | `\|x/R\|^n + \|y/R\|^n = 1`。当 `n > 2` 时带边缘的 G2。 |
| `clothoid` | 从直边到中央圆弧的欧拉螺线（Euler-spiral）混合。处处 G2。 |

数学参考：[`docs/curves.md`](docs/curves.md)。

## 软件包

| Package | npm | Description |
|---|---|---|
| `@lisse/core` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=)](https://www.npmjs.com/package/@lisse/core) | 与框架无关的路径生成 + 效果 |
| `@lisse/react` | [![npm](https://img.shields.io/npm/v/%40lisse%2Freact?label=)](https://www.npmjs.com/package/@lisse/react) | React hook 与组件 |
| `@lisse/vue` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fvue?label=)](https://www.npmjs.com/package/@lisse/vue) | Vue composable 与组件 |
| `@lisse/svelte` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fsvelte?label=)](https://www.npmjs.com/package/@lisse/svelte) | Svelte action |

## 特性

- 四种边角曲线（`arc`、`squircle`、`superellipse`、`clothoid`），支持逐角混合
- 内 / 外 / 居中边框，含多种样式变体（实线、虚线、点线、双线、凹槽、凸脊）
- 投影与内阴影，并可通过 API 实现渐变边框
- 自动效果：挂载时将 CSS `border` 和 `box-shadow` 转换为等效的 SVG
- 每次 `generatePath()` 调用约 1.5 µs；500 个边角的重算在 <1 ms 内完成（[详情](docs/performance.md)）
- 零运行时依赖；ESM + CJS 双重导出；SSR 安全的 `/path` 子路径

## 文档

- [API 参考](docs/api.md)：完整的导出表
- [迁移](MIGRATION.md)：在版本之间升级
- [SSR](docs/ssr.md)：服务端渲染与边缘运行时
- [曲线](docs/curves.md)：每种曲线类型的数学参考
- [浏览器支持](docs/browser-support.md)：兼容性矩阵
- [样式钩子](docs/styling.md)：`data-slot` / `data-state` 属性
- [效果](docs/effects.md)：边框、阴影、渐变、自动效果
- [性能](docs/performance.md)：基准测试与缓存架构
- [内部实现](docs/internals.md)：边框、阴影与尺寸变化处理的工作原理
- [陷阱](docs/gotchas.md)：`clip-path` 的怪癖，例如焦点轮廓、溢出、滚动条
- [配置](docs/configuration.md)：逐角配置、该用哪个 API、框架用法

## 贡献

欢迎提交 Issue 和 PR。贡献者文档（发布流程、测试策略、基准测试）见于 [`docs/`](./docs/)。

## 许可证

[MIT](./LICENSE)

---

<div align="center">

由 [Jace](https://ja.mt) 构建

[X](https://ja.mt/x) | [Bluesky](https://ja.mt/bsky) | [Instagram](https://ja.mt/ig) | [Threads](https://ja.mt/threads)

</div>
