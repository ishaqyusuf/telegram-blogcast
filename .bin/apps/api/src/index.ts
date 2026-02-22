import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "./rest/types";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./trpc/routers/_app";
import { createTRPCContext } from "./trpc/init";
import { consoleLog } from "@acme/utils";
const app = new OpenAPIHono<Context>(); //.basePath("/api");

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { db } from "@acme/db";
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
        headers: headers.toJSON(),
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

export { app };
export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 3000,
  fetch: app.fetch,
};
