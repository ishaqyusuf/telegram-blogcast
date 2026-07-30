import Constants from "expo-constants";
import {
  LOCAL_API_PORT,
  LOCAL_FACEBOOK_MEDIA_BRIDGE_PORT,
  LOCAL_TRANSCRIBER_PORT,
} from "@/lib/local-service-ports";

const PREVIEW_OR_FORCED_BASE_URL =
  process.env.EXPO_PUBLIC_APP_VARIANT === "preview" ||
  process.env.EXPO_PUBLIC_FORCE_BASE_URL === "true";
const IS_DEV = typeof __DEV__ !== "undefined" && __DEV__;
const USE_EXPLICIT_ENV_URLS = PREVIEW_OR_FORCED_BASE_URL || !IS_DEV;
const TRPC_PATH = "/api/trpc";

function parseHostname(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(
      trimmed.includes("://") ? trimmed : `http://${trimmed}`,
    ).hostname;
  } catch {
    return trimmed.split(":")[0] || null;
  }
}

function isLoopbackHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

export function resolveLocalNetworkHost({
  debuggerHost,
  explicitLocalHost,
  urlCandidates,
}: {
  debuggerHost?: string | null;
  explicitLocalHost?: string | null;
  urlCandidates: (string | undefined)[];
}) {
  const explicitHostname = parseHostname(explicitLocalHost);
  if (explicitHostname) return explicitHostname;

  const debuggerHostname = parseHostname(debuggerHost);
  if (debuggerHostname && !isLoopbackHost(debuggerHostname)) {
    return debuggerHostname;
  }

  const parsedCandidates = urlCandidates.flatMap((candidate) => {
    if (!candidate) return [];
    try {
      return [new URL(candidate).hostname];
    } catch {
      return [];
    }
  });

  const networkCandidate = parsedCandidates.find(
    (hostname) =>
      isPrivateNetworkHost(hostname) && !isLoopbackHost(hostname),
  );
  if (networkCandidate) return networkCandidate;

  if (debuggerHostname) return debuggerHostname;

  const loopbackCandidate = parsedCandidates.find(isLoopbackHost);
  if (loopbackCandidate) return loopbackCandidate;

  throw new Error(
    "Failed to resolve the local network host. Set EXPO_PUBLIC_LOCAL_NETWORK_HOST or EXPO_PUBLIC_TRPC_URL to a reachable LAN URL.",
  );
}

export const getLocalNetworkHost = () => {
  const explicitLocalHost =
    process.env.EXPO_PUBLIC_LOCAL_NETWORK_HOST ??
    process.env.EXPO_PUBLIC_MAC_LAN_IP ??
    process.env.EXPO_PUBLIC_DEVICE_IP;

  return resolveLocalNetworkHost({
    debuggerHost: Constants.expoConfig?.hostUri,
    explicitLocalHost,
    urlCandidates: [
      process.env.EXPO_PUBLIC_TRPC_URL,
      process.env.EXPO_PUBLIC_BASE_URL,
      process.env.EXPO_PUBLIC_WEB_URL,
    ],
  });
};

export function isPrivateNetworkHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

export const getLocalUrl = (port: string) => {
  return `http://${getLocalNetworkHost()}:${port}`;
};

export const getLocalTranscriberUrl = () => {
  return getLocalUrl(LOCAL_TRANSCRIBER_PORT);
};

export const getLocalFacebookMediaBridgeUrl = () => {
  return getLocalUrl(LOCAL_FACEBOOK_MEDIA_BRIDGE_PORT);
};

export const appendPath = (baseUrl: string, path: string) => {
  return `${baseUrl.trim().replace(/\/+$/, "")}${path}`;
};

export const normalizeTrpcUrl = (url: string) => {
  const trimmedUrl = url
    .trim()
    .replace(/\/+$/, "")
    .replace(/(?:\/api){2,}\/trpc$/, TRPC_PATH);
  if (trimmedUrl.endsWith(TRPC_PATH)) return trimmedUrl;
  if (trimmedUrl.endsWith("/api")) return `${trimmedUrl}/trpc`;
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
  if (USE_EXPLICIT_ENV_URLS && envBaseUrl) {
    return logResolvedUrl("baseUrl", envBaseUrl);
  }

  return logResolvedUrl("baseUrl", getLocalUrl(LOCAL_API_PORT));
};

export const getTrpcUrl = () => {
  const envTrpcUrl = process.env.EXPO_PUBLIC_TRPC_URL;

  if (USE_EXPLICIT_ENV_URLS) {
    if (envTrpcUrl) return logResolvedUrl("trpcUrl", normalizeTrpcUrl(envTrpcUrl));
    return logResolvedUrl("trpcUrl", appendPath(getBaseUrl(), TRPC_PATH));
  }

  const trpcPort =
    process.env.EXPO_PUBLIC_TRPC_PORT ??
    process.env.EXPO_PUBLIC_API_PORT ??
    LOCAL_API_PORT;

  if (IS_DEV && trpcPort) {
    return logResolvedUrl("trpcUrl", appendPath(getLocalUrl(trpcPort), TRPC_PATH));
  }

  if (envTrpcUrl) return logResolvedUrl("trpcUrl", normalizeTrpcUrl(envTrpcUrl));

  return logResolvedUrl("trpcUrl", appendPath(getBaseUrl(), TRPC_PATH));
};

export const getWebUrl = () => {
  const envWebUrl =
    process.env.EXPO_PUBLIC_WEB_URL ?? process.env.EXPO_PUBLIC_BASE_URL;
  if (USE_EXPLICIT_ENV_URLS && envWebUrl) {
    return logResolvedUrl("webUrl", envWebUrl);
  }

  const webPort = process.env.EXPO_PUBLIC_WEB_PORT ?? "3501";
  return logResolvedUrl("webUrl", getLocalUrl(webPort));
};
