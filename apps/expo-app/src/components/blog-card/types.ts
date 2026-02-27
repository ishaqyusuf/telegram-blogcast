import { RouterOutputs } from "@api/trpc/routers/_app";

export type BlogItem = RouterOutputs["blog"]["posts"]["data"][number];

export type BlogCardVariant =
  | "audio"
  | "text+image"
  | "image"
  | "text"
  | "video"
  | "unknown";
