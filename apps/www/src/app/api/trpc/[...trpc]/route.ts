import { app } from "@api/index";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handleRequest = async (request: Request) => {
  try {
    return await app.fetch(request);
  } catch (error) {
    console.error("[apps/www] /api/trpc handler failed.", {
      method: request.method,
      url: request.url,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : String(error),
    });

    return Response.json(
      {
        error: "TRPC_GATEWAY_ERROR",
        message:
          "apps/www failed to execute the shared tRPC handler. Check the server logs for the original stack trace.",
      },
      {
        status: 500,
      },
    );
  }
};

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const OPTIONS = handleRequest;
