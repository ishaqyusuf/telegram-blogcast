// app/api/auth/send-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/telegram-client";

// Stores phone_code_hash per phone number for the duration of the OTP flow.
// In production, use Redis or a DB. This in-memory map works fine for a
// single-server / single-session setup.
const pendingCodes = new Map<string, string>();
export { pendingCodes }; // shared with verify-code route

export async function POST(req: NextRequest) {
    try {
        const { phoneNumber } = (await req.json()) as { phoneNumber: string };
        if (!phoneNumber) {
            return NextResponse.json(
                { error: "phoneNumber is required" },
                { status: 400 },
            );
        }

        const client = await getClient();
        const result = await client.sendCode(
            {
                apiId: parseInt(process.env.TELEGRAM_API_ID!),
                apiHash: process.env.TELEGRAM_API_HASH!,
            },
            phoneNumber,
        );
        // const result = await client.invoke(
        //     new (await import("telegram/tl/functions/auth/index.js")).SendCode({
        //         phoneNumber,
        //         apiId: parseInt(process.env.TELEGRAM_API_ID!),
        //         apiHash: process.env.TELEGRAM_API_HASH!,
        //         settings: new (
        //             await import("telegram/tl/types/index.js")
        //         ).CodeSettings({}),
        //     }),
        // );

        // Store hash keyed by phone for the verify step
        pendingCodes.set(phoneNumber, result.phoneCodeHash);

        return NextResponse.json({ ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

