import { cors } from "hono/cors";

export function apiCors() {
	const origins = new Set([
		"https://alghurobaa.vercel.app",
		...(process.env.ALLOWED_API_ORIGINS ?? "")
			.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean),
	]);
	return cors({
		origin: (origin) =>
			process.env.NODE_ENV === "development" || origins.has(origin)
				? origin
				: undefined,
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
		allowHeaders: [
			"Authorization",
			"content-type",
			"accept-language",
			"x-book-import-token",
		],
		exposeHeaders: ["Content-Length"],
		maxAge: 86400,
	});
}
