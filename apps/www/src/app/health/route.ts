import { isLocalMediaGatewayEnabled } from "@/lib/local-media/config";

export function GET() {
	return Response.json({
		ok: true,
		service: "al-ghurobaa-local-api",
		capabilities: {
			largeMedia:
				isLocalMediaGatewayEnabled() &&
				Boolean(process.env.LOCAL_MEDIA_SIGNING_SECRET?.trim()),
		},
	});
}
