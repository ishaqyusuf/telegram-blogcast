// apps/api/src/routers/channel.route.ts
import { createTRPCRouter, publicProcedure } from "../init";
import {
  getChannels,
  syncChannels,
  toggleFetchable,
  getFetchableChannels,
  toggleFetchableSchema,
} from "@api/queries/channel";
import {
  createBlogsFromMessages,
  createBlogsFromMessagesSchema,
  getChannelBlogStats,
} from "@api/queries/blog";

export const channelRoutes = createTRPCRouter({
  // Get all channels from Prisma
  getChannels: publicProcedure.query(async (props) => {
    return getChannels(props.ctx);
  }),

  // Sync missing Telegram channels into Prisma, return merged list
  syncChannels: publicProcedure.mutation(async (props) => {
    return syncChannels(props.ctx);
  }),

  // Toggle isFetchable on a channel
  toggleFetchable: publicProcedure
    .input(toggleFetchableSchema)
    .mutation(async (props) => {
      return toggleFetchable(props.ctx, props.input);
    }),

  // Get only isFetchable channels (used by fetcher to know what to start)
  getFetchableChannels: publicProcedure.query(async (props) => {
    return getFetchableChannels(props.ctx);
  }),

  // Called after each batch completes — persists messages as Blog records
  createBlogsFromMessages: publicProcedure
    .input(createBlogsFromMessagesSchema)
    .mutation(async (props) => {
      return createBlogsFromMessages(props.ctx, props.input);
    }),

  // Blog count for a channel (dashboard stat)
  getChannelBlogStats: publicProcedure
    .input(createBlogsFromMessagesSchema.pick({ channelId: true }))
    .query(async (props) => {
      return getChannelBlogStats(props.ctx, props.input);
    }),
});
