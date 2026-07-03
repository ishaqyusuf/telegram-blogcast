import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import {
  canonicalizeUrl,
  inferTitle,
  normalizeText,
} from "./export-utils.mjs";

type FacebookSavedItem = {
  title?: string;
  link?: string;
  url?: string;
  collection?: string;
  avatar?: string;
  caption?: string;
  blogId?: number;
};

type FacebookSavedExport = {
  exportedAt?: string;
  source?: {
    type?: string;
    url?: string;
    title?: string | null;
  };
  count?: number;
  items: FacebookSavedItem[];
  validation?: {
    errors?: string[];
  };
};

type ImportOptions = {
  filePath: string;
  dryRun: boolean;
  limit?: number;
  offset: number;
  batchSize: number;
  recentStopAfter?: number;
};

const DEFAULT_FILE = "exports/facebook-saved-2026-06-29.json";
const FACEBOOK_SOURCE = "facebook";
const UNCATEGORIZED_COLLECTION = "Uncategorized";
let database: any = null;
const channelIdByCollection = new Map<string, number>();
const tagIdByTitle = new Map<string, number>();

function parseArgs(argv: string[]): ImportOptions {
  const options: ImportOptions = {
    filePath: DEFAULT_FILE,
    dryRun: false,
    offset: 0,
    batchSize: 50,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--file" && next) {
      options.filePath = next;
      index += 1;
      continue;
    }
    if (arg === "--limit" && next) {
      options.limit = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (arg === "--offset" && next) {
      options.offset = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (arg === "--batch-size" && next) {
      options.batchSize = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (arg === "--recent-stop-after" && next) {
      options.recentStopAfter = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (!arg.startsWith("--")) {
      options.filePath = arg;
    }
  }

  if (!Number.isInteger(options.offset) || options.offset < 0) {
    throw new Error("--offset must be a non-negative integer.");
  }
  if (options.limit != null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1) {
    throw new Error("--batch-size must be a positive integer.");
  }
  options.batchSize = Math.min(options.batchSize, 100);
  if (
    options.recentStopAfter != null &&
    (!Number.isInteger(options.recentStopAfter) || options.recentStopAfter < 1)
  ) {
    throw new Error("--recent-stop-after must be a positive integer.");
  }

  return options;
}

function hashValue(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}

function slugifyChannel(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ascii || `collection-${hashValue(value)}`;
}

function getCollectionName(item: FacebookSavedItem) {
  return normalizeText(item.collection) || UNCATEGORIZED_COLLECTION;
}

function getChannelUsername(collection: string) {
  return `facebook-saved-${slugifyChannel(collection)}`;
}

function getSourceId(item: FacebookSavedItem) {
  return canonicalizeUrl(item.url || item.link || "");
}

function getSourceUrl(item: FacebookSavedItem) {
  return canonicalizeUrl(item.url || item.link || "");
}

function extractHashTags(content: string) {
  return [...(content.match(/#([\p{L}\p{N}_\u0600-\u06FF]+)/gu) ?? [])].map(
    (tag) => tag.slice(1),
  );
}

function normalizeTagTitle(value: string) {
  const trimmed = normalizeText(value);
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}

function uniqueTags(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => normalizeTagTitle(value ?? "")).filter(Boolean)),
  ).slice(0, 20);
}

function buildBlogContent(item: FacebookSavedItem) {
  const title = normalizeText(item.title) || inferTitle(item.caption, "");
  const caption = normalizeText(item.caption);
  const sourceUrl = getSourceUrl(item);
  const parts = [title, caption, sourceUrl].filter(Boolean);
  return Array.from(new Set(parts)).join("\n\n").trim();
}

async function attachTags(tx: any, blogId: number, tags: string[]) {
  for (const title of tags) {
    let tagId = tagIdByTitle.get(title);
    if (!tagId) {
      const tag = await tx.tags.upsert({
        where: { title },
        create: { title },
        update: {},
      });
      tagId = tag.id;
      tagIdByTitle.set(title, tagId);
    }

    await tx.blogTags.create({ data: { blogId, tagId } });
  }
}

async function getOrCreateCollectionChannel(tx: any, collection: string) {
  const cachedId = channelIdByCollection.get(collection);
  if (cachedId) return { id: cachedId };

  const username = getChannelUsername(collection);

  const channel = await tx.channel.upsert({
    where: { username },
    create: {
      username,
      title: collection,
      isFetchable: false,
      meta: {
        source: FACEBOOK_SOURCE,
        facebookSavedCollection: {
          name: collection,
          slug: slugifyChannel(collection),
        },
      },
    },
    update: {
      title: collection,
      meta: {
        source: FACEBOOK_SOURCE,
        facebookSavedCollection: {
          name: collection,
          slug: slugifyChannel(collection),
        },
      },
    },
  });
  channelIdByCollection.set(collection, channel.id);
  return channel;
}

function getMeta(item: FacebookSavedItem, collection: string) {
  return {
    title: normalizeText(item.title) || null,
    facebook: {
      url: getSourceUrl(item),
      avatar: normalizeText(item.avatar) || null,
      collection,
      link: canonicalizeUrl(item.link || ""),
      caption: normalizeText(item.caption) || null,
      mediaDownload: {
        images: "auto",
        video: "manual",
        videoStatus: "not_requested",
      },
    },
  };
}

async function importOne(tx: any, item: FacebookSavedItem) {
  const sourceId = getSourceId(item);
  if (!sourceId) {
    return { status: "invalid" as const, blogId: null };
  }

  const existing = await tx.blog.findUnique({
    where: {
      source_sourceId: {
        source: FACEBOOK_SOURCE,
        sourceId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return { status: "existing" as const, blogId: existing.id };
  }

  const collection = getCollectionName(item);
  const channel = await getOrCreateCollectionChannel(tx, collection);
  const content = buildBlogContent(item);
  const now = new Date();
  const title = normalizeText(item.title) || inferTitle(item.caption, "");

  const blog = await tx.blog.create({
    data: {
      content,
      type: "text",
      published: true,
      publishedAt: now,
      blogDate: now,
      status: "published",
      channelId: channel.id,
      source: FACEBOOK_SOURCE,
      sourceId,
      sourceUrl: getSourceUrl(item),
      sourceSyncedAt: now,
      meta: getMeta(item, collection),
    },
    select: { id: true },
  });

  await attachTags(
    tx,
    blog.id,
    uniqueTags([
      FACEBOOK_SOURCE,
      "saved",
      collection,
      ...extractHashTags(`${title}\n${item.caption ?? ""}`),
    ]),
  );

  return { status: "imported" as const, blogId: blog.id };
}

async function importBatch(tx: any, batch: FacebookSavedItem[]) {
  const prepared = batch
    .map((item) => {
      const sourceId = getSourceId(item);
      if (!sourceId) return null;
      const collection = getCollectionName(item);
      return {
        item,
        sourceId,
        sourceUrl: getSourceUrl(item),
        collection,
      };
    })
    .filter(Boolean) as Array<{
    item: FacebookSavedItem;
    sourceId: string;
    sourceUrl: string;
    collection: string;
  }>;

  const sourceIds = prepared.map((entry) => entry.sourceId);
  const existingBlogs = sourceIds.length
    ? await tx.blog.findMany({
        where: { source: FACEBOOK_SOURCE, sourceId: { in: sourceIds } },
        select: { id: true, sourceId: true },
      })
    : [];
  const existingBySourceId = new Map(
    existingBlogs.map((blog: { id: number; sourceId: string }) => [
      blog.sourceId,
      blog.id,
    ]),
  );

  const channelByCollection = new Map<string, { id: number }>();
  for (const collection of new Set(prepared.map((entry) => entry.collection))) {
    channelByCollection.set(
      collection,
      await getOrCreateCollectionChannel(tx, collection),
    );
  }

  const now = new Date();
  const newEntries = prepared.filter(
    (entry) => !existingBySourceId.has(entry.sourceId),
  );

  if (newEntries.length) {
    await tx.blog.createMany({
      data: newEntries.map((entry) => ({
        content: buildBlogContent(entry.item),
        type: "text",
        published: true,
        publishedAt: now,
        blogDate: now,
        status: "published",
        channelId: channelByCollection.get(entry.collection)?.id,
        source: FACEBOOK_SOURCE,
        sourceId: entry.sourceId,
        sourceUrl: entry.sourceUrl,
        sourceSyncedAt: now,
        meta: getMeta(entry.item, entry.collection),
      })),
      skipDuplicates: true,
    });
  }

  const allBlogs = sourceIds.length
    ? await tx.blog.findMany({
        where: { source: FACEBOOK_SOURCE, sourceId: { in: sourceIds } },
        select: { id: true, sourceId: true },
      })
    : [];
  const blogBySourceId = new Map(
    allBlogs.map((blog: { id: number; sourceId: string }) => [
      blog.sourceId,
      blog.id,
    ]),
  );

  const newBlogEntries = newEntries
    .map((entry) => ({
      ...entry,
      blogId: blogBySourceId.get(entry.sourceId),
    }))
    .filter((entry) => entry.blogId != null) as Array<
    (typeof newEntries)[number] & { blogId: number }
  >;

  const tagTitles = uniqueTags(
    newBlogEntries.flatMap((entry) => [
      FACEBOOK_SOURCE,
      "saved",
      entry.collection,
      ...extractHashTags(`${entry.item.title ?? ""}\n${entry.item.caption ?? ""}`),
    ]),
  );

  if (tagTitles.length) {
    const missingTagRows = tagTitles
      .filter((title) => !tagIdByTitle.has(title))
      .map((title) => ({ title }));

    if (missingTagRows.length) {
      await tx.tags.createMany({
        data: missingTagRows,
        skipDuplicates: true,
      });
    }

    const tags = await tx.tags.findMany({
      where: { title: { in: tagTitles } },
      select: { id: true, title: true },
    });
    for (const tag of tags) tagIdByTitle.set(tag.title, tag.id);

    const blogTagRows = [];
    for (const entry of newBlogEntries) {
      const entryTags = uniqueTags([
        FACEBOOK_SOURCE,
        "saved",
        entry.collection,
        ...extractHashTags(`${entry.item.title ?? ""}\n${entry.item.caption ?? ""}`),
      ]);
      for (const tagTitle of entryTags) {
        const tagId = tagIdByTitle.get(tagTitle);
        if (tagId) blogTagRows.push({ blogId: entry.blogId, tagId });
      }
    }

    if (blogTagRows.length) {
      await tx.blogTags.createMany({ data: blogTagRows });
    }
  }

  return batch.map((item) => {
    const sourceId = getSourceId(item);
    if (!sourceId) return { status: "invalid" as const, blogId: null };
    const blogId = blogBySourceId.get(sourceId) ?? null;
    if (!blogId) return { status: "invalid" as const, blogId: null };
    return {
      status: existingBySourceId.has(sourceId)
        ? ("existing" as const)
        : ("imported" as const),
      blogId,
    };
  });
}

async function writeUpdatedExport(filePath: string, payload: FacebookSavedExport) {
  payload.count = payload.items.length;
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tmpPath, filePath);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(
    await readFile(options.filePath, "utf8"),
  ) as FacebookSavedExport;

  if (!Array.isArray(payload.items)) {
    throw new Error("Export file must contain an items array.");
  }

  const start = options.offset;
  const end = options.limit == null ? payload.items.length : start + options.limit;
  const selected = payload.items.slice(start, end);
  const stats = {
    file: options.filePath,
    dryRun: options.dryRun,
    selected: selected.length,
    imported: 0,
    existing: 0,
    invalid: 0,
    updatedJson: 0,
    stoppedEarly: false,
  };

  let existingStreak = 0;
  if (!options.dryRun) {
    const dbModule = await import("@acme/db");
    database = dbModule.db;
  }

  for (let batchStart = 0; batchStart < selected.length; batchStart += options.batchSize) {
    const batch = selected.slice(batchStart, batchStart + options.batchSize);
    const batchIndexOffset = start + batchStart;

    if (options.dryRun) {
      for (const [index, item] of batch.entries()) {
        const sourceId = getSourceId(item);
        const collection = getCollectionName(item);
        if (!sourceId) stats.invalid += 1;
        console.log(
          JSON.stringify({
            action: "dry-run",
            index: batchIndexOffset + index,
            sourceId,
            channel: getChannelUsername(collection),
            title: normalizeText(item.title) || inferTitle(item.caption, ""),
            hasBlogId: Number.isInteger(item.blogId),
          }),
        );
      }
      continue;
    }

    const results = await database.$transaction(
      (tx: any) => importBatch(tx, batch),
      {
        timeout: 60_000,
        maxWait: 10_000,
      },
    );

    for (const [index, result] of results.entries()) {
      const item = payload.items[batchIndexOffset + index];
      if (!item) continue;

      if (result.status === "imported") stats.imported += 1;
      if (result.status === "existing") stats.existing += 1;
      if (result.status === "invalid") stats.invalid += 1;

      if (result.blogId != null && item.blogId !== result.blogId) {
        item.blogId = result.blogId;
        stats.updatedJson += 1;
      }

      if (result.status === "existing") existingStreak += 1;
      else existingStreak = 0;

      if (
        options.recentStopAfter != null &&
        existingStreak >= options.recentStopAfter
      ) {
        stats.stoppedEarly = true;
        break;
      }
    }

    await writeUpdatedExport(options.filePath, payload);

    console.log(
      JSON.stringify({
        action: "batch-complete",
        from: batchIndexOffset,
        to: batchIndexOffset + batch.length - 1,
        ...stats,
      }),
    );

    if (stats.stoppedEarly) break;
  }

  console.log(JSON.stringify({ action: "complete", ...stats }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database?.$disconnect?.();
  });
