import { normalizeTrpcUrl } from "@/lib/base-url";
import type { AppRouter } from "@api/trpc/routers/_app";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import { trpcFetch } from "./fetch";

export function createLocalApiClient(baseUrl: string) {
	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				url: normalizeTrpcUrl(baseUrl),
				fetch: trpcFetch,
				transformer: superjson as any,
			}),
		],
	});
}

export type LocalApiClient = ReturnType<typeof createLocalApiClient>;
