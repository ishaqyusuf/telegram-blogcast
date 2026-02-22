// lib/telegramClient.js
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

let client: TelegramClient | null = null;

export async function getClient() {
  if (client?.connected) return client;

  const apiId = parseInt(process.env.TELEGRAM_API_ID!);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = new StringSession(process.env.TELEGRAM_STRING_SESSION);

  client = new TelegramClient(session, apiId, apiHash!, {
    connectionRetries: 5,
  });

  await client.connect();
  return client;
}
