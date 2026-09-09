export interface BookFileAccess {
	read(path: string): Promise<string | null>;
	write(path: string, content: string): Promise<void>;
	remove?(path: string): Promise<void>;
	list?(directory: string): Promise<string[]>;
}

/** SAF providers cannot promise atomic rename. Keep a verified previous copy before replacement. */
export async function writeRecoverableBookFile(
	files: BookFileAccess,
	path: string,
	content: string,
	validate: (text: string) => unknown,
) {
	validate(content);
	const verifyWrite = async (destination: string, text: string) => {
		// SAF's default output stream can retain trailing bytes on shorter writes.
		// Publication order below secures recovery before recreating the current file.
		await files.remove?.(destination);
		await files.write(destination, text);
		if (await files.read(destination) !== text)
			throw new Error("Book file verification failed; the saved database copy is safe.");
	};
	const previousPath = `${path}.previous`;
	const current = await files.read(path);
	if (current !== null) {
		let valid = false;
		try { validate(current); valid = true; } catch { /* Preserve the previous valid copy instead. */ }
		if (valid) await verifyWrite(previousPath, current);
	}
	// Keep staging after failure for diagnosis. Recovery reads only validated current/previous files.
	await verifyWrite(`${path}.pending`, content);
	await verifyWrite(path, content);
	await files.remove?.(`${path}.pending`);
}

export async function readRecoverableBookFile<T>(files: BookFileAccess, path: string, validate: (text: string) => T) {
	let invalid = false;
	let readFailure: Error | undefined;
	for (const candidate of [path, `${path}.previous`]) {
		let text: string | null;
		try { text = await files.read(candidate); }
		catch (error) {
			readFailure ??= error instanceof Error ? error : new Error("Book file could not be read.");
			continue;
		}
		if (text === null) continue;
		try { return { value: validate(text), recovered: candidate !== path }; }
		catch { invalid = true; }
	}
	if (readFailure) throw readFailure;
	if (invalid) throw new Error("Book file is damaged and no valid previous copy is available.");
	return null;
}

export function safeBookRelativePath(path: string) {
	if (!/^book-[1-9]\d*\/(?:pages\/)?(?:manifest|chapters|page-[1-9]\d*)\.(?:json|md)(?:\.(?:previous|pending))?$/.test(path))
		throw new Error("Invalid book file path");
	return path.split("/");
}

/** Only Android's on-device document provider exposes the requested folder layout. */
export function androidDocumentPath(uri: string) {
	const url = new URL(uri);
	if (url.protocol !== "content:" || url.hostname !== "com.android.externalstorage.documents")
		throw new Error("Choose the Books folder in this device's internal storage.");
	const encoded = url.pathname.split("/document/")[1] ?? url.pathname.split("/tree/")[1];
	if (!encoded) throw new Error("Invalid Android folder selection");
	const decoded = decodeURIComponent(encoded);
	const separator = decoded.indexOf(":");
	if (separator < 1) throw new Error("Invalid Android storage volume");
	const relative = decoded.slice(separator + 1);
	if (relative.split("/").some((part) => part === ".." || part === "."))
		throw new Error("Invalid Android folder path");
	return relative;
}
