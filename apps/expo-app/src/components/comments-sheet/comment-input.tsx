import { Pressable } from "@/components/ui/pressable";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";

import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { useCommentDraft } from "./use-comment-draft";

interface CommentInputProps {
  blogId: number;
  onCommentAdded?: () => void;
  autoFocus?: boolean;
  noKeyboardAvoid?: boolean;
  compact?: boolean;
  onClose?: () => void;
  timestampMode?: boolean;
  onFocus?: () => void;
  dark?: boolean;
}

export function CommentInput({
  blogId,
  onCommentAdded,
  autoFocus,
  noKeyboardAvoid,
  compact,
  onClose,
  timestampMode,
  onFocus,
  dark = false,
}: CommentInputProps) {
  const colors = useColors();
  const {
    text, setText, error, isPending, timestampEnabled, timestampLabel,
    handleTimestampPress, handleSend,
  } = useCommentDraft({ blogId, timestampMode, onCommentAdded, onClose });

  function handleSubmitEditing() {
    if (!compact) return;
    handleSend();
  }

  const inner = compact ? (
    <View className="border-t border-border bg-background px-3 py-2">
      <View className="flex-row items-center gap-2">
        {onClose && (
          <Pressable
            onPress={onClose}
            className="size-10 items-center justify-center rounded-full bg-card"
          >
            <Icon name="X" size={16} className="text-muted-foreground" />
          </Pressable>
        )}
        <View className="flex-1 flex-row items-center rounded-full border border-border bg-card px-3">
          <Icon
            name="MessageSquare"
            size={16}
            className="text-muted-foreground"
          />
          {timestampMode && timestampEnabled && (
            <Pressable
              onPress={handleTimestampPress}
              className="ml-2 flex-row items-center gap-1 rounded-md bg-muted px-2 py-1 active:opacity-70"
            >
              <Icon name="Timer" size={12} className="text-muted-foreground" />
              <Text className="text-xs font-bold text-muted-foreground">
                {timestampLabel}
              </Text>
              <Icon name="Plus" size={11} className="text-muted-foreground" />
            </Pressable>
          )}
          <TextInput
            value={text}
            onFocus={onFocus}
            onChangeText={setText}
            placeholder="Add a comment…"
            placeholderTextColor={colors.mutedForeground}
            autoFocus={autoFocus}
            maxLength={280}
            returnKeyType="send"
            onSubmitEditing={handleSubmitEditing}
            blurOnSubmit={false}
            style={{
              flex: 1,
              fontSize: 14,
              color: colors.foreground,
              paddingVertical: 12,
              paddingHorizontal: 10,
            }}
          />
        </View>
        {timestampMode && !timestampEnabled && (
          <Pressable
            onPress={handleTimestampPress}
            className="size-10 items-center justify-center rounded-full bg-card active:opacity-70"
          >
            <Icon name="Timer" size={16} className="text-muted-foreground" />
          </Pressable>
        )}
        <Pressable
          onPress={handleSend}
          disabled={isPending || text.trim().length === 0}
          className="size-10 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-40"
        >
          <Icon name="Send" size={16} className="text-primary-foreground" />
        </Pressable>
      </View>
    </View>
  ) : (
    <View className={`border-t px-3 py-2 ${dark ? "border-[#2c4057] bg-[#101c2f]" : "border-border bg-background"}`}>
      <View className="flex-row items-end gap-2">
        {/* Avatar */}
        <View className={`size-8 rounded-full items-center justify-center shrink-0 mb-1 ${dark ? "bg-[#23364e]" : "bg-muted"}`}>
          <Text className={`text-xs font-bold ${dark ? "text-[#9fb2c8]" : "text-muted-foreground"}`}>ME</Text>
        </View>

        {/* Input container */}
        <View className={`flex-1 flex-row items-end rounded-2xl border px-3 py-2 gap-2 ${dark ? "border-[#2c4057] bg-[#1c2a3a]" : "border-border bg-card"}`}>
          {timestampMode && timestampEnabled && (
            <Pressable
              onPress={handleTimestampPress}
              className={`mb-0.5 flex-row items-center gap-1 rounded-md px-2 py-1 active:opacity-70 ${dark ? "bg-[#23364e]" : "bg-muted"}`}
            >
              <Icon name="Timer" size={13} color={dark ? "#9fb2c8" : colors.mutedForeground} />
              <Text className={`text-xs font-bold ${dark ? "text-[#9fb2c8]" : "text-muted-foreground"}`}>
                {timestampLabel}
              </Text>
              <Icon name="Plus" size={11} color={dark ? "#9fb2c8" : colors.mutedForeground} />
            </Pressable>
          )}
          <TextInput
            value={text}
            onFocus={onFocus}
            onChangeText={setText}
            placeholder="Add a comment…"
            placeholderTextColor={colors.mutedForeground}
            autoFocus={autoFocus}
            multiline
            maxLength={500}
            style={{
              flex: 1,
              fontSize: 14,
              color: colors.foreground,
              maxHeight: 100,
            }}
          />

          {/* Timestamp icon — toggles current audio position metadata */}
          <Pressable
            onPress={handleTimestampPress}
            className="mb-0.5 active:opacity-60"
            hitSlop={8}
          >
            <Icon name="Timer" size={18} color={dark ? "#9fb2c8" : colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Send button — shown only when text is non-empty */}
        {text.trim().length > 0 && (
          <Pressable
            onPress={handleSend}
            disabled={isPending}
            className={`size-9 rounded-full items-center justify-center mb-0.5 active:opacity-80 disabled:opacity-40 shrink-0 ${dark ? "bg-[#bfdbfe]" : "bg-primary"}`}
          >
            <Icon
              name="ArrowUp"
              size={18}
              color={dark ? "#112b4c" : colors.primaryForeground}
            />
          </Pressable>
        )}
      </View>
    </View>
  );

  const content = (
    <View>
      {inner}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive, paddingHorizontal: 12, paddingBottom: 8 }}>{error}</Text> : null}
    </View>
  );
  if (noKeyboardAvoid) return content;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {content}
    </KeyboardAvoidingView>
  );
}
