import { Pressable } from "@/components/ui/pressable";
import { View, Text, Image, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import { HomeFeedPostAuthorHeader } from "./home-feed-post-author-header";
import { HomeFeedPostFooter } from "./home-feed-post-footer";
import { HomeFeedAudioPlayer } from "./home-feed-audio-player";
import { RouterOutputs } from "@api/trpc/routers/_app";
import { formatDate } from "@acme/utils/dayjs";
import { minuteToString } from "@/lib/utils";
import { getBlogHref, getPrimaryImageUrl } from "@/components/blog-card/utils";
import { Icon } from "@/components/ui/icon";

export type ItemProps = RouterOutputs["podcasts"]["posts"]["data"][number];

function AudioPost({ post }: { post: ItemProps }) {
  const audioTitle = post.audio?.title?.trim();
  const caption = post.caption?.trim();
  const shouldShowCaption = Boolean(caption && caption !== audioTitle);

  return (
    <>
      <View className="mb-4">
        <Text className="text-xl font-bold text-foreground mb-2 leading-tight text-right">
          {audioTitle || caption || "Audio"}
        </Text>
        {shouldShowCaption ? (
          <Text className="text-muted-foreground text-base leading-relaxed text-right">
            {caption}
          </Text>
        ) : null}
      </View>
      <HomeFeedAudioPlayer
        post={post}
        duration={minuteToString(post.audio?.duration)}
      />
    </>
  );
}

function VideoPost({ post }: { post: ItemProps }) {
  const imageUrl = getPrimaryImageUrl(post as any);

  return (
    <>
      <View className="mb-4">
        <Text className="text-xl font-bold text-foreground mb-2 leading-tight text-right">
          {post.caption}
        </Text>
        <Text className="text-muted-foreground text-base leading-relaxed text-right">
          {post.content}
        </Text>
      </View>
      <ImageBackground
        source={imageUrl ? { uri: imageUrl } : undefined}
        className="h-32 rounded-xl mb-4 relative overflow-hidden justify-center items-center bg-black"
        imageStyle={{ borderRadius: 12 }}
      >
        <View className="absolute inset-0 bg-black/30" />
        <Pressable className="w-12 h-12 rounded-full bg-primary/90 items-center justify-center">
          <Icon name="Play" size={28} className="text-primary-foreground" />
        </Pressable>
        <View className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded">
          <Text className="text-xs font-medium text-white">
            {/* {post.video.duration} */}
          </Text>
        </View>
      </ImageBackground>
    </>
  );
}

function ImagePost({ post }: { post: ItemProps }) {
  const imageUrl = getPrimaryImageUrl(post as any);

  return (
    <>
      {post.caption ? (
        <Text className="mb-3 text-right text-base leading-relaxed text-muted-foreground">
          {post.caption}
        </Text>
      ) : null}
      {imageUrl ? (
        <View className="mb-4 overflow-hidden rounded-xl border border-border bg-black">
          <Image
            source={{ uri: imageUrl }}
            className="h-56 w-full"
            resizeMode="cover"
          />
        </View>
      ) : null}
    </>
  );
}

function TextPost({ post }: { post: ItemProps }) {
  return (
    <View className="mb-2 pt-3 border-t border-border">
      <Text className="text-foreground text-lg leading-relaxed text-right">
        {post.content}
      </Text>
    </View>
  );
}

export function HomeFeedPostCard({ post }: { post: ItemProps }) {
  const router = useRouter();
  const channel = (post as any).channel;
  const channelName = channel?.title || channel?.username || "Unknown channel";
  const tags = post.tags.filter((tag): tag is string => Boolean(tag));

  return (
    <Pressable
      onPress={() => {
        router.push(getBlogHref({ id: post.id, type: post.type } as any) as any);
      }}
    >
      <View className="bg-card rounded-2xl p-4 shadow-sm border border-border">
        <HomeFeedPostAuthorHeader
          author={{ name: channelName, avatarUrl: "" }}
          createdAt={formatDate(post.date, "MMM D, YYYY")}
        />
        {post.type === "audio" && <AudioPost post={post} />}
        {post.type === "video" && <VideoPost post={post} />}
        {post.type === "image" && <ImagePost post={post} />}
        {post.type === "text" && <TextPost post={post} />}
        <HomeFeedPostFooter
          tags={tags}
          likes={post.likes}
          isBookmarked={post.isBookmarked}
        />
      </View>
    </Pressable>
  );
}
