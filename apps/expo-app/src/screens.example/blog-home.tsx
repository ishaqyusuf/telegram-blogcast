import { BlogCardShell } from "@/components/blog-card-shell";
import { HomeBottomNav } from "@/components/home-bottom-footer";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import React from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";

interface BlogHomeProps {
  onSearchPress: () => void;
}

// --- Sub-Components ---

const Header = ({ onSearchPress }: { onSearchPress: () => void }) => (
  <View className="flex-row items-center justify-between px-4 py-3 bg-background/95 sticky top-0 z-50 border-b border-border">
    <View className="flex-row items-center gap-3">
      <Text className="text-xl font-bold tracking-tight text-foreground">
        Alghurobaa
      </Text>
    </View>
    <Pressable
      onPress={onSearchPress}
      className="p-2 rounded-full active:bg-muted"
    >
      <Icon name="Search" className="  text-muted-foreground" />
    </Pressable>
  </View>
);

const FilterChips = () => (
  <View className="w-full py-4">
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-4 gap-3"
    >
      <Pressable className="h-9 px-5 rounded-full bg-accent items-center justify-center shadow-sm active:opacity-90">
        <Text className="text-sm font-medium text-accent-foreground">All</Text>
      </Pressable>

      <Pressable className="h-9 px-5 rounded-full bg-card border border-border items-center justify-center active:bg-muted">
        <Text className="text-sm font-medium text-muted-foreground">Audio</Text>
      </Pressable>

      <Pressable className="h-9 px-5 rounded-full bg-card border border-border items-center justify-center active:bg-muted">
        <Text className="text-sm font-medium text-muted-foreground">
          Articles
        </Text>
      </Pressable>

      <Pressable className="h-9 px-5 rounded-full bg-card border border-border items-center justify-center active:bg-muted">
        <Text className="text-sm font-medium text-muted-foreground">
          Visuals
        </Text>
      </Pressable>
    </ScrollView>
  </View>
);

const CardHeader = ({
  letter,
  title,
  time,
}: {
  letter: string;
  title: string;
  time: string;
}) => (
  <View className="flex-row items-center justify-between mb-3">
    <View className="flex-row items-center gap-2">
      <View className="size-6 rounded-full items-center justify-center bg-muted">
        <Text className="text-[10px] text-foreground font-bold">{letter}</Text>
      </View>
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </Text>
    </View>
    <Text className="text-xs text-muted-foreground">{time}</Text>
  </View>
);

const CardActions = ({ tags }: { tags: string[] }) => (
  <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border">
    <View className="flex-row items-center gap-2">
      {tags.map((tag, i) => (
        <View key={i} className="px-2 py-1 rounded-md bg-muted">
          <Text className="text-[11px] font-medium text-muted-foreground">
            {tag}
          </Text>
        </View>
      ))}
    </View>
    <View className="flex-row items-center gap-4">
      <Pressable>
        <Icon name="Bookmark" className="  text-muted-foreground" />
      </Pressable>
      <Pressable>
        <Icon name="Heart" className="  text-muted-foreground" />
      </Pressable>
    </View>
  </View>
);

// --- Cards ---

const AudioCard = () => (
  <BlogCardShell
    blogId={"audio"}
    className="bg-card rounded-2xl p-5 mb-4 active:scale-[0.99]"
  >
    <CardHeader letter="M" title="Mindfulness" time="2h ago" />

    <View className="mb-4">
      <Text className="text-lg font-bold text-foreground leading-tight mb-2">
        Reflections on Silence
      </Text>
      <Text
        numberOfLines={3}
        className="text-sm text-muted-foreground leading-relaxed"
      >
        In a world that never stops talking, finding a moment of silence is a
        revolutionary act. It allows us to reconnect with our inner thoughts.
      </Text>
    </View>

    <View className="flex-row items-center gap-3 p-3 rounded-xl bg-muted/30 mb-4 border border-border">
      <Pressable className="size-10 rounded-full bg-accent items-center justify-center shadow-md active:opacity-80">
        <Icon name="Play" className="  text-accent-foreground ml-0.5" />
      </Pressable>

      <View className="flex-1 justify-center gap-1">
        <View className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <View className="h-full w-1/3 bg-accent rounded-full" />
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[10px] text-muted-foreground font-medium">
            04:12
          </Text>
          <Text className="text-[10px] text-muted-foreground font-medium">
            12:00
          </Text>
        </View>
      </View>
    </View>

    <CardActions tags={["#Podcast", "#Zen"]} />
  </BlogCardShell>
);

