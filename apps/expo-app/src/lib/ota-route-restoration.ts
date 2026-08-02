export const PENDING_OTA_ROUTE_STORAGE_KEY =
  "al-ghurobaa:pending-ota-route:v1";
export const OTA_ROUTE_SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000;
export const OTA_ROUTE_SNAPSHOT_MAX_LENGTH = 16_384;

export type OtaReloadSource = "automatic" | "manual";

export type OtaUpdateIdentity = {
  updateId: string | null;
  isEmbeddedLaunch: boolean;
};

export type RestorableOtaRoute = {
  pathname: string;
  params: Record<string, string | string[]>;
};

export type PendingOtaRouteSnapshot = {
  version: 1;
  route: RestorableOtaRoute;
  capturedAt: number;
  reloadSource: OtaReloadSource;
  sourceUpdateId: string | null;
  sourceWasEmbedded: boolean;
  sourceInitialUrlFingerprint: string | null;
};

type NavigationRouteLike = {
  name?: unknown;
  params?: unknown;
  state?: NavigationStateLike;
};

export type NavigationStateLike = {
  index?: number;
  routes?: readonly NavigationRouteLike[];
};

const RESTORABLE_ROUTE_NAMES = new Set([
  "index",
  "home",
  "blog-search",
  "blog-view/[blogId]/index",
  "blog-view-2/[blogId]/index",
  "blog-view-text/[blogId]/index",
  "channels",
  "channels/[channelId]",
  "channel-updates",
  "play-history",
  "search",
  "settings",
  "channel-configuration",
  "album-organizer/index",
  "album-organizer/[channelId]/index",
  "album-organizer/[channelId]/runs/[runId]/index",
  "album-organizer/[channelId]/runs/[runId]/albums/[suggestionId]",
  "transcribe-queue",
  "updates",
  "albums",
  "albums/[albumId]",
  "playlists",
  "playlists/[playlistId]",
  "books",
  "books/library/index",
  "books/library/[itemId]",
  "books/[bookId]",
  "books/[bookId]/chapters",
  "books/[bookId]/reader/[pageId]",
  "books/[bookId]/search",
]);
const SENSITIVE_ROUTE_PARAM_PATTERN =
  /(?:auth|code|credential|otp|password|secret|session|token)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function fingerprintOtaLaunchUrl(url: string | null) {
  if (!url) return null;
  let hash = 2_166_136_261;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeRouteName(routeName: string) {
  return routeName.replace(/^\/+/, "").replace(/\/+$/, "");
}

function isRestorableRouteName(routeName: string) {
  const normalized = normalizeRouteName(routeName);
  return RESTORABLE_ROUTE_NAMES.has(normalized);
}

function routeNameToPathname(routeName: string) {
  const normalized = normalizeRouteName(routeName);
  if (normalized === "index") return "/";
  return `/${normalized.replace(/\/index$/, "")}`;
}

function isRestorablePathname(pathname: string) {
  for (const routeName of RESTORABLE_ROUTE_NAMES) {
    if (routeNameToPathname(routeName) === pathname) return true;
  }
  return false;
}

export function normalizeOtaRouteParams(
  params: unknown,
): Record<string, string | string[]> {
  if (!isRecord(params)) return {};

  const normalized: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (SENSITIVE_ROUTE_PARAM_PATTERN.test(key)) continue;
    if (typeof value === "string") {
      normalized[key] = value;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      normalized[key] = String(value);
      continue;
    }
    if (Array.isArray(value)) {
      const items = value
        .filter(
          (item): item is string | number | boolean =>
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean",
        )
        .map(String);
      if (items.length > 0) normalized[key] = items;
    }
  }
  return normalized;
}

export function getRestorableRouteFromNavigationState(
  state: NavigationStateLike | undefined,
): RestorableOtaRoute | null {
  const routes = state?.routes;
  if (!routes?.length) return null;

  const focusedIndex = Math.min(
    Math.max(state?.index ?? routes.length - 1, 0),
    routes.length - 1,
  );

  for (let index = focusedIndex; index >= 0; index -= 1) {
    const route = routes[index];
    if (!route) continue;

    const nestedRoute = getRestorableRouteFromNavigationState(route.state);
    if (nestedRoute) return nestedRoute;

    if (route.state || typeof route.name !== "string") continue;
    if (!isRestorableRouteName(route.name)) continue;

    return {
      pathname: routeNameToPathname(route.name),
      params: normalizeOtaRouteParams(route.params),
    };
  }

  return null;
}

