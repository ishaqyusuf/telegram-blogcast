import { AudioBlogBottomNav } from "@/components/audio-blog-view/audio-blog-bottom-nav";
import { AudioBlogContent } from "@/components/audio-blog-view/audio-blog-content";
import { AudioBlogHeader } from "@/components/audio-blog-view/audio-blog-header";
import { AudioBlogPlayer } from "@/components/audio-blog-view/audio-blog-player";
import { CommentsSheet } from "@/components/comments-sheet";
import { ScrollView, View } from "react-native";

export default function BlogView() {
  return (
    <View className="flex-1 bg-background">
      <AudioBlogHeader />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="px-6 pt-4 flex flex-col gap-6">
          <AudioBlogPlayer />
          <AudioBlogContent />
        </View>
      </ScrollView>
      <AudioBlogBottomNav />
      <CommentsSheet />
    </View>
  );
}