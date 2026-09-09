import type { Prisma } from "@prisma/client";

// Prisma messages can contain query arguments, including private annotation text.
export const privateDatabaseLogs = [
  { emit: "event", level: "error" },
  { emit: "event", level: "warn" },
] satisfies Prisma.LogDefinition[];

export function databaseLogDetails(level: "error" | "warn") {
  return { category: "database", level, message: "Database diagnostic; query details withheld." };
}
