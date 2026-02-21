import React from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";

import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { _router } from "@/components/static-router";
import { HomeBottomNav } from "@/components/home-bottom-footer";
import { BlogCardShell } from "@/components/blog-card-shell";

// --- Types & Data ---

const CATEGORIES = ["All", "Following", "Popular", "History", "Religion"];

// --- Components ---

const Header = () => (
  <View className="flex-row items-center justify-between px-4 py-3 bg-background/95 sticky top-0 z-50 border-b border-border">
    <View className="flex-row items-center gap-3">
      <View className="bg-accent rounded-lg p-1.5 items-center justify-center">
        <Icon name="AudioWaveform" className="  text-accent-foreground" />
      </View>
      <Text className="text-xl font-bold tracking-tight text-foreground">
        Alghurobaa
      </Text>
    </View>
    <View className="flex-row items-center gap-3">
      <Pressable className="relative p-2 rounded-full active:bg-muted">
        <Icon name="Bell" className="  text-muted-foreground" />
        <View className="absolute top-2 right-2 size-2 bg-destructive rounded-full border-2 border-background" />
      </Pressable>
      {/* Avatar Rule: Initials Only */}
      <View className="size-9 rounded-full bg-muted border border-border items-center justify-center">
        <Text className="text-sm font-bold text-muted-foreground">ME</Text>
      </View>
    </View>
  </View>
);

