import { Pressable } from "@/components/ui/pressable";
import { useMutation } from "@/lib/react-query";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";

import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { useAudioStore } from "@/store/audio-store";

function formatTimestamp(positionMs: number) {
  const totalSec = Math.floor(positionMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

interface CommentInputProps {
  blogId: number;
  onCommentAdded?: () => void;
  autoFocus?: boolean;
  noKeyboardAvoid?: boolean;
  compact?: boolean;
  onClose?: () => void;
}

export function CommentInput({
  blogId,
  onCommentAdded,
  autoFocus,
  noKeyboardAvoid,
  compact,
  onClose,
}: CommentInputProps) {
  const colors = useColors();
  const [text, setText] = useState("");
  const position = useAudioStore((s) => s.position);

  const { mutate: addComment, isPending } = useMutation(
    _trpc.blog.addComment.mutationOptions({
      onSuccess() {
        setText("");
        onCommentAdded?.();
        onClose?.();
      },
    }),
  );

  function handleTimestampPress() {
    const ts = formatTimestamp(position);
    setText((prev) => `[${ts}] ${prev}`);
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;
    addComment({ blogId, content: trimmed });
  }

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
          <TextInput
            value={text}
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
    <View className="border-t border-border bg-background px-3 py-2">
      <View className="flex-row items-end gap-2">
        {/* Avatar */}
        <View className="size-8 rounded-full bg-muted items-center justify-center shrink-0 mb-1">
          <Text className="text-xs font-bold text-muted-foreground">ME</Text>
        </View>

        {/* Input container */}
        <View className="flex-1 flex-row items-end bg-card rounded-2xl border border-border px-3 py-2 gap-2">
          <TextInput
            value={text}
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

          {/* Timestamp icon — inserts current audio position */}
          <Pressable
            onPress={handleTimestampPress}
            className="mb-0.5 active:opacity-60"
            hitSlop={8}
          >
            <Icon name="Timer" size={18} className="text-muted-foreground" />
          </Pressable>
        </View>

        {/* Send button — shown only when text is non-empty */}
        {text.trim().length > 0 && (
          <Pressable
            onPress={handleSend}
            disabled={isPending}
            className="size-9 rounded-full bg-primary items-center justify-center mb-0.5 active:opacity-80 disabled:opacity-40 shrink-0"
          >
            <Icon
              name="ArrowUp"
              size={18}
              className="text-primary-foreground"
            />
          </Pressable>
        )}
      </View>
    </View>
  );

  if (noKeyboardAvoid) return inner;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {inner}
    </KeyboardAvoidingView>
  );
}
