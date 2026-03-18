/**
 * Standalone vanilla tRPC client — for use outside React components
 * (e.g. background sync hooks, SQLite operations).
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { AppRouter } from "@api/trpc/routers/_app";
import { getBaseUrl } from "@/lib/base-url";

export const vanillaTrpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson as any,
    }),
  ],
});
