import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";

export function AudioRenameSheet({
  visible,
  currentOverride,
  originalTitle,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  currentOverride?: string | null;
  originalTitle: string;
  saving: boolean;
  onClose: () => void;
  onSave: (value: string | null) => void;
}) {
  const colors = useColors();
  const [value, setValue] = useState("");
  useEffect(() => { if (visible) setValue(currentOverride ?? ""); }, [currentOverride, visible]);
  const trimmed = value.trim();
  return (
    <FloatingBottomSheet
      visible={visible}
      onClose={onClose}
      title="Rename audio"
      accessibilityLabel="Rename audio"
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      androidKeyboardInputMode="adjustPan"
    >
      <KeyboardAwareScrollView
        bottomOffset={20}
        disableScrollOnKeyboardHide
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 14 }}
      >
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Original: {originalTitle}</Text>
        <BottomSheetTextInput
          value={value}
          onChangeText={setValue}
          maxLength={180}
          placeholder="Audio title"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="New audio title"
          style={{ color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1, borderRadius: 14, minHeight: 50, paddingHorizontal: 14, textAlign: "right" }}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {currentOverride ? (
            <Pressable onPress={() => onSave(null)} disabled={saving} style={{ minHeight: 48, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Reset to original title">
              <Text style={{ color: colors.foreground, fontWeight: "700" }}>Reset</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => onSave(trimmed)} disabled={saving || !trimmed} style={{ flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: saving || !trimmed ? 0.5 : 1 }} accessibilityLabel="Save audio title">
            {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={{ color: colors.primaryForeground, fontWeight: "800" }}>Save</Text>}
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </FloatingBottomSheet>
  );
}
