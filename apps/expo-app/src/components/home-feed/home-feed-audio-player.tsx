import { ActivityIndicator, Linking, View, Text, TouchableOpacity } from "react-native";
import { useCallback, useState } from "react";
import { ItemProps } from "./home-feed-post-card";
import { useAudioStore } from "@/store/audio-store";
import { Icon } from "../ui/icon";
import { useColors } from "@/hooks/use-color";
import { getAudioPlayability } from "@/lib/audio-playability";

export function HomeFeedAudioPlayer({
  duration,
  post,
}: {
  post: ItemProps;
  duration: string;
}) {
  const store = useAudioStore();
  const colors = useColors();
  const [playbackPending, setPlaybackPending] = useState(false);
  const externalMedia = (post as any).externalMedia;
  const isCurrent = store.blog?.id === post?.id;
  const isPlayying = isCurrent && store.isPlaying;
  const isBusy =
    playbackPending || (isCurrent && (store.isLoading || store.isDownloading));
  const audioPlayability = getAudioPlayability(post.audio as any);
  const isPlayBlocked = !externalMedia && !audioPlayability.canPlay;
  const isDisabled = isBusy || isPlayBlocked;
  const playPause = useCallback(async () => {
    if (externalMedia?.externalUrl) {
      await Linking.openURL(externalMedia.externalUrl);
      return;
    }
    if (isDisabled) return;

    if (isPlayying) {
      await store.pause();
    } else if (isCurrent) {
      await store.play();
    } else {
      setPlaybackPending(true);
      try {
        await store.loadAudio(post);
        await store.play();
      } finally {
        setPlaybackPending(false);
      }
    }
  }, [externalMedia, isDisabled, isPlayying, isCurrent, post, store]);
  // A fake waveform for display purposes
  const waveform = [4, 5, 4, 2, 3, 5, 2, 4, 3, 2, 5, 3];
  return (
    <View className="bg-muted rounded-xl p-3 mb-4 border border-border">
      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={playPause}
          disabled={isDisabled}
          className="w-10 h-10 rounded-full bg-primary items-center justify-center"
          accessibilityLabel={audioPlayability.reason ?? "Play audio"}
          style={{
            backgroundColor: isPlayBlocked ? colors.muted : colors.primary,
            opacity: isPlayBlocked ? 0.62 : 1,
          }}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Icon
              name={externalMedia ? "Share" : isPlayBlocked ? "Lock" : isPlayying ? "Pause" : "Play"}
              color={
                isPlayBlocked ? colors.mutedForeground : colors.primaryForeground
              }
            />
          )}
          {/* <Play size={24} color="white" fill="white" /> */}
        </TouchableOpacity>
        <View className="flex-1 flex-col gap-1.5">
          <View className="flex-row items-center gap-px h-6">
            {waveform.map((h, i) => (
              <View
                key={i}
                style={{
                  width: 4,
                  borderRadius: 9999,
                  backgroundColor: i < 4 ? colors.primary : colors.border,
                  height: h * 2 + 4,
                }}
              />
            ))}
            <View className="flex-1 flex-row items-center gap-px h-6">
              {Array.from({ length: 20 }).map((_, i) => (
                <View key={i} className="w-1 h-2 bg-border rounded-full" />
              ))}
            </View>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              00:00
            </Text>
            <Text className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {duration}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
