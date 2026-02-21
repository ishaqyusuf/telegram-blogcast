import { Modal, View, TouchableWithoutFeedback } from "react-native";
import { useCommentsSheet } from "@/hooks/use-comments-sheet";
import { CommentsHeader } from "./comments-header";
import { CommentsAudioContext } from "./comments-audio-context";
import { CommentsList } from "./comments-list";
import { CommentsFab } from "./comments-fab";
import { LinearGradient } from "expo-linear-gradient";

export function CommentsSheet() {
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
          {/* Sheet Handle */}
          <View className="w-full flex items-center pt-3 pb-1 shrink-0">
            <View className="h-1.5 w-12 rounded-full bg-muted" />
          </View>

          <CommentsHeader />
          <CommentsAudioContext />
          <CommentsList />
          <CommentsFab />

          {/* Fade Overlay at Bottom of List */}
        </View>
      </View>
    </Modal>
  );
}

export function CommentContent() {
  return (
    <View className="w-full">
      <CommentsHeader />
      <CommentsAudioContext />
      <CommentsList />
      <CommentsFab />
      <LinearGradient
        colors={["transparent", "rgba(17, 20, 33, 1)"]}
        className="absolute bottom-0 left-0 w-full h-20 pointer-events-none"
      />
    </View>
  );
}
