import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, env } from "prisma/config";

const envPath = resolve(process.cwd(), "../../.env");

if (existsSync(envPath)) {
  const envText = readFileSync(envPath, "utf8");

  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export default defineConfig({
  schema: "./src/schema",
  // engine: "client",
  datasource: {
    url: process.env.POSTGRES_URL ?? "",
    ...(process.env.DIRECT_URL
      ? {
          directUrl: process.env.DIRECT_URL,
        }
      : {}),
  },
});
