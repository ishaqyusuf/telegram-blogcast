
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type HomeFeedPostFooterProps = {
  tags: string[];
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
        {tags.map((tag) => (
          <View
            key={tag}
            className="px-2.5 py-1 rounded-md bg-primary/10 dark:bg-primary/20"
          >
            <Text className="text-xs font-medium text-primary dark:text-blue-300">
              {tag}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row items-center gap-4">
        <TouchableOpacity className="flex-row items-center gap-1 text-slate-400">
          <MaterialIcons name="favorite-border" size={20} color="gray" />
          <Text className="text-xs font-medium text-slate-400">{likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <MaterialIcons
            name={isBookmarked ? "bookmark" : "bookmark-border"}
            size={20}
            color="gray"
          />
        </TouchableOpacity>
        <TouchableOpacity>
          <MaterialIcons name="share" size={20} color="gray" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
