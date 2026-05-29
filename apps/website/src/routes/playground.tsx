import { createFileRoute } from "@tanstack/react-router";
import { Playground } from "../pages/Playground.tsx";
import { routeHead } from "../lib/route-meta.ts";

export const Route = createFileRoute("/playground")({
  head: () => routeHead("/playground"),
  component: Playground,
});
