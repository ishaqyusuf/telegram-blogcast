import { View, Text, TouchableOpacity } from "react-native";
import { Heart, Bookmark, Share2 } from "lucide-react-native";

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
        <TouchableOpacity className="flex-row items-center gap-1">
          <Heart size={20} className="text-muted-foreground" />
          <Text className="text-xs font-medium text-muted-foreground">
            {likes}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Bookmark
            size={20}
            className="text-muted-foreground"
            fill={isBookmarked ? "currentColor" : "transparent"}
          />
        </TouchableOpacity>
        <TouchableOpacity>
          <Share2 size={20} className="text-muted-foreground" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
