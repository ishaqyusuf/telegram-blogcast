import { DesignSwitch } from "@/components/design-switch";
import BlogViewAudio from "@/screens.example/blog-view-audio";
import BlogViewText from "@/screens.example/blog-view-text";
import { useLocalSearchParams } from "expo-router";

export default function Page() {
  const { blogId } = useLocalSearchParams();
  if (blogId === "audio")
    return <DesignSwitch screen screens={[<BlogViewAudio key={0} />]} />;
  if (blogId === "text")
    return <DesignSwitch screen screens={[<BlogViewText key={0} />]} />;
  return <BlogViewAudio />;
}
