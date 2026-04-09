const isHtmlResponse = (contentType: string | null, bodyPreview: string) => {
  return (
    contentType?.includes("text/html") === true ||
    bodyPreview.trimStart().startsWith("<")
  );
};

export const trpcFetch: typeof fetch = async (input, init) => {
  const requestUrl = typeof input === "string" ? input : input.url;
  if (__DEV__) {
    console.log("[tRPC] Requesting", {
      url: requestUrl,
      method: init?.method ?? (typeof input === "string" ? "GET" : input.method),
    });
  }

  const response = await fetch(input, init);
  const url = typeof input === "string" ? input : input.url;
  const contentType = response.headers.get("content-type");
  const shouldInspectBody =
    !response.ok || !contentType || !contentType.includes("json");

  if (!shouldInspectBody) {
    return response;
  }

  const bodyPreview = (await response.clone().text().catch(() => ""))
    .slice(0, 120)
    .replace(/\s+/g, " ");

  if (isHtmlResponse(contentType, bodyPreview)) {
    console.error("[tRPC] Expected JSON but received HTML.", {
      url,
      status: response.status,
      contentType,
      bodyPreview,
    });

    throw new Error(
      `tRPC endpoint returned HTML instead of JSON (${response.status}) from ${url}. Check that the Expo client is pointing to the correct /api/trpc host and port.`,
    );
  }

  if (!response.ok) {
    console.error("[tRPC] Non-OK response from endpoint.", {
      url,
      status: response.status,
      contentType,
      bodyPreview,
    });
  }

  return response;
};
