import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

import { parseSingleByteRange } from "@/lib/local-media/range";
import {
	authorizeLocalMediaRequest,
	parseLocalMediaId,
} from "@/lib/local-media/request";
import {
	isLocalMediaGatewayEnabled,
	localMediaCache,
} from "@/lib/local-media/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function textResponse(message: string, status: number, headers?: HeadersInit) {
	return new Response(message, {
		status,
		headers: { "Cache-Control": "no-store", ...headers },
	});
}

export async function GET(
	request: Request,
	context: { params: Promise<{ mediaId: string }> },
) {
	if (!isLocalMediaGatewayEnabled()) {
		return textResponse("Local media gateway is disabled.", 503);
	}
	const mediaId = parseLocalMediaId((await context.params).mediaId);
	if (!mediaId) return textResponse("Invalid media id.", 400);
	const authorization = authorizeLocalMediaRequest(request, mediaId);
	if (!authorization.ok) {
		return textResponse(
			authorization.status === 503
				? "Local media signing is not configured."
				: "Invalid or expired media ticket.",
			authorization.status,
		);
	}

	const file = await localMediaCache.getReadyFile(mediaId);
	if (!file) return textResponse("Media is not prepared yet.", 409);

	const rangeHeader = request.headers.get("range");
	const range = rangeHeader
		? parseSingleByteRange(rangeHeader, file.size)
		: null;
	if (rangeHeader && !range) {
		return textResponse("Requested range is not satisfiable.", 416, {
			"Content-Range": `bytes */${file.size}`,
		});
	}

	const start = range?.start ?? 0;
	const end = range?.end ?? file.size - 1;
	const contentLength = range?.length ?? file.size;
	const headers = new Headers({
		"Accept-Ranges": "bytes",
		"Cache-Control": "private, max-age=300",
		"Content-Disposition": `inline; filename="${file.fileName.replace(/["\\\r\n]/g, "-")}"`,
		"Content-Length": String(contentLength),
		"Content-Type": file.mimeType,
		ETag: `"local-media-${mediaId}-${file.size}"`,
	});
	if (range) {
		headers.set("Content-Range", `bytes ${start}-${end}/${file.size}`);
	}
	if (request.method === "HEAD") {
		return new Response(null, { status: range ? 206 : 200, headers });
	}

	const stream = Readable.toWeb(createReadStream(file.path, { start, end }));
	return new Response(stream as unknown as ReadableStream, {
		status: range ? 206 : 200,
		headers,
	});
}

export const HEAD = GET;
