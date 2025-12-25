import {
  View,
  Text,
  TouchableOpacity,
  ImageBackground,
  I18nManager,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  AnyHomeFeedPost,
  HomeFeedAudioPost,
  HomeFeedTextPost,
  HomeFeedVideoPost,
} from "./__mocks__/types";
import { HomeFeedPostAuthorHeader } from "./home-feed-post-author-header";
import { HomeFeedPostFooter } from "./home-feed-post-footer";
import { HomeFeedAudioPlayer } from "./home-feed-audio-player";

const isRTL = I18nManager.isRTL;

function AudioPost({ post }: { post: HomeFeedAudioPost }) {
  return (
    <>
      <View className="mb-4" style={{ direction: isRTL ? "rtl" : "ltr" }}>
        <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight text-right">
          {post.title}
        </Text>
        <Text className="text-slate-600 dark:text-slate-300 text-base leading-relaxed text-right">
          {post.content}
        </Text>
      </View>
      <HomeFeedAudioPlayer duration={post.audio.duration} />
    </>
  );
}

function VideoPost({ post }: { post: HomeFeedVideoPost }) {
  return (
    <>
      <View className="mb-4" style={{ direction: isRTL ? "rtl" : "ltr" }}>
        <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight text-right">
          {post.title}
        </Text>
        <Text className="text-slate-600 dark:text-slate-300 text-base leading-relaxed text-right">
          {post.content}
        </Text>
      </View>
      <ImageBackground
        source={{ uri: post.coverImageUrl }}
        className="h-32 rounded-xl mb-4 relative overflow-hidden justify-center items-center"
        imageStyle={{ borderRadius: 12 }}
      >
        <View className="absolute inset-0 bg-black/30" />
        <TouchableOpacity className="w-12 h-12 rounded-full bg-primary/90 items-center justify-center">
          <MaterialIcons name="play-arrow" size={28} color="white" />
        </TouchableOpacity>
        <View className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded">
          <Text className="text-xs font-medium text-white">
            {post.video.duration}
          </Text>
        </View>
      </ImageBackground>
    </>
  );
}

function TextPost({ post }: { post: HomeFeedTextPost }) {
  return (
    <View
      className="mb-2 pt-3 border-t border-slate-100 dark:border-slate-800"
      style={{ direction: isRTL ? "rtl" : "ltr" }}
    >
      <Text className="text-foreground text-lg leading-relaxed text-right">
        {post.content}
      </Text>
    </View>
  );
}

export function HomeFeedPostCard({ post }: { post: AnyHomeFeedPost }) {
  return (
    <View className="bg-background rounded-2xl p-4 shadow-sm border border-foreground">
      <HomeFeedPostAuthorHeader
        author={post.author}
        createdAt={post.createdAt}
      />
      {post.type === "audio" && <AudioPost post={post} />}
      {post.type === "video" && <VideoPost post={post} />}
      {post.type === "text" && <TextPost post={post} />}
      <HomeFeedPostFooter
        tags={post.tags}
        likes={post.likes}
        isBookmarked={post.isBookmarked}
      />
    </View>
  );
}
