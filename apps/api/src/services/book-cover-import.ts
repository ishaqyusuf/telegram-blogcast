import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { put } from "@vercel/blob";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
	["image/jpeg", "jpg"],
	["image/png", "png"],
	["image/webp", "webp"],
	["image/gif", "gif"],
]);

export function isPublicImageAddress(address: string): boolean {
	const mapped = address
		.toLowerCase()
		.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
	if (mapped) return isPublicImageAddress(mapped);
	const mappedHex = address
		.toLowerCase()
		.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
	if (mappedHex) {
		const high = Number.parseInt(mappedHex[1] ?? "0", 16);
		const low = Number.parseInt(mappedHex[2] ?? "0", 16);
		return isPublicImageAddress(
			`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`,
		);
	}
	if (isIP(address) === 4) {
		const [a = 0, b = 0] = address.split(".").map(Number);
		return !(
			a === 0 ||
			a === 10 ||
			a === 127 ||
			a >= 224 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && (b === 168 || b === 0)) ||
			(a === 198 && (b === 18 || b === 19 || b === 51)) ||
			(a === 203 && b === 0)
		);
	}
	if (isIP(address) === 6) {
		const value = address.toLowerCase();
		return !(
			value === "::" ||
			value === "::1" ||
			value.startsWith("fc") ||
			value.startsWith("fd") ||
			/^fe[89ab]/.test(value) ||
			value.startsWith("ff")
		);
	}
	return false;
}

export function hasMatchingImageSignature(bytes: Uint8Array, mime: string) {
	if (mime === "image/jpeg")
		return (
			bytes.length >= 3 &&
			bytes[0] === 0xff &&
			bytes[1] === 0xd8 &&
			bytes[2] === 0xff
		);
	if (mime === "image/png")
		return (
			bytes.length >= 8 &&
			Buffer.from(bytes.subarray(0, 8)).equals(
				Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
			)
		);
	if (mime === "image/gif")
		return (
			bytes.length >= 6 &&
			["GIF87a", "GIF89a"].includes(
				Buffer.from(bytes.subarray(0, 6)).toString("ascii"),
			)
		);
	if (mime === "image/webp")
		return (
			bytes.length >= 12 &&
			Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
			Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
		);
	return false;
}

async function resolveCoverSourceUrl(
	raw: string,
	resolve: (
		hostname: string,
		options: { all: true },
	) => Promise<Array<{ address: string; family: number }>> = lookup,
) {
	const url = new URL(raw);
	const hostname = url.hostname.replace(/^\[|\]$/g, "");
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		url.port ||
		hostname === "localhost" ||
		hostname.endsWith(".localhost")
	) {
		throw new Error("Use a public HTTPS image link.");
	}
	const addresses = isIP(hostname)
		? [{ address: hostname, family: isIP(hostname) }]
		: await resolve(hostname, { all: true });
	const firstAddress = addresses[0];
	if (
		!firstAddress ||
		addresses.some(({ address }) => !isPublicImageAddress(address))
	) {
		throw new Error("This image host is not public.");
	}
	return { url, address: firstAddress };
}

export async function validateCoverSourceUrl(
	raw: string,
	resolve?: Parameters<typeof resolveCoverSourceUrl>[1],
) {
	return (await resolveCoverSourceUrl(raw, resolve)).url;
}

function fetchPinnedImage(
	url: URL,
	address: { address: string; family: number },
): Promise<Response> {
	return new Promise((resolve, reject) => {
		const req = request(
			url,
			{
				method: "GET",
				signal: AbortSignal.timeout(15_000),
				headers: {
					Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
				},
				lookup: (_hostname, _options, callback) =>
					callback(null, address.address, address.family),
			},
			(incoming) => {
				const headers = new Headers();
				for (const [name, value] of Object.entries(incoming.headers)) {
					if (value)
						headers.set(name, Array.isArray(value) ? value.join(", ") : value);
				}
				const status = incoming.statusCode ?? 502;
				if (status !== 200) {
					incoming.resume();
					resolve(new Response(null, { status, headers }));
					return;
				}
				resolve(
					new Response(Readable.toWeb(incoming) as ReadableStream<Uint8Array>, {
						status,
						headers,
					}),
				);
			},
		);
		req.on("error", reject);
		req.end();
	});
}

type CoverImportDependencies = {
	storageToken?: string;
	resolve?: Parameters<typeof validateCoverSourceUrl>[1];
	fetchImage?: (url: URL, init: RequestInit) => Promise<Response>;
	upload?: (
		pathname: string,
		bytes: Buffer,
		options: { access: "public"; contentType: string; addRandomSuffix: false },
	) => Promise<{ url: string }>;
};

export async function importBookCoverFromUrl(
	bookId: number,
	source: string,
	dependencies: CoverImportDependencies = {},
) {
	if (!(dependencies.storageToken ?? process.env.BLOB_READ_WRITE_TOKEN)) {
		throw new Error("Book cover storage is not configured.");
	}
	const resolve = dependencies.resolve ?? lookup;
	const upload = dependencies.upload ?? put;
	let target = await resolveCoverSourceUrl(source, resolve);
	let response: Response | undefined;
	for (let redirect = 0; redirect <= 3; redirect++) {
		const fetchImage =
			dependencies.fetchImage ??
			((url: URL) => fetchPinnedImage(url, target.address));
		response = await fetchImage(target.url, {
			redirect: "manual",
			signal: AbortSignal.timeout(15_000),
			headers: {
				Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
			},
		});
		if (![301, 302, 303, 307, 308].includes(response.status)) break;
		const location = response.headers.get("location");
		await response.body?.cancel();
		if (!location || redirect === 3)
			throw new Error("The image redirected too many times.");
		target = await resolveCoverSourceUrl(
			new URL(location, target.url).toString(),
			resolve,
		);
	}
	if (!response?.ok || !response.body)
		throw new Error("The image link could not be downloaded.");
	const mime =
		response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ??
		"";
	const extension = IMAGE_TYPES.get(mime);
	if (!extension)
		throw new Error("The link must return a JPEG, PNG, WebP, or GIF image.");
	const declaredSize = Number(response.headers.get("content-length") ?? 0);
	if (declaredSize > MAX_IMAGE_BYTES)
		throw new Error("The cover image must be smaller than 5 MB.");
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			length += value.byteLength;
			if (length > MAX_IMAGE_BYTES)
				throw new Error("The cover image must be smaller than 5 MB.");
			chunks.push(value);
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
	if (!length) throw new Error("The image link returned an empty file.");
	const bytes = Buffer.concat(chunks, length);
	if (!hasMatchingImageSignature(bytes, mime))
		throw new Error("The link did not return a valid image file.");
	const blob = await upload(
		`book-covers/${bookId}/${randomUUID()}.${extension}`,
		bytes,
		{
			access: "public",
			contentType: mime,
			addRandomSuffix: false,
		},
	);
	return blob.url;
}
