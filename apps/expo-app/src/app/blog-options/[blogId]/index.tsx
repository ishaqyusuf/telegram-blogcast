import { useLocalSearchParams } from "expo-router";

import { BlogCardOptionsSheet } from "@/components/blog-card/blog-card-options-sheet";

export default function BlogOptionsScreen() {
  const params = useLocalSearchParams<{
    blogId: string;
    type?: string;
    title?: string;
    audioMediaId?: string;
    audioTelegramFileId?: string;
    audioUrl?: string;
  }>();

  return (
    <BlogCardOptionsSheet
      blogId={String(params.blogId ?? "")}
      postType={params.type}
      postTitle={params.title}
      audioMediaId={params.audioMediaId}
      audioTelegramFileId={params.audioTelegramFileId}
      audioUrl={params.audioUrl}
    />
  );
}
