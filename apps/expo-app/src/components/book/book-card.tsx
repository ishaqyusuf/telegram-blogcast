import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { Image, Text, View } from "react-native";

const BOOK_COLORS = ["#1e40af", "#0f766e", "#b45309", "#4f46e5", "#be123c", "#0369a1", "#7c3aed", "#334155"];

export function getBookInitials(nameAr?: string | null, nameEn?: string | null) {
  const name = nameAr ?? nameEn ?? "B";
  return name.slice(0, 2);
}

export function BookCard({
  book,
  onPress,
  onDetails,
  index = 0,
}: {
  book: {
    id: number;
    nameAr?: string | null;
    nameEn?: string | null;
    coverUrl?: string | null;
    coverColor?: string | null;
    authors?: { name: string; nameAr?: string | null }[];
    shelf?: { name: string; nameAr?: string | null } | null;
  };
  onPress: () => void;
  onDetails?: () => void;
  index?: number;
}) {
  const colors = useColors();
  const bgColor = book.coverColor ?? BOOK_COLORS[index % BOOK_COLORS.length];
  const authorName = book.authors?.[0]?.nameAr ?? book.authors?.[0]?.name;
  const shelfName = book.shelf?.nameAr ?? book.shelf?.name;
  const coverLabel = (book.nameAr ?? book.nameEn ?? "Book").split(/\s+/).slice(0, 4).join(" ");

  return (
    <Pressable onPress={onPress} className="flex-1 active:opacity-80">
      {/* Cover */}
      <View
        style={{
          width: "100%",
          aspectRatio: 0.7,
          borderRadius: 10,
          marginBottom: 8,
          overflow: "hidden",
          backgroundColor: bgColor,
        }}
      >
        {book.coverUrl ? (
          <Image
            source={{ uri: book.coverUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 14,
              gap: 8,
            }}
          >
            <Text style={{ color: "#D9C27E", fontSize: 23 }}>۞</Text>
            <Text
              numberOfLines={3}
              style={{
                fontSize: 17,
                lineHeight: 25,
                fontWeight: "bold",
                fontFamily: "serif",
                color: "#F7E9C6",
                textAlign: "center",
                writingDirection: "rtl",
              }}
            >
              {coverLabel}
            </Text>
          </View>
        )}
        {shelfName && (
          <View
            style={{
              position: "absolute",
              bottom: 6,
              left: 6,
              backgroundColor: "rgba(0,0,0,0.6)",
              borderRadius: 4,
              paddingHorizontal: 5,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 9, color: "white" }}>{shelfName}</Text>
          </View>
        )}
        {onDetails && (
          <Pressable
            accessibilityLabel="Book details"
            accessibilityRole="button"
            onPress={onDetails}
            className="absolute right-2 top-2 size-8 items-center justify-center rounded-full bg-black/60"
          >
            <Icon name="MoreHorizontal" size={18} className="text-white" />
          </Pressable>
        )}
      </View>

      {/* Title */}
      <Text
        className="text-right text-[13px] font-bold"
        style={{ writingDirection: "rtl", color: colors.foreground }}
        numberOfLines={2}
      >
        {book.nameAr ?? book.nameEn}
      </Text>

      {/* Author */}
      {authorName && (
        <Text
          className="mt-0.5 text-right text-[11px]"
          style={{ writingDirection: "rtl", color: colors.mutedForeground }}
          numberOfLines={1}
        >
          {authorName}
        </Text>
      )}
    </Pressable>
  );
}
