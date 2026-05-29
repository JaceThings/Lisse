import { createFileRoute } from "@tanstack/react-router";
import { CurvesTest } from "../pages/CurvesTest.tsx";
import { routeHead } from "../lib/route-meta.ts";

// Unlisted internal page: inherits the root default title, canonical -> "/"
// (see routeHead for the full why). One canonical, no title override.
export const Route = createFileRoute("/curves-test")({
  head: () => routeHead("/curves-test"),
  component: CurvesTest,
});
