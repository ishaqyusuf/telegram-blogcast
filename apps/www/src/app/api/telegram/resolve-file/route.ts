// app/api/telegram/resolve-file/route.js
//
// One-off endpoint to resolve a Bot API file_id for a single message.
// Useful when you've already fetched messages without resolveFiles=true
// and want to lazily resolve file_ids on demand.
//
// POST /api/telegram/resolve-file
// Body: { channelId: string, messageId: number }
// Response: { fileId: string | null }

import { NextResponse } from "next/server";
import { getClient } from "@telegram/telegram-client";
import { resolveFileId } from "@telegram/file-id-resolver";

export async function POST(request) {
    try {
        const { channelId, messageId } = await request.json();

        if (!channelId || !messageId) {
            return NextResponse.json(
                { error: "channelId and messageId are required" },
                { status: 400 },
            );
        }

        const client = await getClient();
        const fileId = await resolveFileId(client, channelId, messageId);

        return NextResponse.json({ fileId });
    } catch (err) {
        console.error("[resolve-file]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

