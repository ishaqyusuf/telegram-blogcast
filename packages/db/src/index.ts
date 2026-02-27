// export * from "drizzle-orm/sql";
// export { alias } from "drizzle-orm/pg-core";
/* eslint-disable no-restricted-properties */

// Solution for prisma edge: @link https://github.com/prisma/prisma/issues/22050#issuecomment-1821208388
// import { PrismaClient } from "@prisma/client/edge";
// import { withAccelerate } from "@prisma/extension-accelerate";

import { PrismaClient, Prisma } from "@prisma/client";
// import { withAccelerate } from "@prisma/extension-accelerate";

export * from "@prisma/client";

// Learn more about instantiating PrismaClient in Next.js here: https://www.prisma.io/docs/data-platform/accelerate/getting-started
const prismaClientSingleton = () => {
  const clientOptions: Prisma.PrismaClientOptions = {
    log:
      process.env.NODE_ENV === "development"
        ? [
            // "query",
            "error",
            "warn",
          ]
        : ["error"],
  };

  // const accelerateUrl = process.env.POSTGRES_URL;
  // if (accelerateUrl) {
  //   (
  //     clientOptions as Prisma.PrismaClientOptions & {
  //       accelerateUrl?: string;
  //     }
  //   ).accelerateUrl = accelerateUrl;
  // }

  return new PrismaClient(clientOptions);
  // .$extends(withAccelerate());
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const db =
  // globalForPrisma.prisma ??
  prismaClientSingleton();
export type Database = typeof db;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
