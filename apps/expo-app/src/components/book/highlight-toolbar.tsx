import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { View } from "react-native";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";

const COLORS = [
  { hex: "#d97706" },
  { hex: "#0d9488" },
  { hex: "#2563eb" },
  { hex: "#e11d48" },
];

type Props = {
  existingColor?: string | null; // if paragraph is already highlighted
  onSelectColor: (color: string) => void;
  onDelete?: () => void;
  onDismiss: () => void;
};

export function HighlightToolbar({ existingColor, onSelectColor, onDelete, onDismiss }: Props) {
  const colors = useColors();

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
      {COLORS.map((c) => (
        <Pressable
          key={c.hex}
          onPress={() => onSelectColor(c.hex)}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: c.hex,
            borderWidth: existingColor === c.hex ? 2 : 0,
            borderColor: colors.foreground,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {existingColor === c.hex && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: withAlpha(colors.background, 0.6),
              }}
            />
          )}
        </Pressable>
      ))}

      {/* Separator */}
      {onDelete && (
        <View style={{ width: 1, height: 18, backgroundColor: colors.border, marginHorizontal: 2 }} />
      )}

      {/* Delete */}
      {onDelete && (
        <Pressable
          onPress={onDelete}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: withAlpha(colors.destructive, 0.15),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="Trash2" size={13} className="text-red-400" />
        </Pressable>
      )}

      {/* Separator */}
      <View style={{ width: 1, height: 18, backgroundColor: colors.border, marginHorizontal: 2 }} />

      {/* Dismiss */}
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
