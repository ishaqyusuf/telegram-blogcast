import { TouchableOpacity } from "react-native";
import { Icon } from "../ui/icon";

export function HomeFeedFAB() {
  return (
    <TouchableOpacity className="absolute z-40 bottom-32 right-4 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg">
      <Icon name="Mic" className="text-white size-28" />
    </TouchableOpacity>
  );
}
