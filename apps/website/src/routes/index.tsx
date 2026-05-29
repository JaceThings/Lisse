import { createFileRoute } from "@tanstack/react-router";
import { Home } from "../pages/Home.tsx";
import { routeHead } from "../lib/route-meta.ts";

export const Route = createFileRoute("/")({
  head: () => routeHead("/"),
  component: Home,
});
