import handler from "@tanstack/react-start/server-entry";
import { paraglideMiddleware } from "./paraglide/server.js";

// Custom server entry (mirrors the custom client entry in client.tsx). The
// default Start entry is just `createStartHandler(defaultStreamHandler)`,
// imported here as `handler`. Paraglide's middleware wraps it so every SSR
// request resolves its locale from the URL and exposes it via AsyncLocalStorage
// (so getLocale() is correct under concurrent requests, no hydration flash).
// The middleware passes the ORIGINAL request through; the router's `rewrite`
// hook (router.tsx) de-localizes the path (/de/what -> /what) so the existing
// un-prefixed route tree matches. The two are complementary, not redundant.
export default {
  fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};
