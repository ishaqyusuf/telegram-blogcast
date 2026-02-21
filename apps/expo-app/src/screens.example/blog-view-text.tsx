import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import React from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";

// --- Sub-Components ---

const Header = () => (
  <View className="flex-row items-center justify-between px-4 py-3 bg-background/95 border-b border-border sticky top-0 z-50 backdrop-blur-md">
    <Pressable className="w-10 h-10 items-center justify-center rounded-full active:bg-muted">
      <Icon name="ArrowLeft" className="size-base text-muted-foreground" />
    </Pressable>
    <Text className="text-sm font-bold uppercase tracking-tight text-foreground opacity-90">
      Alghurobaa Daily
    </Text>
    <View className="flex-row items-center gap-1 -mr-2">
      <Pressable className="w-10 h-10 items-center justify-center rounded-full active:bg-muted">
        <Icon name="Share2" className="size-md text-muted-foreground" />
      </Pressable>
      <Pressable className="w-10 h-10 items-center justify-center rounded-full active:bg-muted">
        <Icon name="Bookmark" className="size-base text-muted-foreground" />
      </Pressable>
    </View>
  </View>
);

const HeroImage = () => (
  <View className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-sm bg-muted mb-6">
    <Image
      source={{
        uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuAXHu65OfNiDbfDo-GLyamnsobd-zEGjK8x16L5HQwyrPXT4iP1VgFyg7r6DcObQSjROzD4dP5rTEwN0K6lKrCT4BfAMB2tjyCJZ3EpMkny2RNrSTn7iUzsXvC0ObX6HD2oy79tz02vxAwMPIQJSXUBRZGdvizh9VsTxJpNwyV8KMnjDkiEke-3_SPLLflwDXU3p8D6gw2BPTYGIV3_OoEWR9wYXCerFlT_abjr1929v6zhasa_d_ybuXjilIiMu_3UK6hYgNCuzDo",
      }}
      className="w-full h-full"
      resizeMode="cover"
    />
    <View className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
  </View>
);

const ArticleHeader = () => (
  <View className="flex-col gap-3 mb-6">
    <View className="flex-row items-center gap-3">
      <View className="bg-accent/10 px-2 py-0.5 rounded-md">
        <Text className="text-xs font-medium text-accent">Blog</Text>
      </View>
      <Text className="text-xs font-medium text-muted-foreground">
        Oct 24, 2023
      </Text>
      <View className="w-1 h-1 rounded-full bg-muted-foreground" />
      <Text className="text-xs font-medium text-muted-foreground">
        5 min read
      </Text>
    </View>
    <Text className="text-3xl font-bold text-foreground text-right writing-direction-rtl leading-snug">
      تأملات في الغربة والبحث عن الذات: رحلة في عالم متغير
    </Text>
    <View className="h-px w-full bg-border mt-2" />
  </View>
);

const ArticleBody = () => (
  <View className="flex-col gap-6 mb-6">
    <Text className="text-lg text-foreground text-right writing-direction-rtl leading-relaxed">
      يعتبر مفهوم الغربة من أكثر المفاهيم تعقيداً في النفس البشرية. إنه ليس مجرد
      ابتعاد جغرافي عن الوطن، بل هو حالة شعورية عميقة تتداخل فيها الذكريات مع
      الواقع الجديد. في هذه التدوينة، نحاول استكشاف أبعاد الهوية وكيف تتشكل من
      جديد في ظل المتغيرات المستمرة التي نعيشها يومياً بعيداً عن الجذور.
    </Text>

    {/* Pull Quote */}
    <View className="bg-card border-r-4 border-accent rounded-l-xl p-6 my-2 shadow-sm">
      <Text className="text-xl font-bold text-accent italic text-right writing-direction-rtl leading-relaxed">
        "الغربة ليست مكاناً نعيش فيه، بل هي حالة تعيش فينا، تعيد صياغة أحلامنا
        وتصوراتنا عن الانتماء."
      </Text>
    </View>

    <Text className="text-lg text-foreground text-right writing-direction-rtl leading-relaxed">
      حين نبتعد عن جذورنا، نجد أنفسنا أمام مرآة تعكس صوراً متعددة لذواتنا. هل
      نحن من كنا عليه هناك؟ أم نحن نتاج هذا المكان الجديد؟ الإجابة تكمن في
      المسافة بين السؤالين، حيث تولد هوية ثالثة تجمع بين أصالة الماضي ومرونة
      الحاضر. هذا المزيج الفريد هو ما يميز تجربة المغترب ويمنحه نظرة ثاقبة
      للحياة لا يمتلكها غيره.
    </Text>

    <Text className="text-lg text-foreground text-right writing-direction-rtl leading-relaxed">
      التحدي الأكبر يكمن في التصالح مع هذا الاغتراب، وتحويله من عبء نفسي إلى
      طاقة إبداعية خلاقة. إن الكتابة، والفن، وحتى الاستماع إلى الأصوات المألوفة،
      كلها وسائل تعيد ترميم الروح وتمنحنا القدرة على الاستمرار في هذا العالم
      المتسارع.
    </Text>
  </View>
);

