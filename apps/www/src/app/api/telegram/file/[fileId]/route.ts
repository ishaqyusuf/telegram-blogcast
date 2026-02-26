import { NextRequest } from "next/server";

type TelegramGetFileResponse = {
    ok: boolean;
    result?: {
        file_path?: string;
    };
    description?: string;
};

async function getTelegramFilePath(fileId: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
        { cache: "no-store" },
    );
    if (!res.ok) {
        throw new Error(`Telegram getFile failed (${res.status})`);
    }

    const data = (await res.json()) as TelegramGetFileResponse;
    if (!data.ok || !data.result?.file_path) {
        throw new Error(data.description ?? "Telegram file path not found");
    }

    return { botToken, filePath: data.result.file_path };
}
// const paramSchema = z.object({
//     fileId: z.string().min(1),
// })
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ fileId: string }> },
) {
    try {
        const { fileId } = await params;
        console.log("Received request for Telegram file:", fileId);
        const { botToken, filePath } = await getTelegramFilePath(fileId);
        const range = request.headers.get("range");

        const upstreamRes = await fetch(
            `https://api.telegram.org/file/bot${botToken}/${filePath}`,
            {
                headers: range ? { range } : undefined,
                cache: "no-store",
            },
        );

        if (!upstreamRes.ok && upstreamRes.status !== 206) {
            return new Response("Failed to fetch media", {
                status: upstreamRes.status,
            });
        }

        const headers = new Headers();
        const contentType = upstreamRes.headers.get("content-type");
        const contentLength = upstreamRes.headers.get("content-length");
        const contentRange = upstreamRes.headers.get("content-range");
        const acceptRanges = upstreamRes.headers.get("accept-ranges");

        if (contentType) headers.set("content-type", contentType);
        if (contentLength) headers.set("content-length", contentLength);
        if (contentRange) headers.set("content-range", contentRange);
        if (acceptRanges) headers.set("accept-ranges", acceptRanges);
        headers.set("cache-control", "public, max-age=300");

        return new Response(upstreamRes.body, {
            status: upstreamRes.status,
            headers,
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to stream media";
        return new Response(message, { status: 500 });
    }
}
