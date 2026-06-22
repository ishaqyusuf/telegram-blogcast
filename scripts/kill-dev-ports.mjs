import { execFileSync } from "node:child_process";

const ports = [3005, 8085, 8787];

function findPortPids() {
  const found = new Set();

  for (const port of ports) {
    try {
      const output = execFileSync("lsof", ["-ti", `tcp:${port}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });

      for (const pid of output.split(/\s+/).filter(Boolean)) {
        found.add(Number(pid));
      }
    } catch {
      // No process is listening on this port.
    }
  }

  return found;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function stopPids(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
      console.log(`[kill:ports] sent ${signal} to pid ${pid}`);
    } catch (error) {
      console.warn(
        `[kill:ports] could not stop pid ${pid}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

const pids = findPortPids();

if (pids.size === 0) {
  console.log("[kill:ports] no dev ports in use");
  process.exit(0);
}

stopPids(pids, "SIGTERM");

for (let attempt = 0; attempt < 10; attempt += 1) {
  sleep(200);
  if (findPortPids().size === 0) process.exit(0);
}

const remainingPids = findPortPids();
if (remainingPids.size > 0) {
  stopPids(remainingPids, "SIGKILL");
}

for (let attempt = 0; attempt < 10; attempt += 1) {
  sleep(100);
  if (findPortPids().size === 0) process.exit(0);
}

const blockedPorts = [];
for (const port of ports) {
  try {
    execFileSync("lsof", ["-ti", `tcp:${port}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    blockedPorts.push(port);
  } catch {
    // Port is free.
  }
}

if (blockedPorts.length > 0) {
  console.error(`[kill:ports] ports still in use: ${blockedPorts.join(", ")}`);
  process.exit(1);
}