export function createPendingOtaRouteSnapshot(input: {
  route: RestorableOtaRoute;
  identity: OtaUpdateIdentity;
  reloadSource: OtaReloadSource;
  initialUrl?: string | null;
  capturedAt?: number;
}): PendingOtaRouteSnapshot {
  return {
    version: 1,
    route: input.route,
    capturedAt: input.capturedAt ?? Date.now(),
    reloadSource: input.reloadSource,
    sourceUpdateId: input.identity.updateId,
    sourceWasEmbedded: input.identity.isEmbeddedLaunch,
    sourceInitialUrlFingerprint: fingerprintOtaLaunchUrl(
      input.initialUrl ?? null,
    ),
  };
}

function isValidRouteParams(
  value: unknown,
): value is Record<string, string | string[]> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([key, param]) =>
      !SENSITIVE_ROUTE_PARAM_PATTERN.test(key) &&
      (typeof param === "string" ||
        (Array.isArray(param) &&
          param.every((item) => typeof item === "string"))),
  );
}

export function parsePendingOtaRouteSnapshot(
  raw: string | null,
  now = Date.now(),
): PendingOtaRouteSnapshot | null {
  if (!raw || raw.length > OTA_ROUTE_SNAPSHOT_MAX_LENGTH) return null;

  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value) || value.version !== 1) return null;
    if (
      typeof value.capturedAt !== "number" ||
      value.capturedAt > now + 60_000 ||
      now - value.capturedAt > OTA_ROUTE_SNAPSHOT_MAX_AGE_MS
    ) {
      return null;
    }
    if (
      value.reloadSource !== "automatic" &&
      value.reloadSource !== "manual"
    ) {
      return null;
    }
    if (
      value.sourceUpdateId !== null &&
      typeof value.sourceUpdateId !== "string"
    ) {
      return null;
    }
    if (typeof value.sourceWasEmbedded !== "boolean") return null;
    if (
      value.sourceInitialUrlFingerprint !== null &&
      (typeof value.sourceInitialUrlFingerprint !== "string" ||
        !/^[a-f0-9]{8}$/.test(value.sourceInitialUrlFingerprint))
    ) {
      return null;
    }
    if (!isRecord(value.route)) return null;
    if (
      typeof value.route.pathname !== "string" ||
      !value.route.pathname.startsWith("/") ||
      value.route.pathname.length > 500 ||
      !isRestorablePathname(value.route.pathname) ||
      !isValidRouteParams(value.route.params)
    ) {
      return null;
    }

    return value as PendingOtaRouteSnapshot;
  } catch {
    return null;
  }
}

export function hasOtaUpdateIdentityChanged(
  snapshot: PendingOtaRouteSnapshot,
  current: OtaUpdateIdentity,
) {
  return (
    snapshot.sourceWasEmbedded !== current.isEmbeddedLaunch ||
    snapshot.sourceUpdateId !== current.updateId
  );
}

export function hasNewExternalLaunchUrl(
  snapshot: PendingOtaRouteSnapshot,
  currentInitialUrl: string | null,
  receivedExternalUrlEvent = false,
) {
  return (
    receivedExternalUrlEvent ||
    (currentInitialUrl !== null &&
      fingerprintOtaLaunchUrl(currentInitialUrl) !==
        snapshot.sourceInitialUrlFingerprint)
  );
}

export async function runOtaUpdateReload(input: {
  prepare: () => Promise<unknown>;
  clear: () => Promise<unknown>;
  reload: () => Promise<unknown>;
  onPrepareError?: (error: unknown) => void;
  onReloadError?: (error: unknown) => void;
}) {
  try {
    await input.prepare();
  } catch (error) {
    input.onPrepareError?.(error);
    try {
      await input.clear();
    } catch {
      throw error;
    }
  }

  try {
    await input.reload();
  } catch (error) {
    input.onReloadError?.(error);
    await input.clear().catch(() => undefined);
    throw error;
  }
}

export function areOtaRoutesEqual(
  left: RestorableOtaRoute | null,
  right: RestorableOtaRoute | null,
) {
  if (!left || !right || left.pathname !== right.pathname) return false;
  const normalizeEntries = (params: RestorableOtaRoute["params"]) =>
    Object.entries(params)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, value]) => [key, value]);
  return (
    JSON.stringify(normalizeEntries(left.params)) ===
    JSON.stringify(normalizeEntries(right.params))
  );
}
