import { View, Text, TouchableOpacity, Image } from "react-native";
import { HomeFeedPostAuthor } from "./__mocks__/types";
import { Icon } from "@/components/ui/icon";

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
        {author?.avatarUrl ? (
          <Image
            source={{ uri: author.avatarUrl }}
            className="w-10 h-10 rounded-full bg-muted"
          />
        ) : (
          <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Text className="text-sm font-bold text-foreground">
              {author?.name?.slice(0, 2).toUpperCase() || "CH"}
            </Text>
          </View>
        )}
        <View>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm font-bold text-foreground">
              {author?.name || "Unknown channel"}
            </Text>
            {author?.isVerified && <Icon name="BadgeCheck" size={14} className="text-primary" />}
          </View>
          <Text className="text-xs text-muted-foreground">{createdAt}</Text>
        </View>
      </View>
      <TouchableOpacity className="p-1 rounded-full">
        <Icon name="MoreHorizontal" size={24} className="text-muted-foreground" />
      </TouchableOpacity>
    </View>
  );
}
