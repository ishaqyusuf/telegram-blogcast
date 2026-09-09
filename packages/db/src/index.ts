// export * from "drizzle-orm/sql";
// export { alias } from "drizzle-orm/pg-core";
/* eslint-disable no-restricted-properties */

// Solution for prisma edge: @link https://github.com/prisma/prisma/issues/22050#issuecomment-1821208388
// import { PrismaClient } from "@prisma/client/edge";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import { databaseLogDetails, privateDatabaseLogs } from "./logging.js";
// import { Pool } from "pg";

export { Prisma, PrismaClient };
export type {
  AiTokenUsage,
  Album,
  AlbumAudioIndex,
  AlbumBookReference,
  AlbumLocation,
  Author,
  Blog,
  BlogComments,
  BlogLocation,
  BlogTags,
  BlogViews,
  Book,
  BookAuthor,
  BookImportHistory,
  BookPage,
  BookPageComment,
  BookPageFootnote,
  BookPageHighlight,
  BookPageImportHistory,
  BookPageParagraph,
  BookShelf,
  BookTocNode,
  BookVolume,
  Channel,
  Device,
  File,
  Location,
  LocalServiceJob,
  Media,
  MediaBookPageReference,
  MediaLocation,
  Playlist,
  PlaylistEpisode,
  Reaction,
  RecentlyPlayed,
  RecentlyViewed,
  Search,
  ShamelaRawPage,
  ShamelaStagedPageParse,
  Tags,
  Thumbnail,
  Transcript,
  TranscriptSegment,
  TranscriptionJob,
  User,
} from "@prisma/client";

// Learn more about instantiating PrismaClient in Next.js here: https://www.prisma.io/docs/data-platform/accelerate/getting-started
const prismaClientSingleton = () => {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "Missing POSTGRES_URL. Set a direct Postgres connection string for Prisma adapter-pg.",
    );
  }

  const clientOptions = {
    log: privateDatabaseLogs,
    adapter: new PrismaPg(
      { connectionString },
      process.env.POSTGRES_SCHEMA?.trim()
        ? { schema: process.env.POSTGRES_SCHEMA.trim() }
        : undefined,
    ),
  } satisfies Prisma.PrismaClientOptions;

  const client = new PrismaClient(clientOptions);
  client.$on("error", () => console.error(databaseLogDetails("error")));
  client.$on("warn", () => console.warn(databaseLogDetails("warn")));
  return client;
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const db = globalForPrisma.prisma ?? prismaClientSingleton();
export type Database = typeof db;
export type Db = Database;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
