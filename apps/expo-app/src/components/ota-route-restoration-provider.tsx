import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { type Href, router, useNavigationContainerRef } from "expo-router";
import * as Updates from "expo-updates";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  OTA_ROUTE_SNAPSHOT_MAX_LENGTH,
  PENDING_OTA_ROUTE_STORAGE_KEY,
  areOtaRoutesEqual,
  createPendingOtaRouteSnapshot,
  getRestorableRouteFromNavigationState,
  hasNewExternalLaunchUrl,
  hasOtaUpdateIdentityChanged,
  parsePendingOtaRouteSnapshot,
  runOtaUpdateReload,
  type NavigationStateLike,
  type OtaReloadSource,
} from "@/lib/ota-route-restoration";
import { Sentry } from "@/lib/sentry";

const NAVIGATION_READY_TIMEOUT_MS = 3_000;
const NAVIGATION_READY_POLL_MS = 25;
const routeRestorationEnabled =
  Constants.expoConfig?.extra?.restoreRouteAfterOtaUpdate !== false;

type OtaRouteRestorationContextValue = {
  restorationReady: boolean;
  reloadIntoUpdate: (source: OtaReloadSource) => Promise<void>;
};

const OtaRouteRestorationContext =
  createContext<OtaRouteRestorationContextValue | null>(null);

function getCurrentUpdateIdentity() {
  return {
    updateId: Updates.updateId,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  };
}

function addOtaRouteBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
  level: "info" | "warning" | "error" = "info",
) {
  Sentry.addBreadcrumb({
    category: "expo-updates",
    level,
    message,
    data,
  });
}

async function waitForNavigationReady(input: {
  isReady: () => boolean;
  isCancelled: () => boolean;
}) {
  const startedAt = Date.now();
  while (
    !input.isReady() &&
    !input.isCancelled() &&
    Date.now() - startedAt < NAVIGATION_READY_TIMEOUT_MS
  ) {
    await new Promise((resolve) =>
      setTimeout(resolve, NAVIGATION_READY_POLL_MS),
    );
  }
  return input.isReady() && !input.isCancelled();
}

