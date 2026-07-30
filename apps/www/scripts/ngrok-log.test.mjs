import assert from "node:assert/strict";
import test from "node:test";

import { isNgrokEnabled, parseNgrokLogLine } from "./ngrok-log.mjs";

test("ngrok starts by default and supports an explicit opt-out", () => {
	assert.equal(isNgrokEnabled(undefined), true);
	assert.equal(isNgrokEnabled("true"), true);
	assert.equal(isNgrokEnabled("0"), false);
	assert.equal(isNgrokEnabled("OFF"), false);
});

test("extracts the public URL from an ngrok JSON log event", () => {
	assert.deepEqual(
		parseNgrokLogLine(
			'{"lvl":"info","msg":"started tunnel","addr":"http://localhost:3501","url":"https://example.ngrok-free.app"}',
		),
		{
			level: "info",
			message: "started tunnel",
			url: "https://example.ngrok-free.app",
		},
	);
});

test("keeps ngrok error details for the web runner", () => {
	assert.deepEqual(
		parseNgrokLogLine(
			'{"lvl":"error","msg":"failed to start tunnel","err":"authentication failed"}',
		),
		{
			level: "error",
			message: "failed to start tunnel: authentication failed",
			url: undefined,
		},
	);
});
