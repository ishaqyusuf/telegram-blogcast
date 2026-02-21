// app/api/telegram/channels/[channelId]/messages/route.ts
//
// One-shot paginated message fetch.
// Delegates entirely to messageService — no GramJS calls here.
//
// GET /api/telegram/channels/[channelId]/messages
//
// Query params:
//   limit        – messages per page (default 20, max 100)
//   startId      – cursor: fetch messages with id < startId (older)
//   resolveFiles – "true" to resolve Bot API file_ids (adds latency)
//
// Response:
// {
//   messages:    FetchedMessage[]
//   nextStartId: number | null    ← pass back as startId for next page
// }

import { NextRequest, NextResponse } from "next/server";
import { fetchMessages } from "@/lib/message-service";

export async function GET(
    request: NextRequest,
    { params }: { params: { channelId: string } },
) {
    try {
        const { channelId } = params;
        const { searchParams } = new URL(request.url);

        const limit = parseInt(searchParams.get("limit") ?? "20");
        const startId = searchParams.get("startId")
            ? parseInt(searchParams.get("startId")!)
            : undefined;
        const resolveFiles = searchParams.get("resolveFiles") === "true";

        const result = await fetchMessages(channelId, {
            limit,
            startId,
            resolveFiles,
        });

        return NextResponse.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[messages route]", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

