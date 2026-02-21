// middleware.ts  (project root)
//
// Two responsibilities:
//   1. Auth guard  — redirect unauthenticated users to /login
//   2. API proxy   — forward /proxy/* requests to an external upstream
//                    (useful if you want to shield env vars from the client)

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

// ── Route config ──────────────────────────────────────────────────────────────

// Paths that never require authentication
const PUBLIC_PATHS = ["/login", "/api/auth/send-code", "/api/auth/verify-code"];

// Paths proxied to an upstream service
const PROXY_UPSTREAM = process.env.PROXY_UPSTREAM_URL ?? ""; // e.g. https://api.example.com

// ── Middleware ────────────────────────────────────────────────────────────────

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // ── 1. Proxy ──────────────────────────────────────────────────────────────
    if (pathname.startsWith("/proxy/") && PROXY_UPSTREAM) {
        const session = await getSessionFromRequest(req);
        if (!session?.authenticated) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const upstreamPath = pathname.replace(/^\/proxy/, "");
        const upstreamUrl = `${PROXY_UPSTREAM}${upstreamPath}${req.nextUrl.search}`;

        const proxyHeaders = new Headers(req.headers);
        // proxyHeaders.set("x-forwarded-for", req.ip ?? "");
        // Forward auth secret so upstream can verify requests come from this proxy
        proxyHeaders.set("x-proxy-secret", process.env.PROXY_SECRET ?? "");

        return NextResponse.rewrite(upstreamUrl, {
            request: { headers: proxyHeaders },
        });
    }

    // ── 2. Auth guard ─────────────────────────────────────────────────────────
    const isPublic = PUBLIC_PATHS.some(
        (p) => pathname === p || pathname.startsWith(p + "/"),
    );

    if (!isPublic) {
        const session = await getSessionFromRequest(req);
        if (!session?.authenticated) {
            const loginUrl = new URL("/login", req.url);
            loginUrl.searchParams.set("from", pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // Redirect already-authenticated users away from /login
    if (pathname === "/login") {
        const session = await getSessionFromRequest(req);
        if (session?.authenticated) {
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all paths EXCEPT:
         *   - _next/static, _next/image (Next.js internals)
         *   - favicon.ico
         */
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};

