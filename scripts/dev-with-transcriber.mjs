import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function start(name, command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  children.push({ child, name });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    for (const entry of children) {
      if (entry.child !== child && !entry.child.killed) {
        entry.child.kill("SIGTERM");
      }
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error(`[${name}] failed to start:`, error);
    if (!shuttingDown) {
      shuttingDown = true;
      for (const entry of children) {
        if (entry.child !== child && !entry.child.killed) {
          entry.child.kill("SIGTERM");
        }
      }
    }
    process.exit(1);
  });
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const { child } of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start("transcriber", "bun", ["run", "transcriber:dev"]);
start("turbo", "node", [
  "./node_modules/turbo/bin/turbo",
  "dev",
  "--parallel",
  "--filter=!@acme/api",
]);
