import { View, Text, TouchableOpacity, Image, I18nManager } from "react-native";
import { DUMMY_AUDIO_BLOG } from "./__mocks__/data";
import { useCommentsSheet } from "@/hooks/use-comments-sheet";
import { MessageSquare } from "lucide-react-native";
import { CommentContent } from "../comments-sheet";

export function AudioBlogContent() {
  const { author, title, publishedDate, description, tags } = DUMMY_AUDIO_BLOG;
  const commentsSheet = useCommentsSheet();

  return (
    <View className="flex flex-col gap-4 pb-8">
      {/* Author Info */}
      <View className="flex-row items-center gap-3 border-b border-border pb-4">
        <View className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
          <Image
            source={{ uri: author.avatar }}
            className="w-full h-full object-cover"
          />
        </View>
        <View className="flex flex-col">
          <Text className="text-xs text-muted-foreground font-medium">
            Author
          </Text>
          <Text className="text-sm font-bold text-foreground">
            {author.name}
          </Text>
        </View>
        <TouchableOpacity className="ml-auto px-4 py-1.5 rounded-full border border-border bg-muted">
          <Text className="text-xs font-bold text-muted-foreground">
            Follow
          </Text>
        </TouchableOpacity>
      </View>

      {/* Arabic Content */}
      <View
        // style={{ writingDirection: I18nManager.isRTL ? "rtl" : "ltr" }}
        className="flex flex-col gap-3"
      >
        <Text className="font-arabic text-2xl font-bold text-foreground leading-tight text-right">
          {title}
        </Text>
        <Text className="font-arabic text-xs text-muted-foreground text-right">
          {publishedDate}
        </Text>
        <View className="font-arabic text-base text-muted-foreground leading-relaxed opacity-90 space-y-2">
          {description.map((p, i) => (
            <Text
              key={i}
              className="text-base text-muted-foreground leading-relaxed text-right"
            >
              {p}
            </Text>
          ))}
        </View>
        {/* Tags and Comments Button */}
        <View className="flex-row flex-wrap gap-2 mt-4 items-center justify-between">
          <View className="flex-row flex-wrap gap-2 items-center">
            {tags.map((tag) => (
              <TouchableOpacity
                key={tag}
                className="px-3 py-1 bg-muted rounded-lg"
              >
                <Text className="text-sm font-arabic text-primary font-medium">
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <CommentContent />
        </View>
      </View>
    </View>
  );
}
