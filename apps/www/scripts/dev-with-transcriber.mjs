import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { startLocalGatewayPublisher } from "./local-gateway-publisher.mjs";
import { isNgrokEnabled, parseNgrokLogLine } from "./ngrok-log.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const wwwDir = resolve(scriptDir, "..");
const repoRoot = resolve(wwwDir, "../..");
const WEB_PORT = 3501;

const children = new Map();
let shuttingDown = false;
let pendingSignal = null;
let gatewayPublisher = null;
let gatewayPublisherGeneration = 0;
const GATEWAY_PUBLISHER_ABORT_CONTROLLER = new AbortController();

function start(
	name,
	command,
	args,
	cwd,
	{ fatal = true, stdio = "inherit" } = {},
) {
	const child = spawn(command, args, {
		cwd,
		env: process.env,
		stdio,
	});

	children.set(name, child);

	child.on("exit", (code, signal) => {
		children.delete(name);

		if (shuttingDown) {
			if (children.size === 0) {
				if (pendingSignal) {
					process.kill(process.pid, pendingSignal);
					return;
				}

				process.exit(process.exitCode ?? 0);
			}
			return;
		}

		const status = signal ? signal : `code ${code ?? 0}`;
		if (!fatal) {
			console.warn(
				`[dev:${name}] stopped with ${status}; local web remains available.`,
			);
			return;
		}

		console.error(`[dev:${name}] exited with ${status}`);
		shutdown("SIGTERM");

		process.exitCode = code ?? (signal ? 1 : 0);
	});

	child.on("error", (error) => {
		children.delete(name);
		if (!fatal) {
			console.warn(
				`[dev:${name}] unavailable: ${error.message}. Local web remains available.`,
			);
			return;
		}

		console.error(`[dev:${name}] failed to start:`, error);
		shutdown("SIGTERM");
		process.exit(1);
	});

	return child;
}

async function shutdown(signal) {
	if (shuttingDown) return;

	shuttingDown = true;
	pendingSignal = signal === "SIGINT" || signal === "SIGTERM" ? signal : null;
	GATEWAY_PUBLISHER_ABORT_CONTROLLER.abort();
	await gatewayPublisher?.stop();

	for (const child of children.values()) {
		if (!child.killed) child.kill(signal);
	}

	if (children.size === 0) process.exit(process.exitCode ?? 0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

start("transcriber", "bun", ["run", "transcriber:dev"], repoRoot);
start("www", "bun", ["run", "dev:next:app"], wwwDir);

if (isNgrokEnabled(process.env.NGROK_ENABLED)) {
	const ngrokArgs = [
		"http",
		String(WEB_PORT),
		"--log",
		"stdout",
		"--log-format",
		"json",
	];

	const ngrok = start("ngrok", "ngrok", ngrokArgs, wwwDir, {
		fatal: false,
		stdio: ["ignore", "pipe", "pipe"],
	});

	let announcedUrl;
	const handleNgrokLine = (line) => {
		const event = parseNgrokLogLine(line);
		if (event.url && event.url !== announcedUrl) {
			announcedUrl = event.url;
			const publisherGeneration = ++gatewayPublisherGeneration;
			console.log(`[dev:ngrok] public web URL: ${event.url}`);
			console.log(`[dev:ngrok] forwarding to http://localhost:${WEB_PORT}`);
			void gatewayPublisher?.stop();
			gatewayPublisher = null;
			void startLocalGatewayPublisher({
				gatewayUrl: event.url,
				signal: GATEWAY_PUBLISHER_ABORT_CONTROLLER.signal,
			}).then((publisher) => {
				if (
					shuttingDown ||
					publisherGeneration !== gatewayPublisherGeneration
				) {
					void publisher.stop();
					return;
				}
				gatewayPublisher = publisher;
			});
		}

		if (
			event.message &&
			(event.level === "warn" ||
				event.level === "error" ||
				event.level === "crit")
		) {
			console.warn(`[dev:ngrok] ${event.message}`);
		}
	};

	if (ngrok.stdout) {
		createInterface({ input: ngrok.stdout }).on("line", handleNgrokLine);
	}
	if (ngrok.stderr) {
		createInterface({ input: ngrok.stderr }).on("line", (line) => {
			if (line.trim()) console.warn(`[dev:ngrok] ${line}`);
		});
	}
} else {
	console.log("[dev:ngrok] disabled by NGROK_ENABLED");
}
