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

const workerId = `smoke-worker-${Date.now()}`;
const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("@prisma/client");
const {
  claimNextTranscriptionJob,
  completeTranscriptionJob,
  failTranscriptionJob,
  updateTranscriptionJobProgress,
} = await import("../apps/api/src/transcription-worker.ts");

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

try {
  const blog = await db.blog.create({
    data: {
      type: "audio",
      status: "smoke-test",
      content: "worker transcription queue smoke test",
      meta: { smokeTest: true, workerId },
    },
  });
  created.blogId = blog.id;

  const media = await db.media.create({
    data: {
      blogId: blog.id,
      mimeType: "audio/mpeg",
      title: "Transcription worker smoke media",
    },
  });
  created.mediaId = media.id;

  const failJob = await db.transcriptionJob.create({
    data: {
      mediaId: media.id,
      audioUrl: "https://example.com/smoke-fail.mp3",
      language: "ar",
      status: "queued",
      progressPercent: 0,
      stage: "queued",
    },
  });
  created.jobIds.push(failJob.id);

  const claimedFail = await claimNextTranscriptionJob(db, {
    workerId,
    staleMs: 10 * 60 * 1000,
    maxRetries: 3,
    jobId: failJob.id,
  });
  if (claimedFail?.id !== failJob.id) {
    throw new Error(`Expected fail job ${failJob.id} to be claimed first.`);
  }

  await updateTranscriptionJobProgress(db, {
    id: failJob.id,
    workerId,
    progressPercent: 42,
    stage: "smoke_progress",
    currentChunk: 1,
    totalChunks: 1,
  });

  await failTranscriptionJob(db, {
    id: failJob.id,
    workerId,
    progressPercent: 42,
    errorMessage: "smoke failure path",
  });

  const failed = await db.transcriptionJob.findUniqueOrThrow({
    where: { id: failJob.id },
  });
  if (
    failed.status !== "failed" ||
    failed.progressPercent !== 42 ||
    failed.retryCount < 1 ||
    failed.errorMessage !== "smoke failure path"
  ) {
    throw new Error(`Failure path assertion failed: ${JSON.stringify(failed)}`);
  }

  const completeJob = await db.transcriptionJob.create({
    data: {
      mediaId: media.id,
      audioUrl: "https://example.com/smoke-complete.mp3",
      language: "ar",
      status: "queued",
      progressPercent: 0,
      stage: "queued",
    },
  });
  created.jobIds.push(completeJob.id);

  const claimedComplete = await claimNextTranscriptionJob(db, {
    workerId,
    staleMs: 10 * 60 * 1000,
    maxRetries: 3,
    jobId: completeJob.id,
  });
  if (claimedComplete?.id !== completeJob.id) {
    throw new Error(
      `Expected complete job ${completeJob.id} to be claimed second.`,
    );
  }

  await completeTranscriptionJob(db, {
    id: completeJob.id,
    workerId,
    segments: [{ start: 0, end: 1.5, text: "smoke transcript segment" }],
  });

  const completed = await db.transcriptionJob.findUniqueOrThrow({
    where: { id: completeJob.id },
  });
  if (completed.status !== "completed" || completed.progressPercent !== 100) {
    throw new Error(
      `Completion path assertion failed: ${JSON.stringify(completed)}`,
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
    transcript.segments[0]?.text !== "smoke transcript segment"
  ) {
    throw new Error(
      `Transcript assertion failed: ${JSON.stringify(transcript)}`,
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
