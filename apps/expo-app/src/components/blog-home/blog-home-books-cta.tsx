import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

export function BlogHomeBooksCta() {
  const router = useRouter();
  const colors = useColors();

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
      <Pressable
        onPress={() => router.push("/books" as any)}
        style={{ borderRadius: 20, overflow: "hidden" }}
      >
        <View style={{ borderRadius: 20, padding: 18, backgroundColor: colors.primary }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <View
              style={{
                height: 48,
                width: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 16,
                backgroundColor: withAlpha(colors.primaryForeground, 0.15),
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.primaryForeground }}>Bk</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.primaryForeground }}>
                Explore the library
              </Text>
              <Text style={{ marginTop: 4, fontSize: 14, color: withAlpha(colors.primaryForeground, 0.8) }}>
                Open books, continue reading, and browse your collection.
              </Text>
            </View>
            <View style={{ borderRadius: 999, backgroundColor: colors.primaryForeground, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>
                Open Books
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
