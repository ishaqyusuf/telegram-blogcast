
import { View, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export function HomeFeedFAB() {
  return (
    <TouchableOpacity className="absolute z-40 bottom-32 right-4 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg">
      <MaterialIcons name="mic" size={28} className="text-primary-foreground" />
    </TouchableOpacity>
  );
}
