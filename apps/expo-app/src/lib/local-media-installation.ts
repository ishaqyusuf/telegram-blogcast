import "react-native-get-random-values";
import * as SecureStore from "expo-secure-store";

const CLIENT_ID_KEY = "local_media_client_id";

function createClientId() {
	const bytes = new Uint8Array(16);
	globalThis.crypto.getRandomValues(bytes);
	return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
		"",
	);
}

export async function getLocalMediaClientId() {
	const existing = await SecureStore.getItemAsync(CLIENT_ID_KEY);
	if (existing) return existing;
	const created = createClientId();
	await SecureStore.setItemAsync(CLIENT_ID_KEY, created);
	return created;
}
