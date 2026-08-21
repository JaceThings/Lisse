<div align="center">

<img src="../../assets/logo.png" alt="Lisse" width="128" />

<h1>Lisse</h1>

React, Vue, Svelte, Octane용 부드러운 모서리 SVG 프리미티브.  
픽셀 단위로 정확한 Figma squircle과 세 가지 다른 모서리 곡선.

[![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=%40lisse%2Fcore)](https://www.npmjs.com/package/@lisse/core)
[![bundle](https://img.shields.io/bundlephobia/minzip/%40lisse%2Fcore?label=bundle)](https://bundlephobia.com/package/@lisse/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

**[라이브 데모 →](https://corne.rs)**

[English](../../README.md) · [日本語](./README.ja.md) · **한국어** · [Deutsch](./README.de.md) · [简体中文](./README.zh-Hans.md) · [Português (BR)](./README.pt-BR.md) · [Русский](./README.ru.md)

</div>

## 이것은 무엇인가요?

표준 CSS `border-radius`는 모서리에 원호를 만듭니다. 디자이너들, 그리고 Apple과 Figma는 **squircle** 형태를 선호합니다. 곡률이 직선 가장자리로 부드럽게 이어져 더 유기적인 형태를 만드는 모서리입니다.

Lisse는 [Figma의 모서리 스무딩 알고리즘](https://www.figma.com/blog/desperately-seeking-squircles/)과 세 가지 다른 모서리 곡선을 JavaScript로 구현합니다. SVG 경로와 CSS `clip-path` 값을 생성하며, React, Vue, Svelte, Octane용 바인딩을 제공합니다.

## 빠른 시작

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

Vue, Svelte, Octane 또는 프레임워크 독립적인 코어는 아래의 [패키지](#packages)를 참고하세요.

## 곡선 유형

| 곡선 유형 | 설명 |
|---|---|
| `arc` | 원호. CSS `border-radius`와 동일합니다. |
| `squircle` *(기본값)* | Figma의 3차 어깨 + 중앙 호. |
| `superellipse` | `\|x/R\|^n + \|y/R\|^n = 1`. `n > 2`에서 가장자리가 있는 G2. |
| `clothoid` | 직선 가장자리에서 중앙 호로 이어지는 오일러 나선 블렌드. 모든 곳에서 G2. |

수학 참고 자료: [`docs/curves.md`](../curves.md).

## 패키지

| 패키지 | npm | 설명 |
|---|---|---|
| `@lisse/core` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=)](https://www.npmjs.com/package/@lisse/core) | 프레임워크 독립적인 경로 생성 + 효과 |
| `@lisse/react` | [![npm](https://img.shields.io/npm/v/%40lisse%2Freact?label=)](https://www.npmjs.com/package/@lisse/react) | React 훅과 컴포넌트 |
| `@lisse/vue` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fvue?label=)](https://www.npmjs.com/package/@lisse/vue) | Vue 컴포저블과 컴포넌트 |
| `@lisse/svelte` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fsvelte?label=)](https://www.npmjs.com/package/@lisse/svelte) | Svelte 액션 |
| `@lisse/octane` | [![npm](https://img.shields.io/npm/v/%40lisse%2Foctane?label=)](https://www.npmjs.com/package/@lisse/octane) | Octane 훅과 컴포넌트 |

## 기능

* 모서리별로 조합할 수 있는 네 가지 모서리 곡선(`arc`, `squircle`, `superellipse`, `clothoid`)
* 스타일 변형(실선, 파선, 점선, 이중선, 홈, 융기)을 지원하는 안쪽 / 바깥 / 중앙 테두리
* 그림자, 안쪽 그림자, 그리고 API로 만드는 그라데이션 테두리
* 자동 효과: CSS `border`와 `box-shadow`가 마운트 시 SVG 등가물로 변환됩니다
* 캐시된 `generatePath()` 호출당 약 0.7 µs (캐시 미스는 약 2.5 µs); 500개 모서리를 1 ms 미만에 재계산 ([상세](../performance.md))
* 런타임 의존성 없음; ESM + CJS 이중 익스포트; SSR 안전 `/path` 하위 경로

## 문서

* [API 참고 자료](../api.md): 전체 익스포트 표
* [마이그레이션](../MIGRATION.md): 버전 간 업그레이드
* [SSR](../ssr.md): 서버 사이드 렌더링과 엣지 런타임
* [곡선](../curves.md): 각 곡선 유형에 대한 수학 참고 자료
* [브라우저 지원](../browser-support.md): 호환성 매트릭스
* [스타일링 훅](../styling.md): `data-slot` / `data-state` 속성
* [효과](../effects.md): 테두리, 그림자, 그라데이션, 자동 효과
* [성능](../performance.md): 벤치마크와 캐시 아키텍처
* [내부 구조](../internals.md): 테두리, 그림자, 리사이즈 처리가 동작하는 방식
* [주의 사항](../gotchas.md): 포커스 윤곽선, 오버플로, 스크롤바 같은 `clip-path` 특이점
* [구성](../configuration.md): 모서리별 설정, 사용 가능한 API, 프레임워크 사용법

## 기여하기

이슈와 PR을 환영합니다. 기여자 문서(릴리스 절차, 테스트 전략, 벤치마크)는 [`docs/`](../)에 있습니다.

## 라이선스

[MIT](../../LICENSE)

---

<div align="center">

[Jace](https://ja.mt)가 만들었습니다

[X](https://ja.mt/x) | [Bluesky](https://ja.mt/bsky) | [Instagram](https://ja.mt/ig) | [Threads](https://ja.mt/threads)

</div>
