import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Text, View } from "react-native";

const COLORS = [
  { hex: "#FFD700", label: "ذهبي" },
  { hex: "#1DB954", label: "أخضر" },
  { hex: "#4A9EFF", label: "أزرق" },
  { hex: "#FF6B6B", label: "أحمر" },
];

type Props = {
  existingColor?: string | null; // if paragraph is already highlighted
  onSelectColor: (color: string) => void;
  onDelete?: () => void;
  onDismiss: () => void;
};

export function HighlightToolbar({ existingColor, onSelectColor, onDelete, onDismiss }: Props) {
  return (
    <View
      style={{
        position: "absolute",
        top: -52,
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#1E1E1E",
        borderRadius: 28,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
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
            borderColor: "#fff",
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
                backgroundColor: "rgba(0,0,0,0.4)",
              }}
            />
          )}
        </Pressable>
      ))}

      {/* Separator */}
      {onDelete && (
        <View style={{ width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 2 }} />
      )}

      {/* Delete */}
      {onDelete && (
        <Pressable
          onPress={onDelete}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: "rgba(239,68,68,0.15)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="Trash2" size={13} className="text-red-400" />
        </Pressable>
      )}

      {/* Separator */}
      <View style={{ width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 2 }} />

      {/* Dismiss */}
      <Pressable
        onPress={onDismiss}
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: "rgba(255,255,255,0.07)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="X" size={13} className="text-muted-foreground" />
      </Pressable>
    </View>
  );
}
