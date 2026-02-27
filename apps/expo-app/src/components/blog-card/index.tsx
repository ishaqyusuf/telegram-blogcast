import { useRouter } from "expo-router";
import { Pressable } from "react-native";

import { useRecentlyViewedStore } from "@/store/recently-viewed-store";

import { CardFooter } from "./card-footer";
import { CardHeader } from "./card-header";
import { CardMedia } from "./card-media";
import type { BlogItem } from "./types";
import { resolveVariant } from "./utils";

export type { BlogItem } from "./types";

export function BlogCard({ post }: { post: BlogItem }) {
  const router = useRouter();
  const markViewed = useRecentlyViewedStore((state) => state.markViewed);
  const variant = resolveVariant(post);
  const href =
    post.type === "text" ? `/blog-view-text/${post.id}` : `/blog-view/${post.id}`;

  const handlePress = () => {
    markViewed({
      id: post.id,
      title: post.caption || post.audio?.title || "Untitled",
      type: post.type ?? "text",
      date: post.date ?? null,
    });
    router.push(href as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      className="rounded-2xl border border-border bg-card p-4"
    >
      <CardHeader post={post} variant={variant} />
      <CardMedia post={post} variant={variant} />
      <CardFooter post={post} />
    </Pressable>
  );
}
