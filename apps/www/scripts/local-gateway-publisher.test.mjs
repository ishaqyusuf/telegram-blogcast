import assert from "node:assert/strict";
import test from "node:test";

import {
	LOCAL_GATEWAY_HEARTBEAT_MS,
	startLocalGatewayPublisher,
	waitForLocalGatewayHealth,
} from "./local-gateway-publisher.mjs";

const healthyResponse = () =>
	new Response(JSON.stringify({ ok: true, service: "al-ghurobaa-local-api" }), {
		status: 200,
		headers: { "content-type": "application/json" },
	});

test("waits until the local web gateway reports the expected health identity", async () => {
	let attempts = 0;
	const healthy = await waitForLocalGatewayHealth({
		fetchImpl: async () => {
			attempts += 1;
			return attempts === 1
				? new Response("starting", { status: 503 })
				: healthyResponse();
		},
		sleep: async () => true,
		attempts: 2,
	});

	assert.equal(healthy, true);
	assert.equal(attempts, 2);
});

test("publishes, renews every minute, and deletes the lease on shutdown", async () => {
	const requests = [];
	let scheduled;
	let scheduledDelay;
	let cancelled;
	const publisher = await startLocalGatewayPublisher({
		gatewayUrl: "https://demo.ngrok-free.app",
		discoveryUrl: "https://alghurobaa.vercel.app/api/local-services/discovery",
		token: "secret-token",
		fetchImpl: async (url, init = {}) => {
			requests.push({ url, init });
			if (url === "http://127.0.0.1:3501/health") return healthyResponse();
			return new Response(null, { status: 200 });
		},
		logger: { log() {}, warn() {} },
		schedule: (callback, delay) => {
			scheduled = callback;
			scheduledDelay = delay;
			return 17;
		},
		cancel: (timer) => {
			cancelled = timer;
		},
	});

	assert.equal(requests[1].init.method, "PUT");
	assert.equal(requests[1].init.headers.Authorization, "Bearer secret-token");
	assert.deepEqual(JSON.parse(requests[1].init.body), {
		url: "https://demo.ngrok-free.app",
	});
	assert.equal(scheduledDelay, LOCAL_GATEWAY_HEARTBEAT_MS);

	await scheduled();
	assert.equal(requests[2].init.method, "PUT");

	await publisher.stop();
	assert.equal(cancelled, 17);
	assert.equal(requests[3].init.method, "DELETE");
});

test("missing publication configuration is non-fatal", async () => {
	const warnings = [];
	const publisher = await startLocalGatewayPublisher({
		gatewayUrl: "https://demo.ngrok-free.app",
		discoveryUrl: "",
		token: "",
		fetchImpl: async () => {
			throw new Error("fetch should not run");
		},
		logger: {
			log() {},
			warn(message) {
				warnings.push(message);
			},
		},
	});

	assert.equal(warnings.length, 1);
	await publisher.stop();
});
