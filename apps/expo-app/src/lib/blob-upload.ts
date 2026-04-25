import { getWebUrl } from "@/lib/base-url";

export type BlobMediaUpload = {
  url: string;
  downloadUrl?: string;
  pathname: string;
  contentType: string;
  etag?: string;
  size?: number;
  name?: string;
  title?: string;
  width?: number;
  height?: number;
  duration?: number;
};

type UploadAsset = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
};

type BlobTokenResponse = {
  clientToken?: string;
  error?: string;
};

type VercelBlobPutResponse = {
  url: string;
  downloadUrl?: string;
  pathname: string;
  contentType?: string;
  contentDisposition?: string;
};

const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "11";

function getUploadName(asset: UploadAsset) {
  const fallbackName = asset.uri.split("/").pop() || `upload-${Date.now()}`;
  return (asset.name || fallbackName).replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function retrieveClientToken({
  pathname,
  handleUploadUrl,
  clientPayload,
}: {
  pathname: string;
  handleUploadUrl: string;
  clientPayload: string;
}) {
  const response = await fetch(handleUploadUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: {
        pathname,
        callbackUrl: handleUploadUrl,
        clientPayload,
        multipart: false,
      },
    }),
  });

  let body: BlobTokenResponse | undefined;
  try {
    body = (await response.json()) as BlobTokenResponse;
  } catch {
    body = undefined;
  }

  if (!response.ok || !body?.clientToken) {
    throw new Error(body?.error || "Failed to prepare upload");
  }

  return body.clientToken;
}

function uploadBlobWithXhr({
  pathname,
  blob,
  token,
  contentType,
  onProgress,
}: {
  pathname: string;
  blob: Blob;
  token: string;
  contentType: string;
  onProgress?: (progress: number) => void;
}) {
  return new Promise<VercelBlobPutResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const params = new URLSearchParams({ pathname });

    xhr.open("PUT", `${BLOB_API_URL}/?${params.toString()}`);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-api-version", BLOB_API_VERSION);
    xhr.setRequestHeader("x-content-type", contentType);
    xhr.setRequestHeader("x-content-length", String(blob.size));

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.max(0, Math.min(1, event.loaded / event.total)));
    };

    xhr.onload = () => {
      let body: VercelBlobPutResponse | { error?: { message?: string } } | undefined;
      try {
        body = JSON.parse(xhr.responseText || "{}") as typeof body;
      } catch {
        body = undefined;
      }

      if (xhr.status >= 200 && xhr.status < 300 && body && "url" in body) {
        onProgress?.(1);
        resolve(body);
        return;
      }

      const message =
        body && "error" in body && body.error?.message
          ? body.error.message
          : `Upload failed (${xhr.status})`;
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(blob);
  });
}

export async function uploadBlogMediaAsset(
  asset: UploadAsset,
  onProgress?: (progress: number) => void,
): Promise<BlobMediaUpload> {
  const response = await fetch(asset.uri);
  const localBlob = await response.blob();
  const contentType = asset.mimeType || localBlob.type || "application/octet-stream";
  const uploadBlob =
    contentType && localBlob.type !== contentType
      ? localBlob.slice(0, localBlob.size, contentType)
      : localBlob;
  const name = getUploadName(asset);
  const pathname = `blogs/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${name}`;
  const handleUploadUrl = `${getWebUrl()}/api/blob/upload`;
  const clientPayload = JSON.stringify({
    name,
    source: "expo-blog-compose",
    contentType,
  });
  const token = await retrieveClientToken({ pathname, handleUploadUrl, clientPayload });
  const result = await uploadBlobWithXhr({
    pathname,
    blob: uploadBlob,
    token,
    contentType,
    onProgress,
  });

  return {
    url: result.url,
    downloadUrl: result.downloadUrl,
    pathname: result.pathname,
    contentType,
    size: asset.size ?? localBlob.size,
    name,
  };
}
