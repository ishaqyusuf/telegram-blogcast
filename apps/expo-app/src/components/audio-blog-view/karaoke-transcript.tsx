import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useAudioStore } from "@/store/audio-store";
import { useColors } from "@/hooks/use-color";
import type { TranscriptSegmentData } from "@/components/audio-blog-view/transcript-segments";
import * as Haptics from "expo-haptics";

interface KaraokeTranscriptProps {
  segments: TranscriptSegmentData[];
}

export function KaraokeTranscript({ segments }: KaraokeTranscriptProps) {
  const colors = useColors();
  const positionSec = useAudioStore((s) => s.position) / 1000;
  const seek = useAudioStore((s) => s.seek);
  const flatListRef = useRef<FlatList>(null);

  const activeIdx = segments.findIndex(
    (s) => positionSec >= s.startSec && positionSec < s.endSec,
  );

  const safeActiveIdx = activeIdx !== -1 ? activeIdx : 0;

  useEffect(() => {
    if (activeIdx !== -1 && segments.length > 0) {
      flatListRef.current?.scrollToIndex({
        index: activeIdx,
        animated: true,
        viewPosition: 0.5,
      });
    }
  }, [activeIdx, segments.length]);

  if (!segments.length) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", fontWeight: "600" }}>
          No transcript available
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={segments}
      keyExtractor={(item, index) => String(item.id ?? index)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingVertical: 120, // Add padding to allow scrolling past edges
        gap: 16,
      }}
      onScrollToIndexFailed={(info) => {
        const wait = new Promise((resolve) => setTimeout(resolve, 500));
        wait.then(() => {
          flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
        });
      }}
      renderItem={({ item: seg, index }) => {
        const isActive = index === activeIdx;
        const isPast = index < activeIdx;
        const isFuture = index > activeIdx;

        return (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              seek(seg.startSec * 1000);
            }}
          >
            <Text
              style={{
                fontSize: 28,
                lineHeight: 40,
                textAlign: "right",
                writingDirection: "rtl",
                fontWeight: isActive ? "800" : "600",
                color: isActive 
                  ? "#ffffff" 
                  : "rgba(255, 255, 255, 0.4)",
              }}
            >
              {seg.words?.length ? (
                seg.words.map((word, wordIndex) => {
                  const wordActive = positionSec >= word.startSec && positionSec < word.endSec;
                  return (
                    <Text
                      key={`${word.startSec}-${wordIndex}`}
                      style={{
                        color: wordActive 
                          ? "#ffffff" 
                          : isActive 
                            ? "rgba(255,255,255,0.8)" 
                            : "rgba(255,255,255,0.4)",
                        fontWeight: wordActive ? "900" : undefined,
                      }}
                    >
                      {word.word}{" "}
                    </Text>
                  );
                })
              ) : (
                seg.text
              )}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}
