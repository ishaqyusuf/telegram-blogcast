// packages/telegram/src/client.ts
// 🧩 Added: save updated session string after connect to avoid auth key loss on restart

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import * as fs from "fs";
import * as path from "path";

// 🧩 Persist session to a local file so restarts don't lose the auth key.
// In production (Railway/Fly) use a persistent volume or store in DB instead.
const SESSION_FILE = path.resolve(process.cwd(), ".telegram-session");

function loadSession(): string {
  // Priority: file (most up-to-date) → env (initial seed)
  if (fs.existsSync(SESSION_FILE)) {
    const saved = fs.readFileSync(SESSION_FILE, "utf-8").trim();
    if (saved) return saved;
  }
  return process.env.TELEGRAM_STRING_SESSION ?? "";
}

function saveSession(sessionString: string) {
  fs.writeFileSync(SESSION_FILE, sessionString, "utf-8");
}

let client: TelegramClient | null = null;

export async function getClient(): Promise<TelegramClient> {
  if (client?.connected) return client;

  const apiId = parseInt(process.env.TELEGRAM_API_ID!);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const session = new StringSession(loadSession());

  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.connect();

  // 🧩 Save the post-handshake session string immediately after connect
  saveSession(client.session.save() as unknown as string);

  // 🧩 Also re-save on disconnect/reconnect events in case keys rotated
  client.addEventHandler(() => {
    try {
      saveSession(client!.session.save() as unknown as string);
    } catch {}
  });

  return client;
}
