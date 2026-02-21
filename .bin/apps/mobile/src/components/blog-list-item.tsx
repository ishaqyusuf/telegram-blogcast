import { Text, View } from "react-native";
import { BlogListImageItem } from "./blog-list-image-item";
import { BlogListAudioItem } from "./blog-list-audio-item";
import { TouchableOpacity } from "@gorhom/bottom-sheet";

export function BlogListItem({ item }) {
  if (item.img) return <BlogListImageItem item={item} />;
  if (item.audio?.mediaId) return <BlogListAudioItem item={item} />;
  const openModal = () => {};
  return (
    <View>
      <TouchableOpacity onPress={openModal}>
        <Text className="text-right text-sm leading-relaxed text-foreground">
          {item.content
            ?.split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
            .join("\n")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
