import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

loadEnvFile(resolve("packages/db/.env.production"));

const workerId = `route-smoke-worker-${Date.now()}`;
const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("@prisma/client");
const { app } = await import("../apps/api/src/index.ts");

if (!process.env.POSTGRES_URL) {
  throw new Error("Missing POSTGRES_URL from packages/db/.env.production");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL }),
});

const created = {
  blogId: null,
  mediaId: null,
  jobIds: [],
  transcriptId: null,
};

async function post(path, payload) {
  const headers = { "content-type": "application/json" };
  if (process.env.TRANSCRIPTION_WORKER_TOKEN) {
    headers.authorization = `Bearer ${process.env.TRANSCRIPTION_WORKER_TOKEN}`;
  }

  const response = await app.fetch(
    new Request(`http://route-smoke.local${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ workerId, ...payload }),
    }),
  );
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(
      `${path} failed ${response.status}: ${JSON.stringify(data)}`,
    );
  }
  return data;
}

try {
  const blog = await db.blog.create({
    data: {
      type: "audio",
      status: "route-smoke-test",
      content: "worker transcription queue route smoke test",
      meta: { smokeTest: true, workerId },
    },
  });
  created.blogId = blog.id;

  const media = await db.media.create({
    data: {
      blogId: blog.id,
      mimeType: "audio/mpeg",
      title: "Transcription worker route smoke media",
    },
  });
  created.mediaId = media.id;

  const failJob = await db.transcriptionJob.create({
    data: {
      mediaId: media.id,
      audioUrl: "https://example.com/route-smoke-fail.mp3",
      language: "ar",
      status: "queued",
      progressPercent: 0,
      stage: "queued",
    },
  });
  created.jobIds.push(failJob.id);

  const claimedFail = await post("/api/internal/transcription-jobs/claim", {
    jobId: failJob.id,
  });
  if (claimedFail.job?.id !== failJob.id) {
    throw new Error(`Expected route fail job ${failJob.id} to be claimed.`);
  }

  await post(`/api/internal/transcription-jobs/${failJob.id}/progress`, {
    progressPercent: 37,
    stage: "route_smoke_progress",
    currentChunk: 1,
    totalChunks: 1,
  });

  await post(`/api/internal/transcription-jobs/${failJob.id}/fail`, {
    progressPercent: 37,
    errorMessage: "route smoke failure path",
  });

  const failed = await db.transcriptionJob.findUniqueOrThrow({
    where: { id: failJob.id },
  });
  if (
    failed.status !== "failed" ||
    failed.progressPercent !== 37 ||
    failed.retryCount < 1 ||
    failed.errorMessage !== "route smoke failure path"
  ) {
    throw new Error(`Route failure assertion failed: ${JSON.stringify(failed)}`);
  }

  const completeJob = await db.transcriptionJob.create({
    data: {
      mediaId: media.id,
      audioUrl: "https://example.com/route-smoke-complete.mp3",
      language: "ar",
      status: "queued",
      progressPercent: 0,
      stage: "queued",
    },
  });
  created.jobIds.push(completeJob.id);

  const claimedComplete = await post("/api/internal/transcription-jobs/claim", {
    jobId: completeJob.id,
  });
  if (claimedComplete.job?.id !== completeJob.id) {
    throw new Error(
      `Expected route complete job ${completeJob.id} to be claimed.`,
    );
  }

  await post(`/api/internal/transcription-jobs/${completeJob.id}/complete`, {
    segments: [{ start: 0, end: 2, text: "route smoke transcript segment" }],
  });

  const completed = await db.transcriptionJob.findUniqueOrThrow({
    where: { id: completeJob.id },
  });
  if (completed.status !== "completed" || completed.progressPercent !== 100) {
    throw new Error(
      `Route completion assertion failed: ${JSON.stringify(completed)}`,
    );
  }

  const transcript = await db.transcript.findUniqueOrThrow({
    where: { mediaId: media.id },
    include: { segments: true },
  });
  created.transcriptId = transcript.id;
  if (
    transcript.status !== "done" ||
    transcript.segments.length !== 1 ||
    transcript.segments[0]?.text !== "route smoke transcript segment"
  ) {
    throw new Error(
      `Route transcript assertion failed: ${JSON.stringify(transcript)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        workerId,
        failJob: {
          id: failed.id,
          status: failed.status,
          progressPercent: failed.progressPercent,
          retryCount: failed.retryCount,
        },
        completeJob: {
          id: completed.id,
          status: completed.status,
          progressPercent: completed.progressPercent,
        },
        transcriptSegments: transcript.segments.length,
      },
      null,
      2,
    ),
  );
} finally {
  if (created.transcriptId) {
    await db.transcriptSegment.deleteMany({
      where: { transcriptId: created.transcriptId },
    });
    await db.transcript.deleteMany({ where: { id: created.transcriptId } });
  }
  if (created.jobIds.length) {
    await db.transcriptionJob.deleteMany({
      where: { id: { in: created.jobIds } },
    });
  }
  if (created.mediaId) {
    await db.media.deleteMany({ where: { id: created.mediaId } });
  }
  if (created.blogId) {
    await db.blog.deleteMany({ where: { id: created.blogId } });
  }
  await db.$disconnect();
}
