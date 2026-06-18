import type { TRPCContext } from "@api/trpc/init";
import type { BlogMeta } from "@api/type";
import {
  fetchChannelMessageStats,
  fetchMessages,
} from "@telegram/message-service";
import { z } from "zod";
import { saveBatch, type IncomingMessage } from "./blog";

export const startRecentUpdateJobSchema = z.object({
  channelIds: z.array(z.number()).min(1),
  maxPerChannel: z.number().positive().max(100).optional(),
});

export type StartRecentUpdateJobSchema = z.infer<
  typeof startRecentUpdateJobSchema
>;

type ChannelUpdateStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

type RecentUpdateJobStatus = "running" | "completed";

type ChannelUpdateItem = {
  channelId: number;
  title: string | null;
  username: string;
  status: ChannelUpdateStatus;
  beforeCount: number;
  latestKnownCount: number | null;
  latestKnownMessageId: number | null;
  newestStoredMessageId: number | null;
  lastFetchedAt: string | null;
  fetchedCount: number;
  finalStoredCount: number | null;
  error: string | null;
  skipReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

type RecentUpdateJob = {
  id: string;
  status: RecentUpdateJobStatus;
  startedAt: string;
  finishedAt: string | null;
  maxPerChannel: number;
  channels: ChannelUpdateItem[];
  totalNewChats: number;
  selectedCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
};

type ChannelUpdateSummaryItem = {
  channelId: number;
  title: string | null;
  username: string;
  storedCount: number;
  latestKnownCount: number | null;
  latestKnownMessageId: number | null;
  newestStoredMessageId: number | null;
  lastFetchedAt: string | null;
  delta: number | null;
  canUpdate: boolean;
};

let activeJob: RecentUpdateJob | null = null;
let latestCompletedJob: RecentUpdateJob | null = null;
let runnerActive = false;

function nowIso() {
  return new Date().toISOString();
}

function readTelegramMessageId(meta: unknown): number | null {
  const id = (meta as BlogMeta | null | undefined)?.telegramMessageId;
  return typeof id === "number" ? id : null;
}

function snapshotJob(job: RecentUpdateJob | null) {
  if (!job) return null;
  return {
    ...job,
    channels: job.channels.map((channel) => ({ ...channel })),
  };
}

function refreshJobCounts(job: RecentUpdateJob) {
  job.totalNewChats = job.channels.reduce(
    (total, channel) => total + channel.fetchedCount,
    0,
  );
  job.selectedCount = job.channels.length;
  job.completedCount = job.channels.filter(
    (channel) => channel.status === "completed",
  ).length;
  job.failedCount = job.channels.filter(
    (channel) => channel.status === "failed",
  ).length;
  job.skippedCount = job.channels.filter(
    (channel) => channel.status === "skipped",
  ).length;
}

async function getStoredChannelCounts(
  ctx: TRPCContext,
  channelIds?: number[],
) {
  const where = {
    deletedAt: null,
    ...(channelIds ? { channelId: { in: channelIds } } : {}),
  };
  const [counts, latestDates, blogs] = await Promise.all([
    ctx.db.blog.groupBy({
      by: ["channelId"],
      where,
      _count: { _all: true },
    }),
    ctx.db.blog.groupBy({
      by: ["channelId"],
      where,
      _max: { blogDate: true },
    }),
    ctx.db.blog.findMany({
      where,
      select: { channelId: true, meta: true },
    }),
  ]);

  const countMap = new Map<number, number>();
  const latestDateMap = new Map<number, string | null>();
  const newestIdMap = new Map<number, number>();

  counts.forEach((row: any) => {
    if (row.channelId !== null) countMap.set(row.channelId, row._count._all);
  });
  latestDates.forEach((row: any) => {
    if (row.channelId !== null) {
      latestDateMap.set(
        row.channelId,
        row._max.blogDate ? row._max.blogDate.toISOString() : null,
      );
    }
  });
  blogs.forEach((blog) => {
    if (blog.channelId === null) return;
    const id = readTelegramMessageId(blog.meta);
    if (id === null) return;
    newestIdMap.set(
      blog.channelId,
      Math.max(newestIdMap.get(blog.channelId) ?? 0, id),
    );
  });

  return { countMap, latestDateMap, newestIdMap };
}

async function fetchStatsSafely(username: string) {
  try {
    return await fetchChannelMessageStats(username);
  } catch {
    return { latestKnownCount: null, latestKnownMessageId: null };
  }
}

export async function getUpdatePromptSummary(ctx: TRPCContext) {
  const { countMap, latestDateMap, newestIdMap } =
    await getStoredChannelCounts(ctx);
  const fetchedChannelIds = Array.from(countMap.entries())
    .filter(([, count]) => count > 0)
    .map(([channelId]) => channelId);

  if (fetchedChannelIds.length === 0) {
    return { channels: [], generatedAt: nowIso() };
  }

  const channels = await ctx.db.channel.findMany({
    where: { id: { in: fetchedChannelIds }, deletedAt: null },
    orderBy: [{ title: "asc" }],
    select: { id: true, title: true, username: true },
  });

  const rows = await Promise.all(
    channels.map(async (channel): Promise<ChannelUpdateSummaryItem> => {
      const stats = await fetchStatsSafely(channel.username);
      const storedCount = countMap.get(channel.id) ?? 0;
      const latestKnownCount = stats.latestKnownCount;
      const delta =
        latestKnownCount === null
          ? null
          : Math.max(0, latestKnownCount - storedCount);

      return {
        channelId: channel.id,
        title: channel.title,
        username: channel.username,
        storedCount,
        latestKnownCount,
        latestKnownMessageId: stats.latestKnownMessageId,
        newestStoredMessageId: newestIdMap.get(channel.id) ?? null,
        lastFetchedAt: latestDateMap.get(channel.id) ?? null,
        delta,
        canUpdate:
          storedCount > 0 && (newestIdMap.get(channel.id) ?? null) !== null,
      };
    }),
  );

  return { channels: rows, generatedAt: nowIso() };
}

async function buildJobItems(
  ctx: TRPCContext,
  channelIds: number[],
): Promise<ChannelUpdateItem[]> {
  const uniqueIds = Array.from(new Set(channelIds));
  const channels = await ctx.db.channel.findMany({
    where: { id: { in: uniqueIds }, deletedAt: null },
    select: { id: true, title: true, username: true },
  });
  const channelMap = new Map(channels.map((channel) => [channel.id, channel]));
  const { countMap, latestDateMap, newestIdMap } = await getStoredChannelCounts(
    ctx,
    uniqueIds,
  );

  return Promise.all(
    uniqueIds.flatMap((channelId) => {
      const channel = channelMap.get(channelId);
      if (!channel) return [];
      return [
        fetchStatsSafely(channel.username).then((stats) => ({
          channelId: channel.id,
          title: channel.title,
          username: channel.username,
          status: "queued" as const,
          beforeCount: countMap.get(channel.id) ?? 0,
          latestKnownCount: stats.latestKnownCount,
          latestKnownMessageId: stats.latestKnownMessageId,
          newestStoredMessageId: newestIdMap.get(channel.id) ?? null,
          lastFetchedAt: latestDateMap.get(channel.id) ?? null,
          fetchedCount: 0,
          finalStoredCount: null,
          error: null,
          skipReason: null,
          startedAt: null,
          finishedAt: null,
        })),
      ];
    }),
  );
}

async function countStoredBlogs(ctx: TRPCContext, channelId: number) {
  return ctx.db.blog.count({ where: { channelId, deletedAt: null } });
}

async function runChannelUpdate(
  ctx: TRPCContext,
  item: ChannelUpdateItem,
  limit: number,
) {
  item.status = "running";
  item.startedAt = nowIso();

  if (item.newestStoredMessageId === null) {
    item.status = "skipped";
    item.skipReason = "skipped_no_existing_messages";
    item.finishedAt = nowIso();
    item.finalStoredCount = item.beforeCount;
    return;
  }

  const result = await fetchMessages(item.username, {
    limit,
    minId: item.newestStoredMessageId,
    resolveFiles: true,
  });
  const mapped: IncomingMessage[] = result.messages.map((message) => ({
    id: message.id,
    text: message.text,
    date: message.date,
    media: message.media ?? null,
  }));
  const saveResult = await saveBatch(ctx, {
    channelId: item.channelId,
    messages: mapped,
  });

  item.fetchedCount = saveResult.created ?? 0;
  item.finalStoredCount = await countStoredBlogs(ctx, item.channelId);
  item.status = "completed";
  item.finishedAt = nowIso();
}

async function runJob(ctx: TRPCContext, job: RecentUpdateJob) {
  if (runnerActive) return;
  runnerActive = true;

  try {
    for (let index = 0; index < job.channels.length; index++) {
      const item = job.channels[index];
      if (!item || item.status !== "queued") continue;

      try {
        await runChannelUpdate(ctx, item, job.maxPerChannel);
      } catch (error) {
        item.status = "failed";
        item.error =
          error instanceof Error ? error.message : "Channel update failed.";
        item.finishedAt = nowIso();
        item.finalStoredCount = await countStoredBlogs(ctx, item.channelId).catch(
          () => item.beforeCount,
        );
      } finally {
        refreshJobCounts(job);
      }
    }
  } finally {
    refreshJobCounts(job);
    job.status = "completed";
    job.finishedAt = nowIso();
    latestCompletedJob = snapshotJob(job);
    activeJob = null;
    runnerActive = false;
  }
}

export async function startRecentUpdateJob(
  ctx: TRPCContext,
  input: StartRecentUpdateJobSchema,
) {
  const uniqueIds = Array.from(new Set(input.channelIds));
  if (uniqueIds.length === 0) throw new Error("Select at least one channel.");

  const existingIds = new Set(
    activeJob?.channels.map((channel) => channel.channelId) ?? [],
  );
  const newIds = uniqueIds.filter((channelId) => !existingIds.has(channelId));
  const newItems = await buildJobItems(ctx, newIds);

  if (activeJob) {
    activeJob.channels.push(...newItems);
    refreshJobCounts(activeJob);
    void runJob(ctx, activeJob);
    return snapshotJob(activeJob);
  }

  if (newItems.length === 0) {
    throw new Error("No valid channels were selected.");
  }

  const job: RecentUpdateJob = {
    id: `recent-update-${Date.now()}`,
    status: "running",
    startedAt: nowIso(),
    finishedAt: null,
    maxPerChannel: input.maxPerChannel ?? 100,
    channels: newItems,
    totalNewChats: 0,
    selectedCount: newItems.length,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
  };

  activeJob = job;
  void runJob(ctx, job);
  return snapshotJob(job);
}

export async function getRecentUpdateJob() {
  return {
    activeJob: snapshotJob(activeJob),
    latestCompletedJob: snapshotJob(latestCompletedJob),
    generatedAt: nowIso(),
  };
}
