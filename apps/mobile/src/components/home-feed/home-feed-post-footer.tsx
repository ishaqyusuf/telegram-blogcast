import { View, Text, TouchableOpacity } from "react-native";
import { Icon } from "../ui/icon";

type HomeFeedPostFooterProps = {
  tags?: string[];
  likes: number;
  isBookmarked: boolean;
};

export function HomeFeedPostFooter({
  tags,
  likes,
  isBookmarked,
}: HomeFeedPostFooterProps) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row gap-2 flex-wrap">
        {tags?.map((tag) => (
          <View key={tag} className="px-2.5 py-1 rounded-md bg-primary/10">
            <Text className="text-xs font-medium text-primary">{tag}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row items-center gap-4">
        <TouchableOpacity className="flex-row p-1.5 items-center gap-1">
          <Icon
            name="Heart"
            size={20}
            className="text-muted-foreground size-20"
          />
          <Text className="text-sm font-medium text-muted-foreground">
            {likes}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity className="p-1.5">
          <Icon
            name="Bookmark"
            className="text-muted-foreground size-20"
            fill={isBookmarked ? "currentColor" : "transparent"}
          />
        </TouchableOpacity>
        <TouchableOpacity className="p-1.5">
          <Icon name="Share2" className="text-muted-foreground size-20" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
