import { View, Text, TouchableOpacity, Image } from "react-native";
import { BadgeCheck, MoreHorizontal } from "lucide-react-native";
import { HomeFeedPostAuthor } from "./__mocks__/types";

type HomeFeedPostAuthorHeaderProps = {
  author?: HomeFeedPostAuthor;
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
          source={{ uri: author?.avatarUrl }}
          className="w-10 h-10 rounded-full bg-muted"
        />
        <View>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm font-bold text-foreground">
              {author?.name || "Admin"}
            </Text>
            {author?.isVerified && (
              <BadgeCheck size={14} className="text-primary" />
            )}
          </View>
          <Text className="text-xs text-muted-foreground">{createdAt}</Text>
        </View>
      </View>
      <TouchableOpacity className="p-1 rounded-full">
        <MoreHorizontal size={24} className="text-muted-foreground" />
      </TouchableOpacity>
    </View>
  );
}
