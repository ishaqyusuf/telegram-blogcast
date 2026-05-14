// export * from "drizzle-orm/sql";
// export { alias } from "drizzle-orm/pg-core";
/* eslint-disable no-restricted-properties */
// Solution for prisma edge: @link https://github.com/prisma/prisma/issues/22050#issuecomment-1821208388
// import { PrismaClient } from "@prisma/client/edge";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
// import { Pool } from "pg";
export * from "@prisma/client";
// Learn more about instantiating PrismaClient in Next.js here: https://www.prisma.io/docs/data-platform/accelerate/getting-started
const prismaClientSingleton = () => {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
        throw new Error("Missing POSTGRES_URL. Set a direct Postgres connection string for Prisma adapter-pg.");
    }
    const clientOptions = {
        log: process.env.NODE_ENV === "development"
            ? [
                // "query",
                "error",
                "warn",
            ]
            : ["error"],
        adapter: new PrismaPg({ connectionString }),
    };
    return new PrismaClient(clientOptions);
};
const globalForPrisma = globalThis;
export const db = 
// globalForPrisma.prisma ??
prismaClientSingleton();
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = db;
