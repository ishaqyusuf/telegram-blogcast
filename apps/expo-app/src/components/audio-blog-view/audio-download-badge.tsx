import { ActivityIndicator } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";

export function AudioDownloadBadge({
  downloaded,
  downloading,
  progress,
  error,
  disabled,
  onPress,
}: {
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  error?: string | null;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={(event) => { event.stopPropagation(); onPress(); }}
      disabled={disabled || downloaded || downloading}
      accessibilityRole="button"
      accessibilityLabel={downloaded ? "Downloaded for offline use" : downloading ? `Downloading audio ${Math.round(progress * 100)} percent` : error ? "Retry audio download" : "Download audio for offline use"}
      accessibilityState={{ disabled: Boolean(disabled || downloaded || downloading), busy: downloading }}
      style={{
        position: "absolute", right: -8, bottom: -8, width: 30, height: 30,
        borderRadius: 15, borderWidth: 2, borderColor: colors.background,
        alignItems: "center", justifyContent: "center",
        backgroundColor: downloaded ? colors.downloaded : error ? colors.destructive : colors.primary,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {downloading ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : downloaded ? <Icon name="Check" size={15} color={colors.downloadedForeground} /> : <Icon name="Download" size={15} color={colors.primaryForeground} />}
    </Pressable>
  );
}
