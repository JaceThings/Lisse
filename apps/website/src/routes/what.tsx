import { createFileRoute } from "@tanstack/react-router";
import { What } from "../pages/What.tsx";
import { routeHead } from "../lib/route-meta.ts";

export const Route = createFileRoute("/what")({
  head: () => routeHead("/what"),
  component: What,
});
