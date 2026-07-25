import { createFileRoute } from "@tanstack/react-router";
import { storeRedirect } from "../lib/store-redirect.ts";

export const Route = createFileRoute("/firefox")({
  server: { handlers: { GET: () => storeRedirect("firefox") } },
});
