import { Pressable } from "@/components/ui/pressable";
import { Image, Text, View } from "react-native";
import { useBookOfflineStore } from "@/store/book-offline-store";

const BOOK_COLORS = ["#4c1d95", "#7c2d12", "#14532d", "#1e3a5f", "#3b0764", "#064e3b", "#831843", "#1e1b4b"];

export function getBookInitials(nameAr?: string | null, nameEn?: string | null) {
  const name = nameAr ?? nameEn ?? "ك";
  return name.slice(0, 2);
}

export function BookCard({
  book,
  onPress,
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
  index?: number;
}) {
  const isDownloaded = useBookOfflineStore((s) => s.isDownloaded(book.id));
  const bgColor = book.coverColor ?? BOOK_COLORS[index % BOOK_COLORS.length];
  const authorName = book.authors?.[0]?.nameAr ?? book.authors?.[0]?.name;
  const shelfName = book.shelf?.nameAr ?? book.shelf?.name;

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
              padding: 8,
            }}
          >
            <Text
              style={{
                fontSize: 28,
                fontWeight: "bold",
                color: "white",
                textAlign: "center",
                writingDirection: "rtl",
              }}
            >
              {getBookInitials(book.nameAr, book.nameEn)}
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
        {/* Offline badge */}
        {isDownloaded && (
          <View
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              backgroundColor: "rgba(29,185,84,0.85)",
              borderRadius: 10,
              width: 18,
              height: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 9, color: "#000", fontWeight: "700" }}>📥</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        className="text-right text-[13px] font-bold text-foreground"
        style={{ writingDirection: "rtl" }}
        numberOfLines={2}
      >
        {book.nameAr ?? book.nameEn}
      </Text>

      {/* Author */}
      {authorName && (
        <Text
          className="mt-0.5 text-right text-[11px] text-muted-foreground"
          style={{ writingDirection: "rtl" }}
          numberOfLines={1}
        >
          {authorName}
        </Text>
      )}
    </Pressable>
  );
}
