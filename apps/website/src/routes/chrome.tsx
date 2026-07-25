import { createFileRoute } from "@tanstack/react-router";
import { storeRedirect } from "../lib/store-redirect.ts";

export const Route = createFileRoute("/chrome")({
  server: { handlers: { GET: () => storeRedirect("chrome") } },
});
