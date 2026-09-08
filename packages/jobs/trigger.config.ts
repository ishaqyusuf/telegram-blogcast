import { defineConfig } from "@trigger.dev/sdk/v3";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID?.trim() || "proj_ryiraaguagaettphjklm",
  runtime: "node-22",
  logLevel: "log",
  maxDuration: 180,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [
      syncEnvVars(() => {
        const value = process.env.POSTGRES_URL?.trim();
        if (!value) throw new Error("POSTGRES_URL is required for the chapter worker.");
        return { POSTGRES_URL: value, ...(process.env.POSTGRES_SCHEMA
          ? { POSTGRES_SCHEMA: process.env.POSTGRES_SCHEMA } : {}) };
      }, { override: true }),
    ],
  },
  dirs: ["./src/book-tasks"],
});
