import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

const BRAND_GREEN = "#14532d";

export function BlogHomeBooksCta() {
  const router = useRouter();

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
      <Pressable
        onPress={() => router.push("/books" as any)}
        style={{ borderRadius: 20, overflow: "hidden" }}
      >
        <View style={{ borderRadius: 20, padding: 18, backgroundColor: BRAND_GREEN }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <View
              style={{
                height: 48,
                width: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 16,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#fff" }}>Bk</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>
                Explore the library
              </Text>
              <Text style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
                Open books, continue reading, and browse your collection.
              </Text>
            </View>
            <View style={{ borderRadius: 999, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: BRAND_GREEN }}>
                Open Books
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
