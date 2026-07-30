import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// The web supervisor runs directly under Node without a TypeScript build step,
// so this companion module deliberately uses the supervisor's native ESM format.
export const LOCAL_GATEWAY_HEARTBEAT_MS = 60_000;
export const LOCAL_GATEWAY_HEALTH_ATTEMPTS = 15;
export const LOCAL_GATEWAY_HEALTH_RETRY_MS = 2_000;
const LOCAL_GATEWAY_DELETE_TIMEOUT_MS = 2_000;

function readLocalPublisherEnv(name) {
	for (const filename of [".env.local", ".env"]) {
		const path = resolve(process.cwd(), filename);
		if (!existsSync(path)) continue;
		for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line || line.startsWith("#")) continue;
			const separator = line.indexOf("=");
			if (separator <= 0 || line.slice(0, separator).trim() !== name) continue;
			const value = line.slice(separator + 1).trim();
			return value.replace(/^(['"])(.*)\1$/, "$2");
		}
	}
	return undefined;
}

function delay(ms, signal) {
	return new Promise((resolve) => {
		if (signal?.aborted) {
			resolve(false);
			return;
		}
		const timer = setTimeout(() => resolve(true), ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve(false);
			},
			{ once: true },
		);
	});
}

export async function waitForLocalGatewayHealth({
	baseUrl = "http://127.0.0.1:3501",
	fetchImpl = fetch,
	signal,
	sleep = delay,
	attempts = LOCAL_GATEWAY_HEALTH_ATTEMPTS,
}) {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (signal?.aborted) return false;
		try {
			const response = await fetchImpl(`${baseUrl}/health`, {
				headers: { Accept: "application/json" },
				signal,
			});
			if (response.ok) {
				const health = await response.json();
				if (
					health?.ok === true &&
					health?.service === "al-ghurobaa-local-api"
				) {
					return true;
				}
			}
		} catch {
			if (signal?.aborted) return false;
		}

		if (
			attempt < attempts - 1 &&
			!(await sleep(LOCAL_GATEWAY_HEALTH_RETRY_MS, signal))
		) {
			return false;
		}
	}
	return false;
}

async function updateLease({
	method,
	discoveryUrl,
	token,
	gatewayUrl,
	fetchImpl,
	signal,
}) {
	const response = await fetchImpl(discoveryUrl, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			...(method === "PUT" ? { "Content-Type": "application/json" } : {}),
		},
		...(method === "PUT" ? { body: JSON.stringify({ url: gatewayUrl }) } : {}),
		signal,
	});
	if (!response.ok) {
		throw new Error(`discovery endpoint returned ${response.status}`);
	}
}

export async function startLocalGatewayPublisher({
	gatewayUrl,
	discoveryUrl = process.env.LOCAL_SERVICES_DISCOVERY_URL ??
		readLocalPublisherEnv("LOCAL_SERVICES_DISCOVERY_URL"),
	token = process.env.LOCAL_SERVICES_DISCOVERY_TOKEN ??
		readLocalPublisherEnv("LOCAL_SERVICES_DISCOVERY_TOKEN"),
	fetchImpl = fetch,
	signal,
	logger = console,
	schedule = setInterval,
	cancel = clearInterval,
	sleep,
	healthAttempts,
}) {
	if (!discoveryUrl || !token) {
		logger.warn(
			"[dev:ngrok] gateway discovery publication is disabled; set LOCAL_SERVICES_DISCOVERY_URL and LOCAL_SERVICES_DISCOVERY_TOKEN.",
		);
		return { stop: async () => {} };
	}

	const healthy = await waitForLocalGatewayHealth({
		fetchImpl,
		signal,
		...(sleep ? { sleep } : {}),
		...(healthAttempts ? { attempts: healthAttempts } : {}),
	});
	if (!healthy || signal?.aborted) {
		if (!signal?.aborted) {
			logger.warn(
				"[dev:ngrok] local web did not become healthy; gateway URL was not published.",
			);
		}
		return { stop: async () => {} };
	}

	const renew = async () => {
		try {
			await updateLease({
				method: "PUT",
				discoveryUrl,
				token,
				gatewayUrl,
				fetchImpl,
				signal,
			});
			return true;
		} catch (error) {
			if (!signal?.aborted) {
				logger.warn(
					`[dev:ngrok] could not publish gateway URL: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
			return false;
		}
	};

	const published = await renew();
	if (published) {
		logger.log(`[dev:ngrok] published preview gateway: ${gatewayUrl}`);
	}

	const heartbeat = schedule(() => {
		void renew();
	}, LOCAL_GATEWAY_HEARTBEAT_MS);

	return {
		stop: async () => {
			cancel(heartbeat);
			const controller = new AbortController();
			const timeout = setTimeout(
				() => controller.abort(),
				LOCAL_GATEWAY_DELETE_TIMEOUT_MS,
			);
			try {
				await updateLease({
					method: "DELETE",
					discoveryUrl,
					token,
					gatewayUrl,
					fetchImpl,
					signal: controller.signal,
				});
			} catch {
				// Lease expiry is the authoritative crash and shutdown fallback.
			} finally {
				clearTimeout(timeout);
			}
		},
	};
}