export function OtaRouteRestorationProvider({
  children,
}: PropsWithChildren) {
  const navigationRef = useNavigationContainerRef();
  const [restorationReady, setRestorationReady] = useState(false);

  const clearPendingUpdateRoute = useCallback(async () => {
    await AsyncStorage.removeItem(PENDING_OTA_ROUTE_STORAGE_KEY);
  }, []);

  const prepareForUpdateReload = useCallback(
    async (reloadSource: OtaReloadSource) => {
      await clearPendingUpdateRoute();
      if (!routeRestorationEnabled) return false;
      if (!navigationRef.isReady()) return false;

      const route = getRestorableRouteFromNavigationState(
        navigationRef.getRootState() as NavigationStateLike,
      );
      if (!route) {
        await clearPendingUpdateRoute();
        return false;
      }

      const snapshot = createPendingOtaRouteSnapshot({
        route,
        identity: getCurrentUpdateIdentity(),
        reloadSource,
        initialUrl: await Linking.getInitialURL().catch(() => null),
      });
      const serializedSnapshot = JSON.stringify(snapshot);
      if (serializedSnapshot.length > OTA_ROUTE_SNAPSHOT_MAX_LENGTH) {
        await clearPendingUpdateRoute();
        return false;
      }
      await AsyncStorage.setItem(
        PENDING_OTA_ROUTE_STORAGE_KEY,
        serializedSnapshot,
      );
      addOtaRouteBreadcrumb("Saved route before OTA reload", {
        pathname: route.pathname,
        reloadSource,
      });
      return true;
    },
    [clearPendingUpdateRoute, navigationRef],
  );

  const reloadIntoUpdate = useCallback(
    (reloadSource: OtaReloadSource) =>
      runOtaUpdateReload({
        prepare: () => prepareForUpdateReload(reloadSource),
        clear: clearPendingUpdateRoute,
        reload: Updates.reloadAsync,
        onPrepareError: (error) =>
          addOtaRouteBreadcrumb(
            "OTA route snapshot failed",
            { error: String(error) },
            "warning",
          ),
        onReloadError: (error) =>
          addOtaRouteBreadcrumb(
            "OTA reload failed after route capture",
            { error: String(error) },
            "error",
          ),
      }),
    [clearPendingUpdateRoute, prepareForUpdateReload],
  );

  useEffect(() => {
    let cancelled = false;
    let receivedExternalUrlEvent = false;
    const linkingSubscription = Linking.addEventListener("url", () => {
      receivedExternalUrlEvent = true;
    });

    const finish = () => {
      if (!cancelled) setRestorationReady(true);
    };

    const restorePendingRoute = async () => {
      let rawSnapshot: string | null = null;
      try {
        if (!routeRestorationEnabled) {
          await clearPendingUpdateRoute();
          return;
        }
        rawSnapshot = await AsyncStorage.getItem(
          PENDING_OTA_ROUTE_STORAGE_KEY,
        );
        const snapshot = parsePendingOtaRouteSnapshot(rawSnapshot);
        if (!snapshot) {
          if (rawSnapshot) {
            addOtaRouteBreadcrumb("Discarded invalid OTA route snapshot");
            await clearPendingUpdateRoute();
          }
          return;
        }

        if (
          !hasOtaUpdateIdentityChanged(snapshot, getCurrentUpdateIdentity())
        ) {
          addOtaRouteBreadcrumb(
            "Discarded OTA route snapshot without an update change",
          );
          await clearPendingUpdateRoute();
          return;
        }

        const navigationReady = await waitForNavigationReady({
          isReady: () => navigationRef.isReady(),
          isCancelled: () => cancelled,
        });
        if (!navigationReady) {
          await clearPendingUpdateRoute();
          console.warn("[updates] route restoration navigation timeout");
          addOtaRouteBreadcrumb(
            "OTA route restoration navigation timeout",
            undefined,
            "warning",
          );
          return;
        }

        const currentRoute = getRestorableRouteFromNavigationState(
          navigationRef.getRootState() as NavigationStateLike,
        );
        const alreadyRestored = areOtaRoutesEqual(currentRoute, snapshot.route);
        const currentInitialUrl = await Linking.getInitialURL().catch(() => null);
        const hasNewExternalDestination =
          hasNewExternalLaunchUrl(
            snapshot,
            currentInitialUrl,
            receivedExternalUrlEvent,
          ) &&
          !alreadyRestored;

        await clearPendingUpdateRoute();
        const shouldSkipForExternalDestination =
          hasNewExternalDestination || receivedExternalUrlEvent;
        if (shouldSkipForExternalDestination) {
          addOtaRouteBreadcrumb(
            "Skipped OTA route restoration for a new external link",
          );
        }
        if (
          cancelled ||
          alreadyRestored ||
          shouldSkipForExternalDestination
        ) {
          return;
        }

        router.replace({
          pathname: snapshot.route.pathname,
          params: snapshot.route.params,
        } as Href);
        addOtaRouteBreadcrumb("Restored route after OTA reload", {
          pathname: snapshot.route.pathname,
          reloadSource: snapshot.reloadSource,
        });
      } catch (error) {
        console.warn("[updates] route restoration failed", error);
        addOtaRouteBreadcrumb(
          "OTA route restoration failed",
          { error: String(error) },
          "error",
        );
        if (rawSnapshot) {
          await clearPendingUpdateRoute().catch(() => undefined);
        }
      } finally {
        linkingSubscription.remove();
        finish();
      }
    };

    void restorePendingRoute();
    return () => {
      cancelled = true;
      linkingSubscription.remove();
    };
  }, [clearPendingUpdateRoute, navigationRef]);

  const value = useMemo(
    () => ({
      restorationReady,
      reloadIntoUpdate,
    }),
    [reloadIntoUpdate, restorationReady],
  );

  return (
    <OtaRouteRestorationContext.Provider value={value}>
      {children}
    </OtaRouteRestorationContext.Provider>
  );
}

export function useOtaRouteRestoration() {
  const context = useContext(OtaRouteRestorationContext);
  if (!context) {
    throw new Error(
      "useOtaRouteRestoration must be used within OtaRouteRestorationProvider",
    );
  }
  return context;
}
