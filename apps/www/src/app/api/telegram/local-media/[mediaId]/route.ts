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

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

function unavailable(status: number, error: string) {
	return Response.json({ error }, { status, headers: NO_STORE_HEADERS });
}

async function validate(
	request: Request,
	context: { params: Promise<{ mediaId: string }> },
) {
	if (!isLocalMediaGatewayEnabled()) {
		return { response: unavailable(503, "Local media gateway is disabled.") };
	}
	const mediaId = parseLocalMediaId((await context.params).mediaId);
	if (!mediaId) return { response: unavailable(400, "Invalid media id.") };
	const authorization = authorizeLocalMediaRequest(request, mediaId);
	if (!authorization.ok) {
		return {
			response: unavailable(
				authorization.status,
				authorization.status === 503
					? "Local media signing is not configured."
					: "Invalid or expired media ticket.",
			),
		};
	}
	return { mediaId };
}

export async function GET(
	request: Request,
	context: { params: Promise<{ mediaId: string }> },
) {
	const validated = await validate(request, context);
	if (validated.response) return validated.response;
	return Response.json(await localMediaCache.getStatus(validated.mediaId), {
		headers: NO_STORE_HEADERS,
	});
}

export async function POST(
	request: Request,
	context: { params: Promise<{ mediaId: string }> },
) {
	const validated = await validate(request, context);
	if (validated.response) return validated.response;
	void localMediaCache.prepare(validated.mediaId);
	return Response.json(await localMediaCache.getStatus(validated.mediaId), {
		status: 202,
		headers: NO_STORE_HEADERS,
	});
}
