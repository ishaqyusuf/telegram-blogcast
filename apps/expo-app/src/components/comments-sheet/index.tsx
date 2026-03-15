import { Modal, View, TouchableWithoutFeedback } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useCommentsSheet } from "@/hooks/use-comments-sheet";
import { CommentsHeader } from "./comments-header";
import { CommentsAudioContext } from "./comments-audio-context";
import { CommentsList } from "./comments-list";
import { CommentInput } from "./comment-input";

interface CommentsSheetProps {
  blogId?: number;
}

export function CommentsSheet({ blogId = 0 }: CommentsSheetProps) {
  const { isOpen, onClose } = useCommentsSheet();

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isOpen}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <TouchableWithoutFeedback onPress={onClose}>
          <View className="absolute inset-0" />
        </TouchableWithoutFeedback>

        <View className="h-[85vh] bg-background rounded-t-4xl shadow-2xl overflow-hidden border-t border-border">
          {/* Sheet handle */}
          <View className="w-full flex items-center pt-3 pb-1 shrink-0">
            <View className="h-1.5 w-12 rounded-full bg-muted" />
          </View>

          <CommentsHeader />
          <CommentsAudioContext />

          {/* List with fade overlay */}
          <View className="flex-1 relative">
            <CommentsList />
            <LinearGradient
              colors={["transparent", "rgba(18,18,18,0.9)"]}
              className="absolute bottom-0 left-0 w-full h-8 pointer-events-none"
            />
          </View>

          {/* YouTube-style comment input fixed above keyboard */}
          <CommentInput blogId={blogId} />
        </View>
      </View>
    </Modal>
  );
}

export function CommentContent({ blogId = 0 }: CommentsSheetProps) {
  return (
    <View className="w-full">
      <CommentsHeader />
      <CommentsAudioContext />
      <View className="relative">
        <CommentsList />
        <LinearGradient
          colors={["transparent", "rgba(18,18,18,1)"]}
          className="absolute bottom-0 left-0 w-full h-20 pointer-events-none"
        />
      </View>
      <CommentInput blogId={blogId} />
    </View>
  );
}
