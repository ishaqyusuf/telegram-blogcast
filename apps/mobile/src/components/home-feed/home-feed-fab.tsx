
import { TouchableOpacity } from "react-native";
import { Mic } from "lucide-react-native";

export function HomeFeedFAB() {
  return (
    <TouchableOpacity className="absolute z-40 bottom-32 right-4 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg">
      <Mic size={28} color="white" />
    </TouchableOpacity>
  );
}
