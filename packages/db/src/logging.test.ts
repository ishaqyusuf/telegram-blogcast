import { expect, test } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseLogDetails, privateDatabaseLogs } from "./logging.js";

test("database diagnostics never enable raw console or query logging", () => {
  expect(privateDatabaseLogs).toEqual([
    { emit: "event", level: "error" },
    { emit: "event", level: "warn" },
  ]);
  expect(databaseLogDetails("error")).toEqual({
    category: "database", level: "error", message: "Database diagnostic; query details withheld.",
  });
  expect(databaseLogDetails("warn").level).toBe("warn");
});

test("Prisma validation errors emit only sanitized diagnostics without connecting to a database", async () => {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: "postgresql://unused:unused@127.0.0.1:1/unused" }),
    log: privateDatabaseLogs,
  });
  const logs: ReturnType<typeof databaseLogDetails>[] = [];
  client.$on("error", () => logs.push(databaseLogDetails("error")));
  try {
    // Missing compound unique key fails validation before any database access.
    await expect(Promise.resolve(Reflect.apply(client.bookDeviceAnnotation.findUnique, client.bookDeviceAnnotation, [
      { where: { ownerHash: "PRIVATE_LOG_SENTINEL" } },
    ]))).rejects.toMatchObject({ name: "PrismaClientValidationError" });
    expect(logs).toEqual([databaseLogDetails("error")]);
    expect(JSON.stringify(logs)).not.toContain("PRIVATE_LOG_SENTINEL");
  } finally {
    await client.$disconnect();
  }
});
