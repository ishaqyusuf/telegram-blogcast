import { Icon, IconKeys } from "@/components/ui/icon";
import React from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { SafeArea } from "@/components/safe-area";

const Header = () => (
  <View className="pt-16 pb-6 px-6 z-10">
    <View className="w-full h-48 rounded-3xl bg-card/30 mb-6 items-center justify-center border border-border backdrop-blur-md">
      <Icon name="AudioWaveform" className="size-2xl text-muted-foreground" />
    </View>
    <Text className="text-3xl font-bold text-foreground mb-2 tracking-tight">
      The Future of AI
    </Text>
    <Text className="text-sm text-muted-foreground font-medium">
      Episode 42 • 45 min left
    </Text>
  </View>
);

const TimeInput = ({
  label,
  time,
  icon,
}: {
  label: string;
  time: string;
  icon: IconKeys;
}) => (
  <View className="flex-1 bg-card border border-border rounded-2xl p-3 items-center gap-1 shadow-sm">
    <Text className="text-xl font-bold text-foreground font-mono tracking-tight">
      {time}
    </Text>
    <View className="flex-row items-center gap-1.5 opacity-60">
      <Icon name={icon} className="size-sm text-muted-foreground" />
      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </Text>
    </View>
  </View>
);

const RangeSlider = () => (
  <View className="w-full py-4">
    <View className="flex-row justify-between items-center mb-4">
      <Text className="text-foreground text-sm font-medium">Seek Range</Text>
      <View className="bg-primary/10 px-2 py-0.5 rounded-full">
        <Text className="text-xs font-bold text-primary">60s selected</Text>
      </View>
    </View>

    <View className="relative h-12 w-full justify-center">
      {/* Track Background */}
      <View className="absolute h-1.5 w-full bg-muted rounded-full" />

      {/* Selected Range */}
      <View className="absolute h-1.5 bg-primary rounded-full left-[30%] w-[25%]" />

      {/* Start Knob */}
      <View className="absolute left-[30%] items-center -ml-3">
        <View className="mb-2 bg-popover px-1.5 py-0.5 rounded shadow-sm">
          <Text className="text-xs font-bold text-popover-foreground">
            12:45
          </Text>
        </View>
        <View className="w-6 h-6 rounded-full bg-background border-4 border-primary shadow-lg" />
      </View>

      {/* End Knob */}
      <View className="absolute left-[55%] items-center -ml-3">
        <View className="mb-2 bg-popover px-1.5 py-0.5 rounded shadow-sm">
          <Text className="text-xs font-bold text-popover-foreground">
            13:45
          </Text>
        </View>
        <View className="w-6 h-6 rounded-full bg-background border-4 border-primary shadow-lg" />
      </View>
    </View>

    <View className="flex-row justify-between mt-[-4px] px-1">
      <Text className="text-xs font-medium text-muted-foreground font-mono">
        00:00
      </Text>
      <Text className="text-xs font-medium text-muted-foreground font-mono">
        45:20
      </Text>
    </View>
  </View>
);

const TranscriptSheet = () => (
  <View className="flex-1 bg-card rounded-t-[2.5rem] border-t border-border shadow-2xl relative overflow-hidden">
    {/* Drag Handle */}
    <View className="w-full items-center pt-3 pb-2">
      <View className="h-1.5 w-12 rounded-full bg-muted" />
    </View>

    <ScrollView
      className="flex-1 px-6 pb-6"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="items-center py-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Text className="text-xl font-bold text-foreground tracking-tight">
            AI Transcript
          </Text>
          <Icon name="Sparkles" className="size-md text-primary" />
        </View>
        <Text className="text-sm text-muted-foreground text-center max-w-[250px]">
          Select a range to transcribe (Max 1 min).
        </Text>
      </View>

      {/* Controls */}
      <View className="gap-6 mb-8">
        <View className="flex-row items-center gap-3">
          <TimeInput label="Start" time="12:45" icon="Clock" />

          <Pressable className="size-14 rounded-full bg-primary items-center justify-center shadow-lg shadow-primary/30 z-10 active:scale-95 active:opacity-90">
            <Icon
              name="Play"
              className="size-lg text-primary-foreground ml-1"
            />
          </Pressable>

          <TimeInput label="End" time="13:45" icon="Timer" />
        </View>

        <RangeSlider />

        <Pressable className="w-full h-14 bg-primary rounded-xl flex-row items-center justify-center gap-2 shadow-lg shadow-primary/20 active:opacity-90 active:scale-[0.99]">
          <Icon name="Captions" className="size-md text-primary-foreground" />
          <Text className="text-base font-bold text-primary-foreground">
            Start Generating Transcript
          </Text>
        </Pressable>
      </View>

      <View className="h-px w-full bg-border mb-6" />

      {/* Generated Text */}
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-foreground">
            Generated Text
          </Text>
          <View className="flex-row gap-2">
            <Pressable className="flex-row items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full active:opacity-80">
              <Icon name="Copy" className="size-sm text-muted-foreground" />
              <Text className="text-xs font-medium text-muted-foreground">
                Copy
              </Text>
            </Pressable>
            <Pressable className="flex-row items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full active:opacity-80">
              <Icon name="Share2" className="size-sm text-muted-foreground" />
              <Text className="text-xs font-medium text-muted-foreground">
                Share
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="bg-muted/30 rounded-xl p-4 border border-border">
          <Text className="text-sm leading-relaxed text-muted-foreground">
            <Text className="font-bold text-primary">12:45 </Text>
            So when we talk about the architecture of these large language
            models, what's really fascinating is how the attention mechanism
            specifically allows the model to weigh different parts of the input
            sequence. It's not just reading left to right; it's understanding
            context in a multi-dimensional way. This is crucial for...
            <Text className="text-primary"> |</Text>
          </Text>
        </View>
      </View>

      {/* Bottom Spacer */}
      <View className="h-10" />
    </ScrollView>
  </View>
);

export default function TranscribeAudio() {
  return (
    <View className="flex-1 bg-background">
      {/* Background Image Layer */}
      <View className="absolute inset-0 z-0 opacity-40">
        <Image
          source={{
            uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuCHdl8Xs89WhtJ3sFGkgOGqmRpr4bWfEvxsgh0FX4ccSx9cVSKjcB1SJST0iqaQmiZBmwOxWlefC2_6knVkQTYZn9guWPAPakizQ8LmtKkjbImb8dX50dtyJ0soZT89jH8xRoiQsZfykFryN1abUjKa5G0VlrnpBQdCbSrAuTLZI2BmJlP48IbPyUKZjYSNO17gJnOUrC2m0zMoJJpYmc38NLdl7G_NDpxlbY87p8VZ9zrj1rnzdmkgMua7BGAcwTumvOHLvDNdW6Q",
          }}
          className="w-full h-full"
          resizeMode="cover"
        />
        <View className="absolute inset-0 bg-background/80" />
        <View className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent" />
      </View>

      <SafeArea>
        <Header />
        <TranscriptSheet />
      </SafeArea>
    </View>
  );
}
