import "react-native-get-random-values";
import * as SecureStore from "expo-secure-store";

let tokenPromise: Promise<string> | undefined;

// A per-install bearer capability authorizes management of this device's imports.
// This is deliberately separate from the app's unfinished account authentication.
export function getBookImportToken(): Promise<string> {
	if (!tokenPromise)
		tokenPromise = (async () => {
			const saved = await SecureStore.getItemAsync("book-import-owner-token");
			if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved;
			const bytes = new Uint8Array(32);
			crypto.getRandomValues(bytes);
			const token = Array.from(bytes, (value) =>
				value.toString(16).padStart(2, "0"),
			).join("");
			await SecureStore.setItemAsync("book-import-owner-token", token);
			return token;
		})().catch((error) => {
			tokenPromise = undefined;
			throw error;
		});
	return tokenPromise;
}
