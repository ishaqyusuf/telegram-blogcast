import { useRouter } from "expo-router";
import { Pressable } from "react-native";

import { Icon } from "@/components/ui/icon";

export function BlogHomeFab() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add new blog"
      onPress={() => router.push("/blog-form" as any)}
      className="absolute bottom-24 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-80"
      style={{
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
      }}
    >
      <Icon name="Plus" size={28} className="text-primary-foreground" />
    </Pressable>
  );
}
