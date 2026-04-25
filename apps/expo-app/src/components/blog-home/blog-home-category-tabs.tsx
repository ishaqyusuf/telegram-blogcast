import { Pressable } from "@/components/ui/pressable";
import { useTranslation, type TranslationKey } from "@/lib/i18n";
import { ScrollView, Text, View } from "react-native";

export const BLOG_CATEGORIES = [
  "All",
  "Audio",
  "Text",
  "Picture",
  "Video",
  "Likes",
  "Saved",
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

const CATEGORY_KEYS: Record<BlogCategory, TranslationKey> = {
  All: "all",
  Audio: "audio",
  Text: "text",
  Picture: "picture",
  Video: "video",
  Likes: "likes",
  Saved: "saved",
};

interface Props {
  selected: BlogCategory;
  onSelect: (value: BlogCategory) => void;
}

export function BlogHomeCategoryTabs({ selected, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <View className="bg-background py-3 pl-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pr-4"
      >
        {BLOG_CATEGORIES.map((cat) => {
          const isActive = selected === cat;
          return (
            <Pressable
              key={cat}
              onPress={() => onSelect(cat)}
              className={`px-4 h-9 rounded-full items-center justify-center border ${
                isActive ? "bg-accent border-accent" : "bg-card border-border"
              }`}
            >
              <Text
                className={`text-sm ${
                  isActive
                    ? "font-bold text-primary-foreground"
                    : "text-muted-foreground font-medium"
                }`}
              >
                {t(CATEGORY_KEYS[cat])}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
