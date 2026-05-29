import { createFileRoute } from "@tanstack/react-router";
import { MathPage } from "../pages/Math.tsx";
import { routeHead } from "../lib/route-meta.ts";

// Unlisted internal page: inherits the root default title, canonical -> "/"
// (see routeHead for the full why). One canonical, no title override.
export const Route = createFileRoute("/math")({
  head: () => routeHead("/math"),
  component: MathPage,
});
