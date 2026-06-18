import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n";

type Props = {
  existingColor?: string | null; // if paragraph is already highlighted
  onCopy: () => void;
  onHighlight: () => void;
  onDelete?: () => void;
  onDismiss: () => void;
};

export function HighlightToolbar({
  existingColor,
  onCopy,
  onHighlight,
  onDelete,
  onDismiss,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const hasHighlight = Boolean(existingColor);

  return (
    <View
      style={{
        position: "absolute",
        top: -52,
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: colors.card,
        borderRadius: 28,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 100,
      }}
    >
      <Pressable
        onPress={onCopy}
        style={{
          minHeight: 30,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderRadius: 15,
          paddingHorizontal: 10,
        }}
      >
        <Icon name="Copy" size={14} className="text-foreground" />
        <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>
          {t("copy")}
        </Text>
      </Pressable>

      <View style={{ width: 1, height: 20, backgroundColor: colors.border }} />

      {hasHighlight && onDelete ? (
        <Pressable
          onPress={onDelete}
          style={{
            minHeight: 30,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderRadius: 15,
            backgroundColor: withAlpha(colors.destructive, 0.15),
            paddingHorizontal: 10,
          }}
        >
          <Icon name="Trash2" size={13} className="text-destructive" />
          <Text style={{ color: colors.destructive, fontSize: 12, fontWeight: "700" }}>
            {t("removeHighlight")}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onHighlight}
          style={{
            minHeight: 30,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderRadius: 15,
            backgroundColor: withAlpha("#facc15", 0.22),
            paddingHorizontal: 10,
          }}
        >
          <Icon name="PenLine" size={13} className="text-foreground" />
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>
            {t("highlight")}
          </Text>
        </Pressable>
      )}

      <View style={{ width: 1, height: 20, backgroundColor: colors.border }} />

      <Pressable
        onPress={onDismiss}
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: withAlpha(colors.muted, 0.7),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="X" size={13} className="text-muted-foreground" />
      </Pressable>
    </View>
  );
}
