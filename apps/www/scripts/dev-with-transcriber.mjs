import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const wwwDir = resolve(scriptDir, "..");
const repoRoot = resolve(wwwDir, "../..");

const children = new Map();
let shuttingDown = false;
let pendingSignal = null;

function start(name, command, args, cwd) {
	const child = spawn(command, args, {
		cwd,
		env: process.env,
		stdio: "inherit",
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
		console.error(`[dev:${name}] exited with ${status}`);
		shutdown("SIGTERM");

		process.exitCode = code ?? (signal ? 1 : 0);
	});

	child.on("error", (error) => {
		console.error(`[dev:${name}] failed to start:`, error);
		shutdown("SIGTERM");
		process.exit(1);
	});

	return child;
}

function shutdown(signal) {
	if (shuttingDown) return;

	shuttingDown = true;
	pendingSignal = signal === "SIGINT" || signal === "SIGTERM" ? signal : null;

	for (const child of children.values()) {
		if (!child.killed) child.kill(signal);
	}

	if (children.size === 0) process.exit(process.exitCode ?? 0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start("transcriber", "bun", ["run", "transcriber:dev"], repoRoot);
start("www", "bun", ["run", "dev:next:app"], wwwDir);
