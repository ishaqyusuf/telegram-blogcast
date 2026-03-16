import { useMutation } from "@acme/ui/tanstack";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
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
}

export function CommentInput({ blogId, onCommentAdded }: CommentInputProps) {
  const [text, setText] = useState("");
  const position = useAudioStore((s) => s.position);

  const { mutate: addComment, isPending } = useMutation(
    _trpc.blog.addComment.mutationOptions({
      onSuccess() {
        setText("");
        onCommentAdded?.();
      },
    })
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
              placeholderTextColor="#535353"
              multiline
              maxLength={500}
              style={{ flex: 1, fontSize: 14, color: "#ffffff", maxHeight: 100 }}
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
              <Icon name="ArrowUp" size={18} className="text-primary-foreground" />
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
