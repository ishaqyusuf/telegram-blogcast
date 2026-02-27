import { DesignSwitch } from "@/components/design-switch";
import { _trpc } from "@/components/static-trpc";
import BlogViewAudio from "@/screens.example/blog-view-audio";
import BlogViewText from "@/screens.example/blog-view-text";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

export default function BlogViewPage() {
  const { blogId } = useLocalSearchParams<{ blogId?: string }>();
  const id = Number(blogId);
  const canQuery = Number.isFinite(id) && id > 0;

  const { data, isPending } = useQuery(
    _trpc.blog.getBlog.queryOptions(
      { id: id || 0 },
      {
        enabled: canQuery,
      },
    ),
  );

  if (!canQuery) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-base font-semibold text-foreground">
          Invalid blog id
        </Text>
      </View>
    );
  }

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background">
        <ActivityIndicator />
        <Text className="text-sm text-muted-foreground">Loading design...</Text>
      </View>
    );
  }

  if (data?.type === "text") {
    return <DesignSwitch screen screens={[<BlogViewText key={0} />]} />;
  }

  return <DesignSwitch screen screens={[<BlogViewAudio key={0} />]} />;
}
