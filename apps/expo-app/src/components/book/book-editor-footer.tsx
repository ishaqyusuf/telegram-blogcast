import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { ScrollView, Text, View } from "react-native";

type Props = {
  isSaving?: boolean;
  dirty?: boolean;
  bottomInset?: number;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onHighlight: () => void;
  onBullets: () => void;
  onQuote: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCancel: () => void;
  onSave: () => void;
};

function FooterAction({
  icon,
  label,
  disabled = false,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="items-center gap-1 rounded-xl bg-card px-3 py-2"
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Icon name={icon} size={16} className="text-foreground" />
      <Text className="text-[11px] text-foreground">{label}</Text>
    </Pressable>
  );
}

export function BookEditorFooter({
  isSaving,
  dirty,
  bottomInset = 0,
  onBold,
  onItalic,
  onUnderline,
  onHighlight,
  onBullets,
  onQuote,
  onUndo,
  onRedo,
  onCancel,
  onSave,
}: Props) {
  return (
    <View
      className="border-t border-border bg-background px-3 pt-3"
      style={{ paddingBottom: 12 + bottomInset }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <FooterAction icon="PenLine" label="Bold" onPress={onBold} />
        <FooterAction icon="Edit2" label="Italic" onPress={onItalic} />
        <FooterAction icon="FileText" label="Underline" onPress={onUnderline} />
        <FooterAction icon="Copy" label="Highlight" onPress={onHighlight} />
        <FooterAction icon="ListOrdered" label="Bullets" onPress={onBullets} />
        <FooterAction icon="Layers" label="Quote" onPress={onQuote} />
        <FooterAction icon="RotateCcw" label="Undo" onPress={onUndo} />
        <FooterAction icon="RotateCw" label="Redo" onPress={onRedo} />
        <FooterAction icon="X" label="Cancel" onPress={onCancel} />
        <FooterAction
          icon={isSaving ? "Clock" : "Check"}
          label={isSaving ? "Saving" : dirty ? "Save" : "Saved"}
          disabled={isSaving || !dirty}
          onPress={onSave}
        />
      </ScrollView>
    </View>
  );
}
