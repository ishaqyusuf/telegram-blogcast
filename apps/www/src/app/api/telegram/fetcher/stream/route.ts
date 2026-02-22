// app/api/telegram/fetcher/stream/route.ts
//
// Server-Sent Events (SSE) endpoint.
// The client connects once and receives a real-time stream of fetcher events:
//   - { type: "messages", messages: [...] }
//   - { type: "state",    state: {...}    }
//   - { type: "error",    error: "...", retryIn: ms }
//
// GET /api/telegram/fetcher/stream

import { NextRequest } from "next/server";
import { messageFetcher, FetcherEvent } from "@telegram/message-fetcher";

export const dynamic = "force-dynamic"; // never cache this route

export async function GET(request: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            function send(event: FetcherEvent) {
                const data = `data: ${JSON.stringify(event)}\n\n`;
                controller.enqueue(encoder.encode(data));
            }

            // Push current state immediately on connect
            send({ type: "state", state: messageFetcher.getState() });

            // Forward all future events
            const handler = (event: FetcherEvent) => send(event);
            messageFetcher.on("event", handler);

            // Clean up when the client disconnects
            request.signal.addEventListener("abort", () => {
                messageFetcher.off("event", handler);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}

