import { createFileRoute, redirect } from "@tanstack/react-router";
import { CurvesTest } from "../pages/CurvesTest.tsx";
import { routeHead } from "../lib/route-meta.ts";

// Unlisted internal page: inherits the root default title, canonical -> "/"
// (see routeHead for the full why). One canonical, no title override.
// Dev-only harness — redirects to home in production builds.
export const Route = createFileRoute("/curves-test")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/" });
  },
  head: () => routeHead("/curves-test"),
  component: CurvesTest,
});
