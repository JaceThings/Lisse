// SSR smoke: server-render <SmoothCorners /> via react-dom/server and
// assert the rendered HTML contains the expected DOM shape. Failure
// here means SSR consumers (Next, Remix, Astro) would crash on import
// or render — a class of regression hard to catch in unit tests.
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { SmoothCorners } from "@lisse/react";

const html = renderToString(
  React.createElement(
    SmoothCorners,
    { as: "div", corners: { radius: 12 } },
    React.createElement("span", null, "hello"),
  ),
);

assert.equal(typeof html, "string", "renderToString must return a string");
assert.ok(html.length > 0, "rendered HTML must not be empty");
assert.ok(html.includes("hello"), "rendered HTML must contain the child content");

console.log("[ssr-smoke] OK");
