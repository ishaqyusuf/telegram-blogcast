// apps/api/src/routers/channel.route.ts
import { createTRPCRouter, publicProcedure } from "../init";
import { z } from "zod";
import {
  getChannels,
  getFetchableChannels,
  syncChannels,
  toggleFetchable,
  toggleFetchableSchema,
  clearChannelRecords,
  clearChannelRecordsSchema,
  startFetch,
  startFetchSchema,
  stopFetch,
  getFetcherState,
} from "../../queries/channel";
import {
  saveBatch,
  saveBatchSchema,
  getLatestMessageId,
} from "../../queries/blog";

export const channelRoutes = createTRPCRouter({
  // ── Reads ──────────────────────────────────────────────────────────────────
  getChannels: publicProcedure.query(async (props) => {
    return getChannels(props.ctx);
  }),

  getChannel: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const channel = await ctx.db.channel.findFirstOrThrow({
        where: { id: input.id, deletedAt: null },
      });
      const totalBlogs = await ctx.db.blog.count({
        where: { channelId: input.id, deletedAt: null },
      });
      return { ...channel, stats: { totalBlogs } };
    }),

  getFetchableChannels: publicProcedure.query(async (props) => {
    return getFetchableChannels(props.ctx);
  }),

  // ── Sync ───────────────────────────────────────────────────────────────────
  syncChannels: publicProcedure.mutation(async (props) => {
    return syncChannels(props.ctx);
  }),

  toggleFetchable: publicProcedure
    .input(toggleFetchableSchema)
    .mutation(async (props) => {
      return toggleFetchable(props.ctx, props.input);
    }),

  clearChannelRecords: publicProcedure
    .input(clearChannelRecordsSchema)
    .mutation(async (props) => {
      return clearChannelRecords(props.ctx, props.input);
    }),

  // ── Fetcher control (runs in API process) ──────────────────────────────────
  startFetch: publicProcedure
    .input(startFetchSchema)
    .mutation(async (props) => {
      return startFetch(props.ctx, props.input);
    }),

  stopFetch: publicProcedure.mutation(async () => {
    return stopFetch();
  }),

  getFetcherState: publicProcedure.query(async () => {
    return getFetcherState();
  }),

  // ── Blog persistence ───────────────────────────────────────────────────────
  saveBatch: publicProcedure.input(saveBatchSchema).mutation(async (props) => {
    return saveBatch(props.ctx, props.input);
  }),

  getLatestMessageId: publicProcedure
    .input(saveBatchSchema.pick({ channelId: true }))
    .query(async (props) => {
      return getLatestMessageId(props.ctx, props.input);
    }),
});
