// app/api/telegram/fetcher/route.ts
//
// Control the background message fetcher thread.
//
// GET  /api/telegram/fetcher          → current state
// POST /api/telegram/fetcher          → start { channelId, startId? }
// DELETE /api/telegram/fetcher        → stop

import { NextRequest, NextResponse } from "next/server";
import { messageFetcher } from "@/lib/message-fetcher";

export async function GET() {
    return NextResponse.json(messageFetcher.getState());
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { channelId, startId } = body as {
        channelId: string;
        startId?: number;
    };

    if (!channelId) {
        return NextResponse.json(
            { error: "channelId is required" },
            { status: 400 },
        );
    }

    messageFetcher.start(channelId, startId);
    return NextResponse.json(messageFetcher.getState());
}

export async function DELETE() {
    messageFetcher.stop();
    return NextResponse.json(messageFetcher.getState());
}

