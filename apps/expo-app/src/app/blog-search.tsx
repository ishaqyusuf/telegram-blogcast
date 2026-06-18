import BlogSearch from "@/screens.example/blog-search";
import { useRouter } from "expo-router";

export default function BlogSearchScreen() {
  const router = useRouter();

  return <BlogSearch onBackPress={() => router.back()} />;
}
