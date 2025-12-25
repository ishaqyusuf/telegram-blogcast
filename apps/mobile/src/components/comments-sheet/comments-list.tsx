import { View, Text, TouchableOpacity, Image, I18nManager } from "react-native";
import { FilePenLine, Trash2, MoreHorizontal, Play } from "lucide-react-native";
import { DUMMY_COMMENTS } from "./__mocks__/data";
import { LegendList } from "@legendapp/list";

function CommentItem({ item }: { item: (typeof DUMMY_COMMENTS)[0] }) {
  return (
    <View className="flex-row  items-start gap-3">
      <Image
        source={{ uri: item.author.avatar }}
        className="w-10 h-10 rounded-full bg-muted border border-border"
      />
      <View className="flex-1 flex-col items-start">
        <View className="flex-row items-center justify-between w-full">
          <View className="flex-row items-baseline gap-2">
            <Text className="text-foreground text-sm font-bold">
              {item.author.name}
            </Text>
            <Text className="text-muted-foreground text-[10px]">•</Text>
            <Text className="text-muted-foreground text-xs font-medium">
              {item.timestamp}
            </Text>
          </View>
          {/* Hover actions are not standard on mobile, showing them for authors */}
          {item.isAuthor ? (
            <View className="flex-row gap-1">
              <TouchableOpacity className="p-1">
                <FilePenLine size={16} className="text-muted-foreground" />
              </TouchableOpacity>
              <TouchableOpacity className="p-1">
                <Trash2 size={16} className="text-destructive" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity className="p-1">
              <MoreHorizontal size={16} className="text-muted-foreground" />
            </TouchableOpacity>
          )}
        </View>
        <View className="w-full mt-1.5">
          <Text
            className="text-foreground text-[15px] leading-relaxed text-right"
            style={{ writingDirection: I18nManager.isRTL ? "rtl" : "ltr" }}
          >
            {item.content}
          </Text>
        </View>
        {item.audioTimestamp && (
          <View className="mt-2.5">
            <TouchableOpacity className="flex-row items-center gap-1.5 pl-2 pr-3 py-1 rounded-full bg-primary/15 border border-primary/20">
              <Play size={16} className="text-primary" fill="currentColor" />
              <Text className="text-primary text-xs font-bold tracking-wide">
                {item.audioTimestamp}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export function CommentsList() {
  return (
    <LegendList
      data={DUMMY_COMMENTS}
      renderItem={({ item }) => <CommentItem item={item} />}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 24, paddingBottom: 128 }}
      ItemSeparatorComponent={() => <View className="h-7" />}
      className="flex-1"
    />
  );
}
