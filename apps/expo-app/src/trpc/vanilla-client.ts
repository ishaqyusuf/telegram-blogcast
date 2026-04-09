/**
 * Standalone vanilla tRPC client — for use outside React components
 * (e.g. background sync hooks, SQLite operations).
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { AppRouter } from "@api/trpc/routers/_app";
import { getTrpcUrl } from "@/lib/base-url";
import { trpcFetch } from "./fetch";

export const vanillaTrpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: getTrpcUrl(),
      fetch: trpcFetch,
      transformer: superjson as any,
    }),
  ],
});
