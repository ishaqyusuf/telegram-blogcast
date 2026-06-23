import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "./rest/types";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./trpc/routers/_app";
import { createTRPCContext } from "./trpc/init";
import { consoleLog } from "@acme/utils";
import {
  claimNextTranscriptionJob,
  completeTranscriptionJob,
  failTranscriptionJob,
  getWorkerIdFromBody,
  saveTranscriptionJobChunk,
  updateTranscriptionJobProgress,
} from "./transcription-worker";
const app = new OpenAPIHono<Context>(); //.basePath("/api");

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { db } from "@acme/db";

const TRANSCRIPTION_WORKER_TOKEN = process.env.TRANSCRIPTION_WORKER_TOKEN;
const TRANSCRIPTION_WORKER_STALE_MS = Number.parseInt(
  process.env.TRANSCRIPTION_WORKER_STALE_MS ?? `${10 * 60 * 1000}`,
  10,
);
const TRANSCRIPTION_WORKER_MAX_RETRIES = Number.parseInt(
  process.env.TRANSCRIPTION_WORKER_MAX_RETRIES ?? "3",
  10,
);

const serializeHeaders = (headers: Headers) => {
  if (typeof (headers as any).toJSON === "function") {
    return (headers as any).toJSON();
  }

  return Object.fromEntries(headers.entries());
};

async function readJsonBody(c: any) {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

function isWorkerAuthorized(c: any) {
  if (!TRANSCRIPTION_WORKER_TOKEN) return true;
  const header = c.req.header("authorization") ?? "";
  return header === `Bearer ${TRANSCRIPTION_WORKER_TOKEN}`;
}

app.use(secureHeaders());
if (process.env.NODE_ENV === "development")
  app.use(
    "/api/trpc/*",
    cors({
      // origin: process.env.ALLOWED_API_ORIGINS?.split(",") ?? [],
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowHeaders: [
        "Authorization",
        "content-type",
        "accept-language",
        "Access-Control-Allow-Origin",
      ],
      exposeHeaders: ["Content-Length"],
      maxAge: 86400,
    }),
  );
app.use("/api/trpc/*", async (c) => {
  const res = fetchRequestHandler({
    router: appRouter,
    endpoint: "/api/trpc",
    req: c.req.raw,

    onError(opts) {
      // (opts.path, opts.input, opts.error.message);
      const { path, input, error, ctx, req, type } = opts;

      const { url, headers } = req;
      const msg = {
        path,
        input,
        errorMessage: [error.message, error.code, error.name, error.stack],
        url,
        headers: serializeHeaders(headers),
        port: process.env.PORT,
      };
      consoleLog("ERROR", msg);
    },
    createContext: (c): any => ({
      db,
      // a: c.req
      // user: c.get("user"),
      // env: env(c),
    }),
  });
  return res;
});

// app.use(
//   "/api/trpc/*",
//   trpcServer({
//     router: appRouter,
//     createContext: createTRPCContext,
//     endpoint: "/api/trpc",

//     onError(opts) {
//       // (opts.path, opts.input, opts.error.message);
//       const { path, input, error, ctx, req, type } = opts;

//       const { url, headers } = req;
//       const msg = {
//         path,
//         input,
//         errorMessage: [error.message, error.code, error.name, error.stack],
//         url,
//         headers: headers.toJSON(),
//         port: process.env.PORT,
//       };
//       consoleLog("ERROR", msg);
//     },
//   })
// );
app.get("/", (c) => {
  return c.json({ message: "Congrats! You've deployed Hono to Vercel" });
});

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "al-ghurobaa-api",
    port: process.env.PORT ? Number.parseInt(process.env.PORT) : 3000,
  });
});

