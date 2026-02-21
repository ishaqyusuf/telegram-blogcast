import { View, Text, TouchableOpacity } from "react-native";
import { X } from "lucide-react-native";
import { useCommentsSheet } from "@/hooks/use-comments-sheet";

export function CommentsHeader() {
  const { onClose } = useCommentsSheet();
  return (
    <View className="flex items-center justify-between px-6 py-4 bg-background flex-row shrink-0 z-30">
      <Text className="text-white text-xl font-bold tracking-tight">
        Comments (14)
      </Text>
      <TouchableOpacity
        onPress={onClose}
        className="p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-full"
      >
        <X size={24} className="text-muted-foreground" />
      </TouchableOpacity>
    </View>
  );
}
