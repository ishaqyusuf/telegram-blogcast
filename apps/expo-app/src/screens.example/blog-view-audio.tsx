import { PressableLink } from "@/components/pressable-link";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";

// --- Sub-Components ---

const Header = () => (
  <View className="flex-row items-center justify-between px-4 py-3 bg-background/90 sticky top-0 z-50">
    <Pressable className="size-10 items-center justify-center rounded-full active:bg-muted">
      <Icon name="ArrowLeft" className="text-foreground" />
    </Pressable>
    <Text className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
      Now Playing
    </Text>
    <View className="flex-row items-center gap-2">
      <Pressable className="size-10 items-center justify-center rounded-full active:bg-muted">
        <Icon name="Share" className="text-foreground" />
      </Pressable>
      <Pressable className="size-10 items-center justify-center rounded-full active:bg-muted">
        <Icon name="MoreHorizontal" className="text-foreground" />
      </Pressable>
    </View>
  </View>
);

const MainVisual = () => (
  <View className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-sm border border-border group bg-card">
    <Image
      source={{
        uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuDUq6DupIv0t0IAudFzZOas9W0fIiJOFXjX8dTHF5VNbyMx1FkQ6_4lvZn1tbz30ZGwJk34Y9EL9pMtaSWH4iPSGwjhaj3JV0sdTfzFZVvw1npvaaMCz5Y1Dyt76xGPW-u3ThhfSMWPH8F_ZrIaXQxu8R7HlFa4jiBnyS22cucufeSyc25dOXjQTe3NEsCVm69tOtg9_k-MMSL0ncOnqRsSNB91uBrkNyv5Imq4__n6RZH78QSPzmxDY8pxr4ImbB5N6BBrU6lGI6k",
      }}
      className="w-full h-full opacity-90"
      resizeMode="cover"
    />

    <View className="absolute inset-0 bg-black/20" />

    <View className="absolute top-4 right-4 z-20">
      <View className="px-3 py-1 bg-black/40 rounded-full border border-white/10">
        <Text className="text-xs font-medium text-white">Audio Blog</Text>
      </View>
    </View>

    <View className="absolute top-4 left-4 z-20">
      <Pressable className="flex-row items-center gap-1.5 px-3 py-1 bg-accent rounded-full shadow-sm active:opacity-90">
        <Icon name="Edit3" className="size-4 text-accent-foreground" />
        <Text className="text-xs font-bold text-accent-foreground">
          Edit Blog
        </Text>
      </Pressable>
    </View>
  </View>
);

const PlayerControls = () => (
  <View className="flex-col gap-6 mt-6">
    {/* Meta & Scrubber */}
    <View className="flex-col gap-2">
      <View className="flex-row justify-between items-center">
        <Text className="text-xs font-semibold tracking-wide text-accent uppercase">
          Religion & Spirituality
        </Text>
        <View className="flex-row items-center gap-1 opacity-80">
          <Icon name="Headphones" className="size-4 text-accent" />
          <Text className="text-xs font-medium text-accent">1.2k</Text>
        </View>
      </View>

      <View className="py-2">
        <View className="relative h-10 justify-center">
          {/* Track Line */}
          <View className="absolute w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <View className="h-full w-[35%] bg-accent rounded-full" />
          </View>

          {/* Markers */}
          <View className="absolute left-[20%] w-1.5 h-1.5 bg-foreground rounded-full z-10" />
          <View className="absolute left-[65%] w-1.5 h-1.5 bg-accent/40 rounded-full z-0" />

          {/* Thumb */}
          <View className="absolute left-[35%] w-4 h-4 bg-background rounded-full border-2 border-accent z-20 shadow-sm" />

          {/* Waveform Visualization (Static Mock) */}
          <View className="absolute inset-0 flex-row items-center justify-between opacity-20 pointer-events-none px-1">
            {[3, 5, 8, 4, 6, 3, 2, 5, 4, 3, 6, 4, 3].map((h, i) => (
              <View
                key={i}
                className="w-1 bg-foreground rounded-full"
                style={{ height: h * 3 }}
              />
            ))}
          </View>
        </View>

        <View className="flex-row justify-between mt-[-8px]">
          <Text className="text-xs font-medium text-muted-foreground">
            04:22
          </Text>
          <Text className="text-xs font-medium text-muted-foreground">
            -10:38
          </Text>
        </View>
      </View>
    </View>

    {/* Buttons */}
    <View className="flex-row items-center justify-between">
      <Pressable className="px-2 py-1 rounded-md bg-muted active:opacity-70">
        <Text className="text-xs font-bold text-muted-foreground">1.0x</Text>
      </Pressable>

      <View className="flex-row items-center gap-6">
        <Pressable className="p-2 active:opacity-50">
          <Icon name="RotateCcw" className="size-20 text-foreground" />
        </Pressable>
        <Pressable className="size-16 bg-accent rounded-full items-center justify-center shadow-lg active:scale-95 active:opacity-90">
          <Icon name="Play" className="size-24 text-accent-foreground ml-1" />
        </Pressable>
        <Pressable className="p-2 active:opacity-50">
          <Icon name="RotateCw" className="size-20 text-foreground" />
        </Pressable>
      </View>

      <Pressable className="p-2 active:opacity-50">
        <Icon name="Volume2" className="size-5 text-muted-foreground" />
      </Pressable>
    </View>
  </View>
);

