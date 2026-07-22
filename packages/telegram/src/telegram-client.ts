// packages/telegram/src/client.ts
// 🧩 Added: save updated session string after connect to avoid auth key loss on restart

import * as fs from "node:fs";
import * as path from "node:path";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

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
let connectingClient: Promise<TelegramClient> | null = null;

export function saveCurrentSession(): string {
	if (!client) return "";
	const sessionString = client.session.save() as unknown as string;
	saveSession(sessionString);
	return sessionString;
}

export async function getClient(): Promise<TelegramClient> {
	if (client?.connected) return client;
	if (connectingClient) return connectingClient;

	connectingClient = (async () => {
		const apiIdValue = process.env.TELEGRAM_API_ID;
		const apiHash = process.env.TELEGRAM_API_HASH;
		if (!apiIdValue || !apiHash) {
			throw new Error("Telegram API credentials are not configured.");
		}

		const apiId = Number.parseInt(apiIdValue, 10);
		if (!Number.isFinite(apiId)) {
			throw new Error("TELEGRAM_API_ID must be a number.");
		}
		const session = new StringSession(loadSession());

		const nextClient = new TelegramClient(session, apiId, apiHash, {
			connectionRetries: 5,
		});

		try {
			await nextClient.connect();
			client = nextClient;

			// 🧩 Save the post-handshake session string immediately after connect
			saveCurrentSession();

			// 🧩 Also re-save on disconnect/reconnect events in case keys rotated
			nextClient.addEventHandler(() => {
				try {
					saveCurrentSession();
				} catch {}
			});

			return nextClient;
		} catch (error) {
			if (client === nextClient) client = null;
			throw error;
		} finally {
			connectingClient = null;
		}
	})();

	return connectingClient;
}
