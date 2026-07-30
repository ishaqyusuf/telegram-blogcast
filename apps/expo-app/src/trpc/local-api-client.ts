import { normalizeTrpcUrl } from "@/lib/base-url";
import type { AppRouter } from "@api/trpc/routers/_app";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import { trpcFetch } from "./fetch";
import { createTransportAwareLocalFetch } from "./local-api-transport";

export function createLocalApiClient(
	baseUrl: string,
	options?: { onTransportError?: () => void },
) {
	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				url: normalizeTrpcUrl(baseUrl),
				fetch: createTransportAwareLocalFetch(
					options?.onTransportError,
					trpcFetch,
				),
				headers: {
					"ngrok-skip-browser-warning": "1",
				},
				transformer: superjson as any,
			}),
		],
	});
}

export type LocalApiClient = ReturnType<typeof createLocalApiClient>;