const ArticleCard = () => (
  <BlogCardShell
    blogId={"text"}
    className="bg-card rounded-2xl p-5 mb-4 active:scale-[0.99]"
  >
    <CardHeader letter="F" title="Future of Work" time="5h ago" />

    <View className="mb-2">
      <Text className="text-lg font-bold text-foreground leading-tight mb-2">
        The Future of Digital Nomadism
      </Text>
      <Text
        numberOfLines={3}
        className="text-sm text-muted-foreground leading-relaxed"
      >
        Exploring how remote work is reshaping our cities and our social
        contracts. Are we ready for a borderless workforce?
      </Text>
    </View>

    <View className="flex-row items-center justify-between mt-4 pt-2 border-t border-border">
      <View className="flex-row items-center gap-3">
        <View className="flex-row items-center gap-1">
          <Icon name="FileText" className=" text-muted-foreground" />
          <Text className="text-xs text-muted-foreground">5 min read</Text>
        </View>
        <View className="px-2 py-1 rounded-md bg-muted">
          <Text className="text-[11px] font-medium text-muted-foreground">
            #Remote
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-4">
        <Pressable>
          <Icon name="Bookmark" className=" text-muted-foreground" />
        </Pressable>
        <Pressable>
          <Icon name="Heart" className=" text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  </BlogCardShell>
);

const VisualCard = () => (
  <BlogCardShell
    blogId={"image"}
    className="bg-card rounded-2xl overflow-hidden mb-4 active:scale-[0.99]"
  >
    <View className="w-full h-48 bg-muted relative">
      <Image
        source={{
          uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuBaHhS_YUGfVhS2aIfF1Xy2NxlQ5TAwo7_LbHaUqSkje8xbT5wSB8fn2-3rrStHTJwTwH4E7NIWWkZ6A89Eef620vJsRY2mmaE_i6USQqxYjose1LjIi31Zh41DmFXSMzUwu3W3-X-Z_ILEwzLG47oDBAcgrBtyg5VLSeQuKtphDcg-_tEB0LTOj9uX8Kh0Gi5CXK7cRN1kRQM-NGjisomicG7yR2ahwXNRdGwbCmoar9gafVJDDX2pa_4SUamhEvJswEImNXQdIm0",
        }}
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
      />
      <View className="absolute top-3 right-3 bg-black/40 px-2 py-1 rounded-lg flex-row items-center gap-1">
        <Icon name="Image" className=" text-white" />
        <Text className="text-[10px] font-medium text-white">4</Text>
      </View>
    </View>

    <View className="p-5">
      <CardHeader letter="P" title="Photography" time="1d ago" />

      <Text className="text-lg font-bold text-foreground leading-tight mb-2">
        Visual Diary: Kyoto
      </Text>
      <Text className="text-sm text-muted-foreground leading-relaxed mb-4">
        Capturing the vivid colors of autumn in {"Japan's"} ancient capital. A
        journey through temples and tea houses.
      </Text>

      <CardActions tags={["#Travel", "#Japan"]} />
    </View>
  </BlogCardShell>
);

const DraftCard = () => (
  <View className="relative mb-24 rounded-2xl overflow-hidden">
    <View className="absolute inset-0 bg-destructive flex-row items-center justify-end pr-6">
      <View className="items-center justify-center gap-1">
        <Icon name="Trash2" className=" text-destructive-foreground" />
        <Text className="text-[10px] font-bold text-destructive-foreground uppercase">
          Delete
        </Text>
      </View>
    </View>

    <View
      className="bg-card p-5 rounded-2xl border-r border-border"
      style={{ transform: [{ translateX: -96 }] }}
    >
      <CardHeader letter="D" title="Drafts" time="Just now" />

      <Text className="text-lg font-bold text-foreground leading-tight mb-2">
        Unpublished Thoughts
      </Text>
      <Text className="text-sm text-muted-foreground leading-relaxed">
        This is a draft post. Swipe fully to delete it or tap to edit.
      </Text>
    </View>
  </View>
);

export default function BlogHome() {
  // return <Redirect href={'/home'}
  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <Header />
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <FilterChips />

          <View className="px-4 gap-2">
            <AudioCard />
            <ArticleCard />
            <VisualCard />
            <DraftCard />
          </View>
        </ScrollView>
      </SafeArea>
      <HomeBottomNav />
    </View>
  );
}
