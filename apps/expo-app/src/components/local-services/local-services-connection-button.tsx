import { ActivityIndicator, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";

import { useLocalServicesSession } from "./local-services-session-provider";

export function LocalServicesConnectionButton() {
  const colors = useColors();
  const { connectionStatus, requestSetup } = useLocalServicesSession();
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
          ? "size-11 items-center justify-center rounded-full border border-success bg-card active:opacity-70"
          : "size-11 items-center justify-center rounded-full border border-border bg-card active:opacity-70"
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
                ? "text-success"
                : "text-muted-foreground"
            }
          />
          <View
            className={
              connectionStatus === "online"
                ? "absolute bottom-1.5 right-1.5 size-2.5 rounded-full border-2 border-card bg-success"
                : "absolute bottom-1.5 right-1.5 size-2.5 rounded-full border-2 border-card bg-destructive"
            }
          />
        </>
      )}
    </Pressable>
  );
}
