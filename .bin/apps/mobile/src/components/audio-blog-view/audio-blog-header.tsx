import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../ui/icon";
import { useRouter } from "expo-router";

export function AudioBlogHeader() {
  const router = useRouter();
  return (
    <View className="bg-background">
      <SafeAreaView edges={["top"]}>
        <View className="px-4 py-3 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={(e) => {
              router.back();
            }}
            className="w-10 h-10 items-center justify-center rounded-full"
          >
            <Icon name="ChevronLeft" size={24} className="text-foreground" />
          </TouchableOpacity>
          <Text className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Now Playing
          </Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity className="w-10 h-10 items-center justify-center rounded-full">
              <Icon name="Share" size={20} className="text-foreground" />
            </TouchableOpacity>
            <TouchableOpacity className="w-10 h-10 items-center justify-center rounded-full">
              <Icon name="Menu" size={24} className="text-foreground" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
