import { useLocalServicesSession } from "@/components/local-services";
import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";

export function BlogHomeHeader() {
  const router = useRouter();
  const colors = useColors();
  const { connectionStatus, requestSetup } = useLocalServicesSession();
  const connectionLabel =
    connectionStatus === "online"
      ? "Local services connected"
      : connectionStatus === "checking"
        ? "Checking local services"
        : "Local services offline";

  return (
    <View className="bg-background px-5 pb-3 pt-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => router.push("/settings" as any)}
          className="size-11 items-center justify-center rounded-full bg-primary active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Text className="text-xs font-bold text-primary-foreground">
            ME
          </Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
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
          <Pressable
            onPress={() => router.push("/search" as any)}
            className="size-11 items-center justify-center rounded-full border border-border bg-card active:bg-muted"
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Icon name="Search" className="text-muted-foreground" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
