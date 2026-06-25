export const transcriptionWorkerJobInclude = {
  media: {
    select: {
      id: true,
      title: true,
      file: { select: { fileName: true } },
      transcript: {
        select: {
          segments: {
            where: {
              chunkStartSec: { not: null },
              chunkEndSec: { not: null },
            },
            select: {
              chunkStartSec: true,
              chunkEndSec: true,
              status: true,
            },
            orderBy: { chunkStartSec: "asc" },
          },
        },
      },
      blog: { select: { id: true, content: true } },
    },
  },
};

export function clampTranscriptionProgress(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function getWorkerIdFromBody(body: any) {
  const workerId =
    typeof body?.workerId === "string" ? body.workerId.trim() : "";
  return workerId || "local-transcriber";
}

function workerOwnedWhere(id: number, workerId: string) {
  return {
    id,
    status: "running",
    OR: [{ workerId }, { workerId: null }],
  };
}

function getSegmentStart(segment: any) {
  return Number(segment?.startSec ?? segment?.start ?? segment?.from);
}

function getSegmentEnd(segment: any) {
  return Number(segment?.endSec ?? segment?.end ?? segment?.to);
}

function normalizeTranscriptWords(words: unknown) {
  if (!Array.isArray(words)) return undefined;

  const normalized = words
    .map((word: any) => ({
      word: String(word?.word ?? "").trim(),
      startSec: Number(word?.startSec ?? word?.start),
      endSec: Number(word?.endSec ?? word?.end),
    }))
    .filter(
      (word) =>
        word.word.length > 0 &&
        Number.isFinite(word.startSec) &&
        Number.isFinite(word.endSec) &&
        word.endSec > word.startSec,
    );

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeTranscriptSegments(
  segments: any[],
  options?: {
    chunkStartSec?: number;
    chunkEndSec?: number;
    model?: string;
  },
) {
  return segments
    .map((segment) => {
      const startSec = getSegmentStart(segment);
      const endSec = getSegmentEnd(segment);
      return {
        startSec,
        endSec,
        text: String(segment?.text ?? "").trim(),
        chunkStartSec:
          typeof segment?.chunkStartSec === "number"
            ? segment.chunkStartSec
            : options?.chunkStartSec,
        chunkEndSec:
          typeof segment?.chunkEndSec === "number"
            ? segment.chunkEndSec
            : options?.chunkEndSec,
        status:
          typeof segment?.status === "string" ? segment.status : "done",
        words: normalizeTranscriptWords(segment?.words),
        model:
          typeof segment?.model === "string"
            ? segment.model
            : options?.model,
      };
    })
    .filter(
      (segment) =>
        Number.isFinite(segment.startSec) &&
        Number.isFinite(segment.endSec) &&
        segment.endSec > segment.startSec &&
        segment.text.length > 0,
    );
}

async function upsertTranscript(tx: any, mediaId: number, status: string) {
  return tx.transcript.upsert({
    where: { mediaId },
    create: { mediaId, status },
    update: { status, updatedAt: new Date() },
  });
}

async function saveTranscriptSegments(tx: any, mediaId: number, segments: any[]) {
  const transcript = await upsertTranscript(tx, mediaId, "done");
  const normalizedSegments = normalizeTranscriptSegments(segments);

  await tx.transcriptSegment.deleteMany({
    where: { transcriptId: transcript.id },
  });

  if (normalizedSegments.length) {
    await tx.transcriptSegment.createMany({
      data: normalizedSegments.map((segment) => ({
        transcriptId: transcript.id,
        ...segment,
      })),
    });
  }

  return transcript;
}

async function saveTranscriptChunk(
  tx: any,
  mediaId: number,
  input: {
    chunkStartSec: number;
    chunkEndSec: number;
    segments: any[];
    model?: string;
  },
) {
  const transcript = await upsertTranscript(tx, mediaId, "processing");
  const normalizedSegments = normalizeTranscriptSegments(input.segments, {
    chunkStartSec: input.chunkStartSec,
    chunkEndSec: input.chunkEndSec,
    model: input.model ?? "whisper-local",
  });

  await tx.transcriptSegment.deleteMany({
    where: {
      transcriptId: transcript.id,
      startSec: { gte: input.chunkStartSec },
      endSec: { lte: input.chunkEndSec },
    },
  });

  if (normalizedSegments.length) {
    await tx.transcriptSegment.createMany({
      data: normalizedSegments.map((segment) => ({
        transcriptId: transcript.id,
        ...segment,
      })),
    });
  }

  return transcript;
}

async function markTranscriptDone(tx: any, mediaId: number) {
  return upsertTranscript(tx, mediaId, "done");
}

export async function claimNextTranscriptionJob(
  db: any,
  options: {
    workerId: string;
    staleMs: number;
    maxRetries: number;
    jobId?: number;
  },
) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - options.staleMs);

  const claimWhere = {
    ...(options.jobId ? { id: options.jobId } : {}),
    OR: [
      { status: "queued" },
      {
        status: "failed",
        retryCount: { lt: options.maxRetries },
      },
      {
        status: "running",
        OR: [{ heartbeatAt: null }, { heartbeatAt: { lt: staleBefore } }],
      },
    ],
  };

  return db.$transaction(async (tx: any) => {
    const nextJob = await tx.transcriptionJob.findFirst({
      where: claimWhere,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    if (!nextJob) return null;

    const claimed = await tx.transcriptionJob.updateMany({
      where: {
        id: nextJob.id,
        ...claimWhere,
      },
      data: {
        status: "running",
        progressPercent: Math.max(nextJob.progressPercent ?? 0, 1),
        stage: "claimed",
        workerId: options.workerId,
        lockedAt: now,
        heartbeatAt: now,
        completedAt: null,
        errorMessage: null,
      },
    });

    if (claimed.count === 0) return null;

    return tx.transcriptionJob.findUnique({
      where: { id: nextJob.id },
      include: transcriptionWorkerJobInclude,
    });
  });
}

export async function updateTranscriptionJobProgress(
  db: any,
  input: {
    id: number;
    workerId: string;
    progressPercent: unknown;
    stage?: string | null;
    currentChunk?: unknown;
    totalChunks?: unknown;
  },
) {
  const updated = await db.transcriptionJob.updateMany({
    where: workerOwnedWhere(input.id, input.workerId),
    data: {
      status: "running",
      progressPercent: clampTranscriptionProgress(input.progressPercent),
      stage:
        typeof input.stage === "string" ? input.stage.slice(0, 120) : null,
      workerId: input.workerId,
      heartbeatAt: new Date(),
      currentChunk: Number.isInteger(input.currentChunk)
        ? input.currentChunk
        : undefined,
      totalChunks: Number.isInteger(input.totalChunks)
        ? input.totalChunks
        : undefined,
    },
  });

  if (updated.count === 0) return null;

  return db.transcriptionJob.findUnique({
    where: { id: input.id },
    include: transcriptionWorkerJobInclude,
  });
}

export async function completeTranscriptionJob(
  db: any,
  input: {
    id: number;
    workerId: string;
    segments?: any[];
  },
) {
  const now = new Date();

  return db.$transaction(async (tx: any) => {
    const current = await tx.transcriptionJob.findFirst({
      where: workerOwnedWhere(input.id, input.workerId),
    });
    if (!current) return null;

    if (Array.isArray(input.segments)) {
      await saveTranscriptSegments(tx, current.mediaId, input.segments);
    } else {
      await markTranscriptDone(tx, current.mediaId);
    }

    return tx.transcriptionJob.update({
      where: { id: input.id },
      data: {
        status: "completed",
        progressPercent: 100,
        stage: "completed",
        heartbeatAt: now,
        completedAt: now,
        errorMessage: null,
      },
      include: transcriptionWorkerJobInclude,
    });
  });
}

export async function saveTranscriptionJobChunk(
  db: any,
  input: {
    id: number;
    workerId: string;
    chunkStartSec: unknown;
    chunkEndSec: unknown;
    segments: any[];
    progressPercent: unknown;
    stage?: string | null;
    currentChunk?: unknown;
    totalChunks?: unknown;
    model?: string | null;
  },
) {
  const chunkStartSec = Number(input.chunkStartSec);
  const chunkEndSec = Number(input.chunkEndSec);

  if (
    !Number.isFinite(chunkStartSec) ||
    !Number.isFinite(chunkEndSec) ||
    chunkEndSec <= chunkStartSec
  ) {
    throw new Error("Invalid transcription chunk range.");
  }

  return db.$transaction(async (tx: any) => {
    const current = await tx.transcriptionJob.findFirst({
      where: workerOwnedWhere(input.id, input.workerId),
    });
    if (!current) return null;

    await saveTranscriptChunk(tx, current.mediaId, {
      chunkStartSec,
      chunkEndSec,
      segments: input.segments,
      model: input.model ?? "whisper-local",
    });

    return tx.transcriptionJob.update({
      where: { id: input.id },
      data: {
        status: "running",
        progressPercent: clampTranscriptionProgress(input.progressPercent),
        stage:
          typeof input.stage === "string"
            ? input.stage.slice(0, 120)
            : "chunk_completed",
        workerId: input.workerId,
        heartbeatAt: new Date(),
        currentChunk: Number.isInteger(input.currentChunk)
          ? input.currentChunk
          : undefined,
        totalChunks: Number.isInteger(input.totalChunks)
          ? input.totalChunks
          : undefined,
        errorMessage: null,
      },
      include: transcriptionWorkerJobInclude,
    });
  });
}

export async function failTranscriptionJob(
  db: any,
  input: {
    id: number;
    workerId: string;
    progressPercent: unknown;
    errorMessage?: string | null;
  },
) {
  const message =
    typeof input.errorMessage === "string"
      ? input.errorMessage.slice(0, 500)
      : "Transcription failed.";

  const updated = await db.transcriptionJob.updateMany({
    where: workerOwnedWhere(input.id, input.workerId),
    data: {
      status: "failed",
      stage: "failed",
      progressPercent: clampTranscriptionProgress(input.progressPercent),
      heartbeatAt: new Date(),
      errorMessage: message,
      retryCount: { increment: 1 },
    },
  });

  if (updated.count === 0) return null;

  return db.transcriptionJob.findUnique({
    where: { id: input.id },
    include: transcriptionWorkerJobInclude,
  });
}