app.post("/api/internal/transcription-jobs/claim", async (c) => {
  if (!isWorkerAuthorized(c)) {
    return c.json({ ok: false, error: "Unauthorized worker." }, 401);
  }

  const body = await readJsonBody(c);
  const job = await claimNextTranscriptionJob(db as any, {
    workerId: getWorkerIdFromBody(body),
    staleMs: TRANSCRIPTION_WORKER_STALE_MS,
    maxRetries: TRANSCRIPTION_WORKER_MAX_RETRIES,
    jobId: Number.isInteger(body?.jobId) ? body.jobId : undefined,
  });

  return c.json({ ok: true, job });
});

app.post("/api/internal/transcription-jobs/:id/progress", async (c) => {
  if (!isWorkerAuthorized(c)) {
    return c.json({ ok: false, error: "Unauthorized worker." }, 401);
  }

  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(id)) {
    return c.json({ ok: false, error: "Invalid transcription job id." }, 400);
  }

  const body = await readJsonBody(c);
  const job = await updateTranscriptionJobProgress(db as any, {
    id,
    workerId: getWorkerIdFromBody(body),
    progressPercent: body?.progressPercent,
    stage: body?.stage,
    currentChunk: body?.currentChunk,
    totalChunks: body?.totalChunks,
  });

  if (!job) {
    return c.json(
      { ok: false, error: "Transcription job is not claimed by this worker." },
      409,
    );
  }

  return c.json({ ok: true, job });
});

app.post("/api/internal/transcription-jobs/:id/complete", async (c) => {
  if (!isWorkerAuthorized(c)) {
    return c.json({ ok: false, error: "Unauthorized worker." }, 401);
  }

  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(id)) {
    return c.json({ ok: false, error: "Invalid transcription job id." }, 400);
  }

  const body = await readJsonBody(c);
  const job = await completeTranscriptionJob(db as any, {
    id,
    workerId: getWorkerIdFromBody(body),
    segments: Array.isArray(body?.segments) ? body.segments : undefined,
  });

  if (!job) {
    return c.json({ ok: false, error: "Transcription job not found." }, 404);
  }

  return c.json({ ok: true, job });
});

app.post("/api/internal/transcription-jobs/:id/chunk", async (c) => {
  if (!isWorkerAuthorized(c)) {
    return c.json({ ok: false, error: "Unauthorized worker." }, 401);
  }

  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(id)) {
    return c.json({ ok: false, error: "Invalid transcription job id." }, 400);
  }

  const body = await readJsonBody(c);
  try {
    const job = await saveTranscriptionJobChunk(db as any, {
      id,
      workerId: getWorkerIdFromBody(body),
      chunkStartSec: body?.chunkStartSec,
      chunkEndSec: body?.chunkEndSec,
      segments: Array.isArray(body?.segments) ? body.segments : [],
      progressPercent: body?.progressPercent,
      stage: body?.stage,
      currentChunk: body?.currentChunk,
      totalChunks: body?.totalChunks,
      model: typeof body?.model === "string" ? body.model : undefined,
    });

    if (!job) {
      return c.json(
        { ok: false, error: "Transcription job is not claimed by this worker." },
        409,
      );
    }

    return c.json({ ok: true, job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid chunk.";
    return c.json({ ok: false, error: message }, 400);
  }
});

app.post("/api/internal/transcription-jobs/:id/fail", async (c) => {
  if (!isWorkerAuthorized(c)) {
    return c.json({ ok: false, error: "Unauthorized worker." }, 401);
  }

  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(id)) {
    return c.json({ ok: false, error: "Invalid transcription job id." }, 400);
  }

  const body = await readJsonBody(c);
  const job = await failTranscriptionJob(db as any, {
    id,
    workerId: getWorkerIdFromBody(body),
    progressPercent: body?.progressPercent,
    errorMessage: body?.errorMessage,
  });

  if (!job) {
    return c.json(
      { ok: false, error: "Transcription job is not claimed by this worker." },
      409,
    );
  }

  return c.json({ ok: true, job });
});

export { app };
export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 3000,
  fetch: app.fetch,
};
