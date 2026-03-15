import { useQuery } from "@acme/ui/tanstack";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  I18nManager,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { AudioTranscript } from "@/components/audio-blog-view/audio-transcript";
import { CommentsSheet } from "@/components/comments-sheet";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useCommentsSheet } from "@/hooks/use-comments-sheet";
import { usePlayHistorySync } from "@/hooks/use-play-history-sync";
import { useAudioStore } from "@/store/audio-store";
import { minuteToString } from "@/lib/utils";

const isRTL = I18nManager.isRTL;

type Tab = "info" | "transcript";

function formatMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Audio Player Controls ────────────────────────────────────────────────────

function PlayerSection({ blogId }: { blogId: number }) {
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const position = useAudioStore((s) => s.position);
  const duration = useAudioStore((s) => s.duration);
  const togglePlayPause = useAudioStore((s) => s.togglePlayPause);
  const seek = useAudioStore((s) => s.seek);

  const progress = duration > 0 ? position / duration : 0;

  return (
    <View className="gap-4">
      {/* Scrubber */}
      <View className="py-2">
        <View className="relative h-10 justify-center">
          {/* Track */}
          <View className="absolute w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
          {/* Thumb */}
          <View
            className="absolute w-4 h-4 bg-background rounded-full border-2 border-primary z-20 shadow-sm"
            style={{ left: `${Math.min(progress * 100, 95)}%` }}
          />
          {/* Waveform decoration */}
          <View className="absolute inset-0 flex-row items-center justify-between opacity-20 px-1 pointer-events-none">
            {[3, 5, 8, 4, 6, 3, 2, 5, 4, 3, 6, 4, 3, 5, 7].map((h, i) => (
              <View key={i} className="w-1 bg-foreground rounded-full" style={{ height: h * 3 }} />
            ))}
          </View>
        </View>
        <View className="flex-row justify-between mt-[-6px]">
          <Text className="text-xs font-medium text-muted-foreground">
            {formatMs(position)}
          </Text>
          <Text className="text-xs font-medium text-muted-foreground">
            -{formatMs(Math.max(0, duration - position))}
          </Text>
        </View>
      </View>

      {/* Controls row */}
      <View className="flex-row items-center justify-between">
        <Pressable className="px-2 py-1 rounded-md bg-muted active:opacity-70">
          <Text className="text-xs font-bold text-muted-foreground">1.0x</Text>
        </Pressable>

        <View className="flex-row items-center gap-6">
          <Pressable
            className="p-2 active:opacity-50"
            onPress={() => seek(Math.max(0, position - 10000))}
          >
            <Icon name="RotateCcw" size={28} className="text-foreground" />
          </Pressable>
          <Pressable
            onPress={() => togglePlayPause()}
            className="size-16 bg-primary rounded-full items-center justify-center shadow-lg active:opacity-90"
          >
            <Icon
              name={isPlaying ? "Pause" : "Play"}
              size={28}
              className="text-primary-foreground"
            />
          </Pressable>
          <Pressable
            className="p-2 active:opacity-50"
            onPress={() => seek(Math.min(duration, position + 10000))}
          >
            <Icon name="RotateCw" size={28} className="text-foreground" />
          </Pressable>
        </View>

        <Pressable className="p-2 active:opacity-50">
          <Icon name="Volume2" size={20} className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}

// ── Info tab content ─────────────────────────────────────────────────────────

function InfoTab({
  blog,
  onCommentsPress,
}: {
  blog: any;
  onCommentsPress: () => void;
}) {
  const tags =
    blog.blogTags?.map((bt: any) => bt.tags?.title).filter(Boolean) ?? [];
  const commentCount = blog.blogs?.length ?? 0;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerClassName="pb-8 gap-4"
    >
      {/* Author */}
      <View className="flex-row items-center gap-3 py-4 border-b border-border">
        <View className="size-10 rounded-full bg-muted items-center justify-center">
          <Text className="text-sm font-bold text-muted-foreground">AG</Text>
        </View>
        <View className="flex-1">
          <Text className="text-xs text-muted-foreground font-medium">Author</Text>
          <Text className="text-sm font-bold text-foreground">Alghurobaa</Text>
        </View>
        <Pressable className="px-4 py-1.5 rounded-full border border-border active:bg-muted">
          <Text className="text-xs font-bold text-muted-foreground">Follow</Text>
        </Pressable>
      </View>

      {/* Title & description */}
      <View className="gap-2">
        <Text
          className="text-xl font-bold text-foreground text-right"
          style={{ writingDirection: "rtl" }}
        >
          {blog.content ?? "Untitled"}
        </Text>
        {tags.length > 0 && (
          <View className="flex-row flex-wrap gap-2 justify-end mt-1">
            {tags.map((tag: string) => (
              <Pressable
                key={tag}
                className="px-3 py-1 bg-muted rounded-lg active:opacity-70"
              >
                <Text className="text-sm font-medium text-primary">#{tag}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Comments CTA */}
      <Pressable
        onPress={onCommentsPress}
        className="flex-row items-center justify-between p-4 bg-card rounded-xl active:opacity-80"
      >
        <View className="flex-row items-center gap-2">
          <Icon name="MessageCircle" size={18} className="text-foreground" />
          <Text className="text-sm font-bold text-foreground">Comments</Text>
          <View className="px-1.5 py-0.5 rounded-full bg-muted">
            <Text className="text-xs text-muted-foreground">{commentCount}</Text>
          </View>
        </View>
        <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
      </Pressable>
    </ScrollView>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function AudioBlogScreen() {
  const router = useRouter();
  const { blogId } = useLocalSearchParams<{ blogId: string }>();
  const id = Number(blogId);

  const [activeTab, setActiveTab] = useState<Tab>("info");
  const openComments = useCommentsSheet((s) => s.onOpen);

  const { data: blog } = useQuery(
    _trpc.blog.getBlog.queryOptions({ id })
  );

  const media = blog?.medias?.[0];
  const mediaId = media?.id;
  const telegramFileId = media?.file?.fileId;
  const duration = media?.file?.duration;

  // Auto-save play position to history
  usePlayHistorySync(mediaId);

  return (
    <View className="flex-1 bg-background">
      <SafeArea className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-10 items-center justify-center rounded-full active:bg-muted"
          >
            <Icon name="ArrowLeft" className="text-foreground" />
          </Pressable>
          <Text className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Now Playing
          </Text>
          <View className="flex-row items-center gap-1">
            <Pressable className="size-10 items-center justify-center rounded-full active:bg-muted">
              <Icon name="Share" className="text-foreground" />
            </Pressable>
            <Pressable className="size-10 items-center justify-center rounded-full active:bg-muted">
              <Icon name="MoreHorizontal" className="text-foreground" />
            </Pressable>
          </View>
        </View>

        {/* Album art */}
        <View className="px-6">
          <View className="w-full aspect-square rounded-2xl overflow-hidden bg-muted items-center justify-center shadow-2xl border border-border">
            <Icon name="AudioWaveform" size={64} className="text-muted-foreground" />
            <View className="absolute top-4 right-4">
              <View className="px-3 py-1 bg-black/40 rounded-full border border-white/10">
                <Text className="text-xs font-medium text-white">Audio Blog</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Category + listen count */}
        <View className="flex-row justify-between items-center px-6 pt-4">
          <Text className="text-xs font-semibold tracking-wide text-primary uppercase">
            {blog?.blogTags?.[0]?.tags?.title ?? "Audio"}
          </Text>
          <View className="flex-row items-center gap-1">
            <Icon name="Headphones" size={14} className="text-primary" />
            <Text className="text-xs font-medium text-primary">
              {duration ? minuteToString(duration) : "—"}
            </Text>
          </View>
        </View>

        {/* Player controls */}
        <View className="px-6 pt-2">
          <PlayerSection blogId={id} />
        </View>

        {/* Tabs */}
        <View className="flex-row mx-6 mt-4 bg-muted rounded-xl p-1">
          {(["info", "transcript"] as Tab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg items-center ${
                activeTab === tab ? "bg-card shadow-sm" : ""
              }`}
            >
              <Text
                className={`text-sm font-bold capitalize ${
                  activeTab === tab ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        <View className="flex-1 mt-3 px-6">
          {activeTab === "info" ? (
            <InfoTab blog={blog ?? {}} onCommentsPress={openComments} />
          ) : mediaId ? (
            <AudioTranscript
              mediaId={mediaId}
              telegramFileId={telegramFileId}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-sm text-muted-foreground">
                No media attached
              </Text>
            </View>
          )}
        </View>
      </SafeArea>

      {/* Comments modal */}
      <CommentsSheet blogId={id} />
    </View>
  );
}