const CategoryTabs = () => (
  <View className="py-3 pl-4 border-b border-border bg-background z-40">
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 pr-4"
    >
      {CATEGORIES.map((cat, index) => {
        const isActive = index === 0;
        return (
          <Pressable
            key={cat}
            className={`px-4 h-9 rounded-full items-center justify-center border ${
              isActive
                ? "bg-accent border-accent"
                : "bg-card border-border active:bg-muted"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                isActive
                  ? "text-accent-foreground font-bold"
                  : "text-muted-foreground"
              }`}
            >
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

// --- Card Components ---

const CardHeader = ({
  initials,
  name,
  time,
  isVerified,
}: {
  initials: string;
  name: string;
  time: string;
  isVerified?: boolean;
}) => (
  <View className="flex-row items-center justify-between mb-3">
    <View className="flex-row items-center gap-3">
      {/* Avatar Rule: Initials Only */}
      <View className="size-10 rounded-full bg-muted items-center justify-center">
        <Text className="text-sm font-bold text-foreground">{initials}</Text>
      </View>
      <View>
        <View className="flex-row items-center gap-1">
          <Text className="text-sm font-bold text-foreground">{name}</Text>
          {isVerified && <Icon name="BadgeCheck" className="text-primary" />}
        </View>
        <Text className="text-xs text-muted-foreground">{time}</Text>
      </View>
    </View>
    <Pressable className="p-1 rounded-full active:bg-muted">
      <Icon name="MoreHorizontal" className=" text-muted-foreground" />
    </Pressable>
  </View>
);

const CardFooter = ({
  likes,
  showTags = false,
}: {
  likes: number;
  showTags?: boolean;
}) => (
  <View className="flex-row items-center justify-between mt-3">
    <View className="flex-row gap-2">
      {showTags && (
        <>
          <View className="px-2.5 py-1 rounded-md bg-accent/10">
            <Text className="text-xs font-medium text-accent">#Life</Text>
          </View>
          <View className="px-2.5 py-1 rounded-md bg-accent/10">
            <Text className="text-xs font-medium text-accent">#Reflection</Text>
          </View>
        </>
      )}
      {!showTags && (
        <View className="px-2.5 py-1 rounded-md bg-accent/10">
          <Text className="text-xs font-medium text-accent">#Tech</Text>
        </View>
      )}
    </View>
    <View className="flex-row items-center gap-4">
      <Pressable className="flex-row items-center gap-1 active:opacity-70">
        <Icon name="Heart" className=" text-muted-foreground" />
        <Text className="text-xs font-medium text-muted-foreground">
          {likes}
        </Text>
      </Pressable>
      <Pressable className="active:opacity-70">
        <Icon name="Bookmark" className=" text-muted-foreground" />
      </Pressable>
      <Pressable className="active:opacity-70">
        <Icon name="Share2" className=" text-muted-foreground" />
      </Pressable>
    </View>
  </View>
);

const AudioCard = () => (
  <BlogCardShell
    blogId={"audio"}
    className="bg-card rounded-2xl p-4 border border-border"
  >
    <CardHeader
      initials="AT"
      name="Ahmed's Thoughts"
      time="2h ago"
      isVerified
    />

    <View className="mb-4">
      <Text className="text-xl font-bold text-foreground mb-2 text-right writing-direction-rtl">
        تأملات في الصباح الباكر
      </Text>
      <Text
        className="text-base text-muted-foreground text-right leading-relaxed writing-direction-rtl"
        numberOfLines={3}
      >
        الهدوء الذي يسبق شروق الشمس يحمل في طياته معاني كثيرة، إنه الوقت المثالي
        للتفكر في نعم الله وترتيب الأولويات لليوم الجديد.
      </Text>
    </View>

    <View className="bg-background rounded-xl p-3 mb-1 border border-border flex-row items-center gap-3">
      <Pressable className="size-10 rounded-full bg-accent items-center justify-center shadow-md active:opacity-90">
        <Icon name="Play" className=" text-accent-foreground ml-0.5" />
      </Pressable>

      <View className="flex-1 gap-1.5">
        <View className="flex-row items-center gap-[2px] h-6 opacity-80">
          {[3, 5, 4, 2, 3, 5, 2, 4, 3, 2, 5, 3].map((h, i) => (
            <View
              key={i}
              className={`w-1 rounded-full ${i < 4 ? "bg-accent" : "bg-muted-foreground/30"}`}
              style={{ height: h * 4 }}
            />
          ))}
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[10px] font-medium text-muted-foreground">
            00:00
          </Text>
          <Text className="text-[10px] font-medium text-muted-foreground">
            05:32
          </Text>
        </View>
      </View>
    </View>

    <CardFooter likes={124} showTags />
  </BlogCardShell>
);

const VideoCard = () => (
  <View className="bg-card rounded-2xl p-4 border border-border">
    <CardHeader initials="TT" name="Tech Talk" time="5h ago" />

    <View className="mb-4">
      <Text className="text-xl font-bold text-foreground mb-2 text-right">
        مستقبل الذكاء الاصطناعي
      </Text>
      <Text
        className="text-base text-muted-foreground text-right leading-relaxed"
        numberOfLines={3}
      >
        هل سيغير الذكاء الاصطناعي طريقة حياتنا بشكل جذري؟ في هذه الحلقة نناقش
        التحديات والفرص القادمة.
      </Text>
    </View>

    <View className="h-40 rounded-xl mb-1 relative overflow-hidden bg-black">
      <Image
        source={{
          uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuAx_cttd-ahhvC_ho6pqRPNMlaOTc8gXuqKkPuQOzDOhXXCul_OjqR7gz4ukgmgDy0VVa20OzZAlPXoVfUFyWS-f15dH3v71Yzl_nQ_cJc9-ZfqcafP-Csd7K903j99vQfTPMgpsTBC1skmpgMayiAeUgELxdDq4Q3AgziktTfeq4KiEs2qEnY6647P3TNrT7DPReMcuUJqTf9ddk8WW9xtOmkzsvPCnaeKDd-8DiJfm8aosvjfyiOu8Lgt94CX1rrizX3HF1T4Tvg",
        }}
        className="absolute inset-0 w-full h-full opacity-70"
        resizeMode="cover"
      />
      <View className="absolute inset-0 items-center justify-center">
        <Pressable className="size-12 rounded-full bg-accent/90 items-center justify-center shadow-lg active:scale-95">
          <Icon name="Play" className=" text-accent-foreground ml-1" />
        </Pressable>
      </View>
      <View className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded">
        <Text className="text-xs font-medium text-white">12:04</Text>
      </View>
    </View>

    <CardFooter likes={89} />
  </View>
);

const TextCard = () => (
  <BlogCardShell
    blogId={"text"}
    className="bg-card rounded-2xl p-4 border border-border"
  >
    <CardHeader initials="SA" name="Sarah Ali" time="1d ago" />

    <View className="mb-2">
      <Text className="text-lg text-muted-foreground text-right leading-relaxed">
        أحياناً تكون الكلمات غير كافية للتعبير عما في الداخل. الموسيقى وحدها
        قادرة على ذلك.
      </Text>
    </View>

    <View className="flex-row items-center justify-end mt-3 pt-3 border-t border-border">
      <View className="flex-row items-center gap-4">
        <Pressable className="flex-row items-center gap-1 active:opacity-70">
          <Icon name="Heart" className=" text-muted-foreground" />
          <Text className="text-xs font-medium text-muted-foreground">42</Text>
        </Pressable>
        <Pressable className="active:opacity-70">
          <Icon name="Share2" className=" text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  </BlogCardShell>
);

const MiniPlayer = () => (
  <View className="absolute bottom-20 left-4 right-4 bg-card/95 border border-border rounded-xl p-2 pr-4 flex-row items-center gap-3 shadow-lg">
    <Image
      source={{
        uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuB7kBGTRZMSZkxa_XZS_GJZvSfhJv4tCmNTMz4hrexW9Sfys_A6DS6H_V5048f5YFXfAYpDRjAFKNyREr0m5FhRc84VCX7VmroHCub2KzNPGQpSUBHA6mhOudG1onQupJEj6qL0gitVdIb_dxEpECv7bj9yALJBKtvc15exUns_qcNzUae7YM29t3OIiGpvKtwYGMa1Wv8_gKsULJwOJ9eW_5vCRXchn8CppNNUYX0B3i07mP4joW5-zRkABXExMnNi67E_Bar4isU",
      }}
      className="size-10 rounded-lg bg-muted"
    />
    <View className="flex-1">
      <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
        Episode 4: The Journey Begins
      </Text>
      <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
        Daily Reflections
      </Text>
      <View className="w-full h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
        <View className="h-full bg-accent w-[30%]" />
      </View>
    </View>
    <View className="flex-row items-center gap-3">
      <Pressable className="active:opacity-70">
        <Icon name="Play" className=" text-foreground" />
      </Pressable>
      <Pressable className="active:opacity-70">
        <Icon name="X" className=" text-muted-foreground" />
      </Pressable>
    </View>
  </View>
);

const FAB = () => (
  <Pressable className="absolute bottom-32 right-4 size-14 bg-accent rounded-full shadow-lg items-center justify-center active:scale-95 active:opacity-90 z-40">
    <Icon name="Mic" className=" text-accent-foreground" />
  </Pressable>
);

// --- Main Screen ---

export default function BlogHome2() {
  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <Header />
        <View className="flex-1 relative">
          <ScrollView
            className="flex-1"
            contentContainerClassName="pb-40"
            showsVerticalScrollIndicator={false}
          >
            <CategoryTabs />
            <View className="p-4 gap-4">
              <AudioCard />
              <VideoCard />
              <TextCard />
            </View>
          </ScrollView>

          <FAB />
          <MiniPlayer />
        </View>
      </SafeArea>

      <HomeBottomNav />
    </View>
  );
}
