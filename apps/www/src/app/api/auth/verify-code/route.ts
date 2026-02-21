// app/api/auth/verify-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/telegram-client";
import { setSessionCookie } from "@/lib/auth";
import { pendingCodes } from "../send-code/route";

export async function POST(req: NextRequest) {
    try {
        const { phoneNumber, code } = (await req.json()) as {
            phoneNumber: string;
            code: string;
        };

        if (!phoneNumber || !code) {
            return NextResponse.json(
                { error: "phoneNumber and code are required" },
                { status: 400 },
            );
        }

        const phoneCodeHash = pendingCodes.get(phoneNumber);
        if (!phoneCodeHash) {
            return NextResponse.json(
                {
                    error: "No pending code for this number. Request a new code.",
                },
                { status: 400 },
            );
        }

        const client = await getClient();
        await client.signInUser(
            {
                apiId: parseInt(process.env.TELEGRAM_API_ID!),
                apiHash: process.env.TELEGRAM_API_HASH!,
            },
            {
                phoneNumber: async () => phoneNumber,
                phoneCode: async () => code,
                onError(e) {
                    throw new Error(e.message);
                },
            },
        );

        pendingCodes.delete(phoneNumber);

        // Issue session cookie
        await setSessionCookie({ authenticated: true, phoneNumber });

        return NextResponse.json({ ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Telegram throws SESSION_PASSWORD_NEEDED for 2FA accounts
        const needs2FA = message.includes("SESSION_PASSWORD_NEEDED");
        return NextResponse.json(
            { error: message, needs2FA },
            { status: needs2FA ? 403 : 500 },
        );
    }
}

