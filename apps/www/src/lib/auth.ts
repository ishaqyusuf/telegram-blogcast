// lib/auth.ts
// Cookie-based session helpers. The session is a signed JWT stored in an
// HttpOnly cookie. No database required.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SECRET = new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "change-me-in-production-32-chars!!",
);

const COOKIE_NAME = "tg_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
    authenticated: boolean;
    phoneNumber: string;
}

// ── Sign / verify ─────────────────────────────────────────────────────────────

export async function signSession(payload: SessionPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(SECRET);
}

export async function verifySession(
    token: string,
): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload as unknown as SessionPayload;
    } catch {
        return null;
    }
}

// ── Cookie read/write (Server Components & Route Handlers) ────────────────────

export async function getSession(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySession(token);
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
    const token = await signSession(payload);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
    });
}

export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

// ── Middleware helper (works with NextRequest, no async cookies()) ─────────────

export async function getSessionFromRequest(
    req: NextRequest,
): Promise<SessionPayload | null> {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySession(token);
}

