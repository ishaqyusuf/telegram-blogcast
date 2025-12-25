
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
          className="w-10 h-10 rounded-full bg-muted"
        />
        <View>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm font-bold text-foreground">
              {author.name}
            </Text>
            {author.isVerified && (
              <MaterialIcons name="verified" size={14} className="text-primary" />
            )}
          </View>
          <Text className="text-xs text-muted-foreground">
            {createdAt}
          </Text>
        </View>
      </View>
      <TouchableOpacity className="p-1 rounded-full">
        <MaterialIcons
          name="more-horiz"
          size={24}
          className="text-muted-foreground"
        />
      </TouchableOpacity>
    </View>
  );
}
