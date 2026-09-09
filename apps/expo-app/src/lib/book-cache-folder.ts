import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { androidDocumentPath, safeBookRelativePath, type BookFileAccess } from "./book-cache-files";
import { MAX_BOOK_CACHE_FILE_BYTES, PREFERRED_BOOKS_DIRECTORY } from "./book-cache-format";

const SAF = FileSystem.StorageAccessFramework;
const configurationKey = "book-content-folder-v1";
export type BookFolderConfiguration = { uri: string; path: string };

export async function getBookFolder(): Promise<BookFolderConfiguration | null> {
	const stored = await AsyncStorage.getItem(configurationKey);
	if (!stored) return null;
	const value: unknown = JSON.parse(stored);
	if (!value || typeof value !== "object" || !("uri" in value) || typeof value.uri !== "string")
		throw new Error("Saved book folder is invalid. Choose the Books folder again.");
	return { uri: value.uri, path: androidDocumentPath(value.uri) };
}

export async function chooseBookFolder(): Promise<BookFolderConfiguration | null> {
	if (Platform.OS !== "android") throw new Error("The Android/media folder is available on Android only.");
	const permissions = await SAF.requestDirectoryPermissionsAsync(SAF.getUriForDirectoryInRoot(PREFERRED_BOOKS_DIRECTORY));
	if (!permissions.granted) return null;
	const path = androidDocumentPath(permissions.directoryUri);
	if (path.split("/").at(-1) !== "Books")
		throw new Error("Select or create the Books folder inside Android/media/com.alghurobaa.podcast.");
	await SAF.readDirectoryAsync(permissions.directoryUri);
	// Confirm write access before replacing a previously working configuration.
	const probe = await SAF.createFileAsync(permissions.directoryUri, `alghurobaa-access-${Date.now()}.tmp`, "application/octet-stream");
	try {
		await SAF.writeAsStringAsync(probe, "book-folder-v1");
		if (await SAF.readAsStringAsync(probe) !== "book-folder-v1") throw new Error("The selected folder could not be verified.");
	} finally { await SAF.deleteAsync(probe, { idempotent: true }); }
	const configuration = { uri: permissions.directoryUri, path };
	await AsyncStorage.setItem(configurationKey, JSON.stringify(configuration));
	return configuration;
}

export async function disconnectBookFolder() {
	// Disconnecting never removes user-visible files or the private database.
	await AsyncStorage.removeItem(configurationKey);
}

export function createAndroidBookFiles(root: BookFolderConfiguration): BookFileAccess {
	androidDocumentPath(root.uri);
	async function child(parent: string, name: string, directory: boolean, create: boolean) {
		const children = await SAF.readDirectoryAsync(parent);
		const found = children.find((uri) => androidDocumentPath(uri).split("/").at(-1) === name);
		if (found || !create) return found ?? null;
		const uri = directory
			? await SAF.makeDirectoryAsync(parent, name)
			: await SAF.createFileAsync(parent, name, "application/octet-stream");
		if (androidDocumentPath(uri).split("/").at(-1) !== name)
			throw new Error("This storage provider changed the book filename. Choose an on-device Books folder.");
		return uri;
	}
	async function resolve(path: string, create: boolean) {
		const parts = safeBookRelativePath(path);
		let parent = root.uri;
		for (let i = 0; i < parts.length; i++) {
			const uri = await child(parent, parts[i]!, i < parts.length - 1, create);
			if (!uri) return null;
			parent = uri;
		}
		return parent;
	}
	return {
		async list(directory) {
			if (directory && !/^book-[1-9]\d*(?:\/pages)?$/.test(directory)) throw new Error("Invalid book directory.");
			let parent = root.uri;
			for (const part of directory ? directory.split("/") : []) {
				const found = await child(parent, part, true, false);
				if (!found) return [];
				parent = found;
			}
			const entries = await SAF.readDirectoryAsync(parent);
			if (entries.length > 50_000) throw new Error("This folder contains too many entries to restore at once.");
			return entries.map((uri) => androidDocumentPath(uri).split("/").at(-1)!);
		},
		async read(path) {
			const uri = await resolve(path, false);
			if (!uri) return null;
			const info = await FileSystem.getInfoAsync(uri);
			if (!info.exists) return null;
			if (info.isDirectory || info.size > MAX_BOOK_CACHE_FILE_BYTES) throw new Error("Book file is not a supported size or type.");
			return SAF.readAsStringAsync(uri);
		},
		async write(path, text) {
			if (new TextEncoder().encode(text).byteLength > MAX_BOOK_CACHE_FILE_BYTES) throw new Error("Book file is too large.");
			const uri = await resolve(path, true);
			if (!uri) throw new Error("Could not create the book file.");
			await SAF.writeAsStringAsync(uri, text);
		},
		async remove(path) {
			const uri = await resolve(path, false);
			if (uri) await SAF.deleteAsync(uri, { idempotent: true });
		},
	};
}
