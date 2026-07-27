<div align="center">

<img src="../../assets/logo.png" alt="Lisse" width="128" />

<h1>Lisse</h1>

SVG-примитивы для плавно скругленных углов в React, Vue и Svelte.
Пиксельно точные сквирклы как в Figma и еще три типа кривых для углов.

[![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=%40lisse%2Fcore)](https://www.npmjs.com/package/@lisse/core)
[![bundle](https://img.shields.io/bundlephobia/minzip/%40lisse%2Fcore?label=bundle)](https://bundlephobia.com/package/@lisse/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

**[Онлайн-демо →](https://corne.rs)**

[English](../../README.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Deutsch](./README.de.md) · [简体中文](./README.zh-Hans.md) · [Português (BR)](./README.pt-BR.md) · **Русский**

</div>

## Что это?

Стандартный CSS `border-radius` создает в углах дуги окружности. Дизайнеры (а также Apple и Figma) предпочитают **сквирклы** — углы, где кривизна плавно переходит в прямые стороны, создавая более органичную форму.

Lisse реализует [алгоритм сглаживания углов Figma](https://www.figma.com/blog/desperately-seeking-squircles/) и еще три типа кривых для углов на JavaScript. Библиотека генерирует SVG-пути и значения CSS `clip-path`, а также предоставляет полноценные биндинги для React, Vue и Svelte.

## Быстрый старт

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

Для Vue, Svelte или ядра без привязки к фреймворку см. [пакеты](#packages) ниже.

## Типы кривых

| Кривая | Описание |
|---|---|
| `arc` | Четверть окружности. Полностью соответствует CSS `border-radius`. |
| `squircle` *(по умолчанию)* | Кубические участки Figma + центральная дуга. |
| `superellipse` | `\|x/R\|^n + \|y/R\|^n = 1`. G2-сопряжение со сторонами при `n > 2`. |
| `clothoid` | Сопряжение спиралью Эйлера от прямой стороны к центральной дуге. G2 на всем протяжении. |

Математическая справка: [`docs/curves.md`](../curves.md).

## Пакеты

| Пакет | npm | Описание |
|---|---|---|
| `@lisse/core` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fcore?label=)](https://www.npmjs.com/package/@lisse/core) | Генерация путей и эффекты без привязки к фреймворку |
| `@lisse/react` | [![npm](https://img.shields.io/npm/v/%40lisse%2Freact?label=)](https://www.npmjs.com/package/@lisse/react) | React-хук и компонент |
| `@lisse/vue` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fvue?label=)](https://www.npmjs.com/package/@lisse/vue) | Composable-функция и компонент для Vue |
| `@lisse/svelte` | [![npm](https://img.shields.io/npm/v/%40lisse%2Fsvelte?label=)](https://www.npmjs.com/package/@lisse/svelte) | Action для Svelte |

## Возможности

- Четыре типа кривых для углов (`arc`, `squircle`, `superellipse`, `clothoid`) с настройкой каждого угла отдельно
- Внутренние / внешние / средние обводки с вариантами стиля (solid, dashed, dotted, double, groove, ridge)
- Падающие и внутренние тени, а также градиентные обводки через API
- Автоэффекты: CSS `border` и `box-shadow` преобразуются в SVG-эквиваленты при монтировании
- ~1.5 мкс на вызов `generatePath()`; 500 углов пересчитываются менее чем за 1 мс ([подробности](../performance.md))
- Никаких runtime-зависимостей; двойной экспорт ESM + CJS; безопасный для SSR подпуть `/path`

## Документация

- [Справочник API](../api.md): полная таблица экспортов
- [Миграция](../MIGRATION.md): переход между версиями
- [SSR](../ssr.md): серверный рендеринг и edge-среды выполнения
- [Кривые](../curves.md): математическая справка по каждому типу кривой
- [Поддержка браузерами](../browser-support.md): матрица совместимости
- [Хуки для стилизации](../styling.md): атрибуты `data-slot` / `data-state`
- [Эффекты](../effects.md): обводки, тени, градиенты, автоэффекты
- [Производительность](../performance.md): бенчмарки и архитектура кэша
- [Внутреннее устройство](../internals.md): как работают обводки, тени и обработка изменения размера
- [Подводные камни](../gotchas.md): особенности `clip-path`, включая outline при фокусе, переполнение и полосы прокрутки
- [Конфигурация](../configuration.md): настройка отдельных углов, выбор API, использование с фреймворками

## Участие в разработке

Issues и PR приветствуются. Документация для контрибьюторов (процесс релиза, стратегия тестирования, бенчмарки) находится в [`docs/`](../).

## Лицензия

[MIT](../../LICENSE)

---

<div align="center">

Создано [Jace](https://ja.mt)

[X](https://ja.mt/x) | [Bluesky](https://ja.mt/bsky) | [Instagram](https://ja.mt/ig) | [Threads](https://ja.mt/threads)

</div>
