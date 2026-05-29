import { createFileRoute, redirect } from "@tanstack/react-router";

// Catch-all: any unmatched path redirects to "/" (replaces the old
// <Route path="*" element={<Navigate to="/" replace />} />). beforeLoad
// throwing redirect() produces a real server-side 3xx on direct hits.
export const Route = createFileRoute("/$")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