const Tags = () => (
  <View className="flex-row flex-wrap justify-end gap-2 mb-8">
    {["#اغتراب", "#حياة", "#خواطر", "#فلسفة"].map((tag) => (
      <Pressable
        key={tag}
        className="px-4 py-1.5 rounded-full bg-muted/50 border border-border active:border-accent"
      >
        <Text className="text-sm font-medium text-muted-foreground">{tag}</Text>
      </Pressable>
    ))}
  </View>
);

const CommentButton = () => (
  <Pressable className="w-full bg-card border border-border py-4 rounded-2xl flex-row items-center justify-center gap-2 active:bg-muted mb-8 shadow-sm">
    <Icon name="MessageSquare" className="size-md text-accent" />
    <Text className="text-base font-semibold text-foreground">
      View Comments (12)
    </Text>
  </Pressable>
);

const FloatingPlayer = () => (
  <View className="absolute bottom-20 left-4 right-4 z-40">
    <View className="bg-popover/95 border border-border/50 p-3 rounded-2xl shadow-lg flex-row items-center gap-3 backdrop-blur-xl">
      <Image
        source={{
          uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuCRts2U9C0pqwcbfZ3Xtx-5Rlqe4nJfLOrlgCWZSaGcMmroAcDRbJh320DS0uXlzyTJKN8VtlKaWG5sYmNLSPdbuOYl4L3mME4uiieR_O8CJwsfgqbKLDRrJzLx_yQM0Lm9FkkJ5fD91uzQGsxhuQUjib34a9YcKHMlSTIY12E4vkrQ2U0_jsvGA3Bvs4Pb6ZMl3Nx2fcagC8jbxFCbDgEqKAdGcGYKSOx44UkcpNctC5q30su8pVdR-sJEDmeOZOpi_pLi8LInT5A",
        }}
        className="w-12 h-12 rounded-lg bg-muted"
        resizeMode="cover"
      />

      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
          Reflections on Alienation
        </Text>
        <View className="flex-row items-center gap-2">
          <View className="bg-accent/20 px-1.5 rounded">
            <Text className="text-[10px] font-bold text-accent">BLOG</Text>
          </View>
          <Text className="text-[11px] text-muted-foreground font-mono">
            04:20 / 12:45
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-1">
        <Pressable className="w-9 h-9 items-center justify-center active:opacity-60">
          <Icon name="SkipBack" className=" text-muted-foreground" />
        </Pressable>
        <Pressable className="w-10 h-10 items-center justify-center bg-foreground rounded-full shadow-sm active:scale-95">
          <Icon name="Play" className="text-background ml-0.5" />
        </Pressable>
        <Pressable className="w-9 h-9 items-center justify-center active:opacity-60">
          <Icon name="SkipForward" className=" text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  </View>
);

const BottomNav = () => (
  <View className="absolute bottom-0 left-0 w-full bg-background border-t border-border pb-6 pt-2 z-50">
    <View className="flex-row justify-around items-end h-14 relative px-2">
      <Pressable className="flex-col items-center gap-1 p-2 w-16">
        <Icon name="Home" className=" text-accent" />
        <Text className="text-[10px] font-bold text-accent">Home</Text>
      </Pressable>

      <Pressable className="flex-col items-center gap-1 p-2 w-16">
        <Icon name="Search" className=" text-muted-foreground" />
        <Text className="text-[10px] font-medium text-muted-foreground">
          Search
        </Text>
      </Pressable>

      {/* FAB Spacer & Button */}
      <View className="w-16" />
      <View className="absolute -top-7 left-1/2 -ml-8">
        <Pressable className="w-16 h-16 bg-accent rounded-full shadow-lg items-center justify-center border-[6px] border-background active:scale-95">
          <Icon name="Plus" className="size-lg text-accent-foreground" />
        </Pressable>
      </View>

      <Pressable className="flex-col items-center gap-1 p-2 w-16">
        <Icon name="History" className=" text-muted-foreground" />
        <Text className="text-[10px] font-medium text-muted-foreground">
          History
        </Text>
      </Pressable>

      <Pressable className="flex-col items-center gap-1 p-2 w-16">
        <Icon name="User" className=" text-muted-foreground" />
        <Text className="text-[10px] font-medium text-muted-foreground">
          Profile
        </Text>
      </Pressable>
    </View>
  </View>
);

export default function BlogViewText() {
  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <Header />
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pt-4 pb-48"
          showsVerticalScrollIndicator={false}
        >
          <HeroImage />
          <ArticleHeader />
          <ArticleBody />
          <Tags />
          <CommentButton />
        </ScrollView>
        <FloatingPlayer />
      </SafeArea>
      <BottomNav />
    </View>
  );
}
