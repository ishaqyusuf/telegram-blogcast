#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const bridgeDir = path.join(root, "services/facebook-media-bridge");
const bridgePython = path.join(bridgeDir, ".venv/bin/python");
const children = new Set();
let shuttingDown = false;

function runSetup(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function spawnService(label, command, args, cwd = root) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`[${label}] failed to start: ${error.message}`);
  });

  children.add(child);
  return child;
}

function stopChildren(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => {
  stopChildren("SIGINT");
});

process.on("SIGTERM", () => {
  stopChildren("SIGTERM");
});

runSetup("node", ["./scripts/kill-dev-ports.mjs"]);

if (existsSync(bridgePython)) {
  const bridge = spawnService(
    "facebook-media-bridge",
    bridgePython,
    ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8790"],
    bridgeDir,
  );

  bridge.on("exit", (code, signal) => {
    children.delete(bridge);
    if (!shuttingDown) {
      console.warn(`[facebook-media-bridge] exited (${signal ?? code}).`);
    }
  });
} else {
  console.warn(
    "[facebook-media-bridge] Not started: services/facebook-media-bridge/.venv/bin/python is missing.",
  );
  console.warn("[facebook-media-bridge] Run once: bun run facebook-media-bridge:install");
}

const turbo = spawnService("turbo-dev", "node", [
  "./node_modules/turbo/bin/turbo",
  "dev",
  "--parallel",
  "--filter=!@acme/api",
]);

turbo.on("exit", (code, signal) => {
  children.delete(turbo);
  stopChildren("SIGTERM");
  process.exit(code ?? (signal ? 1 : 0));
});
