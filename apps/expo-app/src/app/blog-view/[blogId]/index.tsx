import { DesignSwitch } from "@/components/design-switch";
import { _trpc } from "@/components/static-trpc";
import BlogViewAudio from "@/screens.example/blog-view-audio";
import BlogViewText from "@/screens.example/blog-view-text";
import VideoBlogScreen from "@/screens/video-blog-screen";
import { useColors } from "@/hooks/use-color";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

export default function BlogViewPage() {
  const colors = useColors();
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
      <View
        className="flex-1 items-center justify-center bg-background px-6"
        style={{ backgroundColor: colors.background }}
      >
        <Text
          className="text-base font-semibold text-foreground"
          style={{ color: colors.foreground }}
        >
          Invalid blog id
        </Text>
      </View>
    );
  }

  if (isPending) {
    return (
      <View
        className="flex-1 items-center justify-center gap-3 bg-background"
        style={{ backgroundColor: colors.background }}
      >
        <ActivityIndicator color={colors.primary} />
        <Text
          className="text-sm text-muted-foreground"
          style={{ color: colors.mutedForeground }}
        >
          Loading design...
        </Text>
      </View>
    );
  }

  if (data?.type === "text") {
    return <DesignSwitch screen screens={[<BlogViewText key={0} />]} />;
  }

  if (data?.type === "video") {
    return <VideoBlogScreen />;
  }

  return <DesignSwitch screen screens={[<BlogViewAudio key={0} />]} />;
}
