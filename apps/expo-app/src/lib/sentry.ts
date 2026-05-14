import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const sentryEnabled = process.env.EXPO_PUBLIC_SENTRY_ENABLED !== "false";
const sentryDebug = process.env.EXPO_PUBLIC_SENTRY_DEBUG === "true";
const environment =
  process.env.EXPO_PUBLIC_APP_VARIANT ??
  process.env.NODE_ENV ??
  "development";

let hasInitializedSentry = false;

export const initSentry = () => {
  if (hasInitializedSentry || !dsn) {
    return;
  }

  Sentry.init({
    dsn,
    enabled: sentryEnabled,
    debug: sentryDebug,
    environment,
    tracesSampleRate: 1,
  });

  const manifest = Updates.manifest;
  const metadata = manifest && "metadata" in manifest ? manifest.metadata : undefined;
  const extra = manifest && "extra" in manifest ? manifest.extra : undefined;
  const updateGroup =
    metadata && "updateGroup" in metadata ? metadata.updateGroup : undefined;

  const scope = Sentry.getGlobalScope();
  scope.setTag("expo-update-id", Updates.updateId ?? "embedded");
  scope.setTag("expo-is-embedded-update", String(Updates.isEmbeddedLaunch));

  if (typeof updateGroup === "string") {
    const owner = extra?.expoClient?.owner ?? "[account]";
    const slug = extra?.expoClient?.slug ?? "[project]";

    scope.setTag("expo-update-group-id", updateGroup);
    scope.setTag(
      "expo-update-debug-url",
      `https://expo.dev/accounts/${owner}/projects/${slug}/updates/${updateGroup}`,
    );
  } else if (Updates.isEmbeddedLaunch) {
    scope.setTag(
      "expo-update-debug-url",
      "not applicable for embedded updates",
    );
  }

  hasInitializedSentry = true;
};

export { Sentry };
