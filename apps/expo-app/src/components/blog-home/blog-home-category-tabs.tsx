import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";
import { useTranslation, type TranslationKey } from "@/lib/i18n";
import { ScrollView, Text, View } from "react-native";

export const BLOG_CATEGORIES = [
  "All",
  "Audio",
  "Text",
  "Pdf",
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
  Pdf: "pdf",
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
  const colors = useColors();

  return (
    <View
      className="bg-background py-3 pl-4"
      style={{ backgroundColor: colors.background }}
    >
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
              className="h-11 items-center justify-center rounded-full px-5"
              style={{
                backgroundColor: isActive
                  ? colors.primary
                  : colors.background === "rgb(10, 10, 10)"
                    ? "rgb(39, 39, 42)"
                  : colors.card,
                borderWidth: isActive ? 0 : 1,
                borderColor: withAlpha(colors.foreground, 0.06),
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{
                  color: isActive
                    ? colors.primaryForeground
                    : colors.foreground,
                }}
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
