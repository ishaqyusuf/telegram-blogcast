import Constants from "expo-constants";

const PREVIEW_OR_FORCED_BASE_URL =
  process.env.EXPO_PUBLIC_APP_VARIANT === "preview" ||
  process.env.EXPO_PUBLIC_FORCE_BASE_URL === "true";
const IS_DEV = typeof __DEV__ !== "undefined" && __DEV__;
const TRPC_PATH = "/api/trpc";
const DEFAULT_API_PORT = "3501";

export const getLocalNetworkHost = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (localhost) return localhost;

  const urlCandidates = [
    process.env.EXPO_PUBLIC_TRPC_URL,
    process.env.EXPO_PUBLIC_BASE_URL,
    process.env.EXPO_PUBLIC_WEB_URL,
  ];

  for (const candidate of urlCandidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.hostname) return parsed.hostname;
    } catch {}
  }

  throw new Error(
    "Failed to resolve the local network host. Set EXPO_PUBLIC_TRPC_URL or EXPO_PUBLIC_FACEBOOK_MEDIA_BRIDGE_URL to a reachable LAN URL.",
  );
};

export const getLocalUrl = (port: string) => {
  return `http://${getLocalNetworkHost()}:${port}`;
};

export const getLocalTranscriberUrl = () => {
  return getLocalUrl(process.env.EXPO_PUBLIC_TRANSCRIBER_PORT ?? "8787");
};

export const getLocalFacebookMediaBridgeUrl = () => {
  return getLocalUrl(process.env.EXPO_PUBLIC_FACEBOOK_MEDIA_BRIDGE_PORT ?? "8790");
};

export const appendPath = (baseUrl: string, path: string) => {
  return `${baseUrl.trim().replace(/\/+$/, "")}${path}`;
};

export const normalizeTrpcUrl = (url: string) => {
  const trimmedUrl = url.trim().replace(/\/+$/, "");
  if (trimmedUrl.endsWith(TRPC_PATH)) return trimmedUrl;
  return appendPath(trimmedUrl, TRPC_PATH);
};

const logResolvedUrl = (label: string, value: string) => {
  if (__DEV__) {
    console.log(`[network] ${label}: ${value}`, {
      hostUri: Constants.expoConfig?.hostUri,
    });
  }
  return value;
};

/**
 * Extend this function when going to production by
 * setting the baseUrl to your production API URL.
 */
export const getBaseUrl = () => {
  const envBaseUrl = process.env.EXPO_PUBLIC_BASE_URL;
  if (PREVIEW_OR_FORCED_BASE_URL && envBaseUrl) {
    return logResolvedUrl("baseUrl", envBaseUrl);
  }

  const apiPort = process.env.EXPO_PUBLIC_API_PORT ?? DEFAULT_API_PORT;
  return logResolvedUrl("baseUrl", getLocalUrl(apiPort));
};

export const getTrpcUrl = () => {
  const envTrpcUrl = process.env.EXPO_PUBLIC_TRPC_URL;

  if (PREVIEW_OR_FORCED_BASE_URL) {
    if (envTrpcUrl) return logResolvedUrl("trpcUrl", normalizeTrpcUrl(envTrpcUrl));
    return logResolvedUrl("trpcUrl", appendPath(getBaseUrl(), TRPC_PATH));
  }

  const trpcPort =
    process.env.EXPO_PUBLIC_TRPC_PORT ??
    process.env.EXPO_PUBLIC_API_PORT ??
    DEFAULT_API_PORT;

  if (IS_DEV && trpcPort) {
    return logResolvedUrl("trpcUrl", appendPath(getLocalUrl(trpcPort), TRPC_PATH));
  }

  if (envTrpcUrl) return logResolvedUrl("trpcUrl", normalizeTrpcUrl(envTrpcUrl));

  return logResolvedUrl("trpcUrl", appendPath(getBaseUrl(), TRPC_PATH));
};

export const getWebUrl = () => {
  const envWebUrl =
    process.env.EXPO_PUBLIC_WEB_URL ?? process.env.EXPO_PUBLIC_BASE_URL;
  if (PREVIEW_OR_FORCED_BASE_URL && envWebUrl) {
    return logResolvedUrl("webUrl", envWebUrl);
  }

  const webPort = process.env.EXPO_PUBLIC_WEB_PORT ?? "3501";
  return logResolvedUrl("webUrl", getLocalUrl(webPort));
};