const AuthorInfo = () => (
  <View className="flex-col gap-4 py-6 border-b border-border">
    {/* Author Row */}
    <View className="flex-row items-center gap-3 border-b border-border pb-4">
      {/* Avatar Rule: Initials Only */}
      <View className="size-10 rounded-full bg-muted items-center justify-center">
        <Text className="text-sm font-bold text-muted-foreground">AA</Text>
      </View>
      <View className="flex-col">
        <Text className="text-xs text-muted-foreground font-medium">
          Author
        </Text>
        <Text className="text-sm font-bold text-foreground">
          Ahmed Al-Gharib
        </Text>
      </View>
      <Pressable className="ml-auto px-4 py-1.5 rounded-full border border-border active:bg-muted">
        <Text className="text-xs font-bold text-muted-foreground">Follow</Text>
      </Pressable>
    </View>

    {/* Text Content (RTL) */}
    <View className="flex-col gap-3">
      <Text className="text-2xl font-bold text-foreground text-right writing-direction-rtl">
        تأملات في الغربة والبحث عن الذات
      </Text>
      <Text className="text-xs text-muted-foreground text-right writing-direction-rtl">
        نُشر في ١٢ أكتوبر ٢٠٢٣
      </Text>
      <Text className="text-base text-muted-foreground leading-relaxed text-right writing-direction-rtl">
        في هذه الحلقة الصوتية، نتحدث بعمق عن مفهوم الغربة ليس فقط كابتعاد عن
        الوطن، بل كحالة شعورية داخلية.
      </Text>

      {/* Tags */}
      <View className="flex-row flex-wrap gap-2 justify-end mt-2">
        {["#تطوير_الذات", "#خواطر_مغترب", "#إسلاميات"].map((tag) => (
          <Pressable
            key={tag}
            className="px-3 py-1 bg-muted rounded-lg active:opacity-70"
          >
            <Text className="text-sm font-medium text-accent">{tag}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  </View>
);

const CommentItem = ({
  initials,
  name,
  time,
  text,
  timestamp,
  variant = "default",
}: {
  initials: string;
  name: string;
  time: string;
  text: string;
  timestamp?: string;
  variant?: "highlight" | "default";
}) => (
  <View
    className={`w-full p-4 rounded-xl mb-4 border ${
      variant === "highlight"
        ? "bg-accent/10 border-accent/40 shadow-sm"
        : "bg-card border-border shadow-sm"
    }`}
  >
    <View className="flex-row justify-between items-start mb-3">
      <View className="flex-row items-center gap-3">
        {/* Avatar Rule: Initials Only */}
        <View
          className={`size-9 rounded-full items-center justify-center ${
            variant === "highlight" ? "bg-accent" : "bg-muted"
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              variant === "highlight"
                ? "text-accent-foreground"
                : "text-muted-foreground"
            }`}
          >
            {initials}
          </Text>
        </View>
        <View>
          <Text className="text-xs font-bold text-foreground">{name}</Text>
          <Text className="text-[10px] text-muted-foreground font-medium">
            {time}
          </Text>
        </View>
      </View>

      {timestamp && (
        <Pressable
          className={`flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-sm active:scale-95 ${
            variant === "highlight" ? "bg-accent" : "bg-muted"
          }`}
        >
          <Icon
            name={variant === "highlight" ? "BarChart2" : "PlayCircle"}
            className={`size-3.5 ${variant === "highlight" ? "text-accent-foreground" : "text-primary"}`}
          />
          <Text
            className={`text-[11px] font-medium ${
              variant === "highlight"
                ? "text-accent-foreground"
                : "text-primary"
            }`}
          >
            {timestamp}
          </Text>
        </Pressable>
      )}
    </View>

    <Text className="text-sm text-foreground leading-relaxed mb-4 text-right writing-direction-rtl">
      {text}
    </Text>

    <View
      className={`flex-row items-center gap-4 pt-3 border-t ${
        variant === "highlight" ? "border-accent/20" : "border-border"
      }`}
    >
      <Pressable className="flex-row items-center gap-1.5 active:opacity-60">
        <Icon name="Edit2" className="size-4 text-muted-foreground" />
        <Text className="text-xs font-semibold text-muted-foreground">
          Edit
        </Text>
      </Pressable>
      <Pressable className="flex-row items-center gap-1.5 active:opacity-60">
        <Icon name="Trash2" className="size-4 text-muted-foreground" />
        <Text className="text-xs font-semibold text-muted-foreground">
          Delete
        </Text>
      </Pressable>
    </View>
  </View>
);

const CommentsSection = () => {
  const { blogId } = useLocalSearchParams();
  return (
    <View className="flex-col gap-4 pb-8">
      <View className="flex-row items-center justify-between mt-2">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-bold text-foreground uppercase tracking-wider">
            Comments
          </Text>
          <View className="px-1.5 py-0.5 rounded-full bg-muted">
            <Text className="text-xs font-normal text-muted-foreground">
              24
            </Text>
          </View>
        </View>
        <PressableLink href={`/blog-view-2/${blogId}/transcribe-audio`}>
          <Text className="text-xs font-medium text-muted-foreground">
            Add Comment
          </Text>
        </PressableLink>
      </View>

      <View>
        <CommentItem
          initials="YK"
          name="Yousef Kamal"
          time="Just now"
          text="هذه النقطة بالذات لامست قلبي. الحديث عن السكينة الداخلية في هذا التوقيت دقيق جداً وعميق. شكراً لكم على هذا الطرح الرائع."
          timestamp="04:20 - 05:00"
          variant="highlight"
        />
        <CommentItem
          initials="SM"
          name="Sarah M."
          time="2 hours ago"
          text="هل يمكن توضيح المصدر المذكور في بداية الحلقة؟ الصوت كان غير واضح قليلاً."
          timestamp="01:30"
        />
        <CommentItem
          initials="OK"
          name="Omar K."
          time="1 day ago"
          text="حلقة مميزة كالعادة، استمروا في هذا الإبداع."
        />
      </View>
    </View>
  );
};

const BottomNav = () => (
  <View className="absolute bottom-0 left-0 w-full bg-background border-t border-border px-2 pb-6 pt-2 z-50 shadow-sm">
    <View className="flex-row justify-between items-end w-full max-w-lg mx-auto relative">
      <Pressable className="flex-col items-center gap-1 p-2 w-16 active:opacity-70">
        <Icon name="Home" className="size-20 text-muted-foreground" />
        <Text className="text-[10px] font-medium text-muted-foreground">
          Home
        </Text>
      </Pressable>

      <Pressable className="flex-col items-center gap-1 p-2 w-16 active:opacity-70">
        <Icon name="Search" className="size-20 text-muted-foreground" />
        <Text className="text-[10px] font-medium text-muted-foreground">
          Search
        </Text>
      </Pressable>

      <View className="relative -top-6">
        <Pressable className="size-20 rounded-full bg-accent items-center justify-center shadow-lg active:scale-95 active:opacity-90 border-4 border-background">
          <Icon name="Plus" className="size-24 text-accent-foreground" />
        </Pressable>
      </View>

      <Pressable className="flex-col items-center gap-1 p-2 w-16 active:opacity-70">
        <Icon name="History" className="size-20 text-muted-foreground" />
        <Text className="text-[10px] font-medium text-muted-foreground">
          History
        </Text>
      </Pressable>

      <Pressable className="flex-col items-center gap-1 p-2 w-16 active:opacity-70">
        <Icon name="User" className="size-20 text-muted-foreground" />
        <Text className="text-[10px] font-medium text-muted-foreground">
          Profile
        </Text>
      </Pressable>
    </View>
  </View>
);

export default function BlogViewAudio() {
  return (
    <View className="flex-1 bg-background">
      <SafeArea className="flex-1">
        <Header />
        <View className="flex-1 relative">
          <ScrollView
            className="flex-1 px-6 pt-4"
            contentContainerClassName="pb-32 gap-6"
            showsVerticalScrollIndicator={false}
          >
            <MainVisual />
            <PlayerControls />
            <AuthorInfo />
            <CommentsSection />
          </ScrollView>
        </View>
      </SafeArea>
      <BottomNav />
    </View>
  );
}
