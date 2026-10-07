import assert from "node:assert/strict";
import { test } from "node:test";
import { deploymentUrlFromOutput } from "./vercel-deployment-output.mjs";

test("deployment helper accepts the Vercel CLI JSON success output", () => {
	const url = "https://alghurobaa-gdv0kvhoq-ishaqyusufs-projects.vercel.app";
	assert.equal(deploymentUrlFromOutput(JSON.stringify({ id: "dpl_example", url, readyState: "READY", target: "production" }, null, 2)), url);
});

test("deployment helper accepts the CLI's automatic agent envelope", () => {
	const url = "https://alghurobaa-h6e3ovaoz-ishaqyusufs-projects.vercel.app";
	assert.equal(deploymentUrlFromOutput(JSON.stringify({ status: "ok", deployment: { url, readyState: "READY", target: "production" } })), url);
	assert.throws(() => deploymentUrlFromOutput(JSON.stringify({ status: "error", deployment: { url, readyState: "READY" } })));
});

test("deployment helper rejects incomplete or unrelated provider output", () => {
	for (const deployment of [
		{ url: "https://example.com", readyState: "READY" },
		{ url: "https://alghurobaa-api.vercel.app", readyState: "BUILDING" },
		{ readyState: "READY" },
	]) {
		assert.throws(() => deploymentUrlFromOutput(JSON.stringify(deployment)));
	}
});
