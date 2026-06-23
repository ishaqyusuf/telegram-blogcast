import { getClient, saveCurrentSession } from "@telegram/telegram-client";
import { z } from "zod";

const pendingCodes = new Map<string, number>();
const PENDING_CODE_TTL_MS = 10 * 60 * 1000;

export const telegramSendCodeSchema = z.object({
  phoneNumber: z.string().trim().min(5),
});

export const telegramVerifyCodeSchema = z.object({
  phoneNumber: z.string().trim().min(5),
  code: z.string().trim().min(4).max(8),
});

export type TelegramSendCodeInput = z.infer<typeof telegramSendCodeSchema>;
export type TelegramVerifyCodeInput = z.infer<typeof telegramVerifyCodeSchema>;

function pruneExpiredCodes() {
  const cutoff = Date.now() - PENDING_CODE_TTL_MS;
  for (const [phoneNumber, createdAt] of pendingCodes.entries()) {
    if (createdAt < cutoff) pendingCodes.delete(phoneNumber);
  }
}

export async function sendTelegramLoginCode(input: TelegramSendCodeInput) {
  pruneExpiredCodes();

  const client = await getClient();
  if (await client.checkAuthorization()) {
    saveCurrentSession();
    return { ok: true, authorized: true, error: null };
  }

  await client.sendCode(
    {
      apiId: parseInt(process.env.TELEGRAM_API_ID!),
      apiHash: process.env.TELEGRAM_API_HASH!,
    },
    input.phoneNumber,
  );

  pendingCodes.set(input.phoneNumber, Date.now());

  return { ok: true, authorized: false, error: null };
}

export async function verifyTelegramLoginCode(input: TelegramVerifyCodeInput) {
  pruneExpiredCodes();

  if (!pendingCodes.has(input.phoneNumber)) {
    return {
      ok: false,
      authorized: false,
      needs2FA: false,
      error: "No pending code for this number. Request a new code.",
    };
  }

  const client = await getClient();

  try {
    await client.signInUser(
      {
        apiId: parseInt(process.env.TELEGRAM_API_ID!),
        apiHash: process.env.TELEGRAM_API_HASH!,
      },
      {
        phoneNumber: async () => input.phoneNumber,
        phoneCode: async () => input.code,
        onError(error) {
          throw new Error(error.message);
        },
      },
    );

    pendingCodes.delete(input.phoneNumber);
    saveCurrentSession();

    return {
      ok: true,
      authorized: await client.checkAuthorization(),
      needs2FA: false,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      authorized: false,
      needs2FA: message.includes("SESSION_PASSWORD_NEEDED"),
      error: message,
    };
  }
}
