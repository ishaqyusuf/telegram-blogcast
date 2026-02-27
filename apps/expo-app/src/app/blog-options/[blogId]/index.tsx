import { useLocalSearchParams } from "expo-router";

import { BlogCardOptionsSheet } from "@/components/blog-card/blog-card-options-sheet";

export default function BlogOptionsScreen() {
  const { blogId } = useLocalSearchParams<{ blogId: string }>();

  return <BlogCardOptionsSheet blogId={String(blogId ?? "")} />;
}
