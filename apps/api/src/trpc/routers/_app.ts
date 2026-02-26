import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { createTRPCRouter } from "../init";
import { postcastRoutes } from "./podcast.route";
import { channelRoutes } from "./channel.route";
import { blogRoutes } from "./blog.routes";

export const appRouter = createTRPCRouter({
  podcasts: postcastRoutes,
  channel: channelRoutes,
  blog: blogRoutes,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
