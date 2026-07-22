import { appendPath, getLocalNetworkHost } from "@/lib/base-url";
import { LOCAL_API_PORT } from "@/lib/local-service-ports";

export { LOCAL_API_PORT } from "@/lib/local-service-ports";
const MAX_IP_HISTORY = 8;
const HEALTH_TIMEOUT_MS = 2500;

export type LocalApiIpSource = "last" | "current" | "history" | "manual";

export type LocalApiIpCandidate = {
  ip: string;
  source: LocalApiIpSource;
};

export type LocalApiResolveResult = LocalApiIpCandidate & {
  baseUrl: string;
};

export function buildLocalApiBaseUrl(ip: string, port = LOCAL_API_PORT) {
  return `http://${ip.trim()}:${port}`;
}

export function normalizeLocalApiIpInput(value: string | null | undefined) {
  const input = value?.trim();
  if (!input) return "";

  try {
    const url = new URL(input.includes("://") ? input : `http://${input}`);
    return url.hostname.trim();
  } catch {
    return input
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .split(":")[0]
      .trim();
  }
}

export function getCurrentLocalApiIp() {
  try {
    return normalizeLocalApiIpInput(getLocalNetworkHost());
  } catch {
    return "";
  }
}

export function addLocalApiIpToHistory(history: string[], ip: string) {
  const cleanIp = normalizeLocalApiIpInput(ip);
  if (!cleanIp) return history;
  return [
    cleanIp,
    ...history
      .map(normalizeLocalApiIpInput)
      .filter((item) => item && item !== cleanIp),
  ].slice(0, MAX_IP_HISTORY);
}

export function getLocalApiIpCandidates(input: {
  lastUsedIp?: string | null;
  currentIp?: string | null;
  history?: string[];
}) {
  const candidates: LocalApiIpCandidate[] = [];
  const seen = new Set<string>();
  const add = (ip: string | null | undefined, source: LocalApiIpSource) => {
    const cleanIp = normalizeLocalApiIpInput(ip);
    if (!cleanIp || seen.has(cleanIp)) return;
    seen.add(cleanIp);
    candidates.push({ ip: cleanIp, source });
  };

  add(input.lastUsedIp, "last");
  add(input.currentIp, "current");
  for (const ip of input.history ?? []) add(ip, "history");

  return candidates;
}

export async function checkLocalApiBaseUrl(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(appendPath(baseUrl, "/health"), {
      signal: controller.signal,
    });
    return res.ok;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveReachableLocalApi(input: {
  lastUsedIp?: string | null;
  history?: string[];
  onAttempt?: (candidate: LocalApiIpCandidate) => void;
}) {
  const currentIp = getCurrentLocalApiIp();
  const candidates = getLocalApiIpCandidates({
    lastUsedIp: input.lastUsedIp,
    currentIp,
    history: input.history,
  });

  for (const candidate of candidates) {
    input.onAttempt?.(candidate);
    const baseUrl = buildLocalApiBaseUrl(candidate.ip);
    try {
      if (await checkLocalApiBaseUrl(baseUrl)) {
        return { ...candidate, baseUrl } satisfies LocalApiResolveResult;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}
