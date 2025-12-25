
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { HomeFeedPostAuthor } from "./__mocks__/types";

type HomeFeedPostAuthorHeaderProps = {
  author: HomeFeedPostAuthor;
  createdAt: string;
};

export function HomeFeedPostAuthorHeader({
  author,
  createdAt,
}: HomeFeedPostAuthorHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <View className="flex-row items-center gap-3">
        <Image
          source={{ uri: author.avatarUrl }}
          className="w-10 h-10 rounded-full bg-slate-200"
        />
        <View>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm font-bold text-slate-900 dark:text-white">
              {author.name}
            </Text>
            {author.isVerified && (
              <MaterialIcons name="verified" size={14} color="#3b82f6" />
            )}
          </View>
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            {createdAt}
          </Text>
        </View>
      </View>
      <TouchableOpacity className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
        <MaterialIcons name="more-horiz" size={24} color="gray" />
      </TouchableOpacity>
    </View>
  );
}
