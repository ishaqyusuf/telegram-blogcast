import { ActivityIndicator, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";

import { useLocalServicesSession } from "./local-services-session-provider";

type LocalServicesConnectionButtonProps = {
  appearance?: "default" | "plain";
};

const CONNECTION_BUTTON_APPEARANCE_CLASSES = {
  default: {
    onlineContainer:
      "size-11 items-center justify-center rounded-full border border-success bg-card active:opacity-70",
    offlineContainer:
      "size-11 items-center justify-center rounded-full border border-border bg-card active:opacity-70",
    onlineIcon: "text-success",
    offlineIcon: "text-muted-foreground",
    onlineDot:
      "absolute bottom-1.5 right-1.5 size-2.5 rounded-full border-2 border-card bg-success",
    offlineDot:
      "absolute bottom-1.5 right-1.5 size-2.5 rounded-full border-2 border-card bg-destructive",
  },
  plain: {
    onlineContainer:
      "size-11 items-center justify-center rounded-full active:bg-black/20",
    offlineContainer:
      "size-11 items-center justify-center rounded-full active:bg-black/20",
    onlineIcon: "size-base text-media-foreground",
    offlineIcon: "size-base text-media-foreground",
    onlineDot:
      "absolute bottom-1.5 right-1.5 size-2.5 rounded-full border-2 border-transparent bg-success",
    offlineDot:
      "absolute bottom-1.5 right-1.5 size-2.5 rounded-full border-2 border-transparent bg-destructive",
  },
} as const;

export function LocalServicesConnectionButton({
  appearance = "default",
}: LocalServicesConnectionButtonProps) {
  const colors = useColors();
  const { connectionStatus, requestSetup } = useLocalServicesSession();
  const appearanceClasses = CONNECTION_BUTTON_APPEARANCE_CLASSES[appearance];
  const connectionLabel =
    connectionStatus === "online"
      ? "Local services connected"
      : connectionStatus === "checking"
        ? "Checking local services"
        : "Local services offline";

  return (
    <Pressable
      onPress={requestSetup}
      className={
        connectionStatus === "online"
          ? appearanceClasses.onlineContainer
          : appearanceClasses.offlineContainer
      }
      accessibilityRole="button"
      accessibilityLabel={connectionLabel}
      accessibilityHint="Opens local services connection controls"
    >
      {connectionStatus === "checking" ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <>
          <Icon
            name={connectionStatus === "online" ? "Wifi" : "WifiOff"}
            className={
              connectionStatus === "online"
                ? appearanceClasses.onlineIcon
                : appearanceClasses.offlineIcon
            }
          />
          <View
            className={
              connectionStatus === "online"
                ? appearanceClasses.onlineDot
                : appearanceClasses.offlineDot
            }
          />
        </>
      )}
    </Pressable>
  );
}
