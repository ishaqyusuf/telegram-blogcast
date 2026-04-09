import { TouchableOpacity } from "react-native";
import { useColorScheme } from "nativewind";
import { useAuthContext } from "@/hooks/use-auth";
import { Icon } from "@/components/ui/icon";

export function Logout() {
  const { colorScheme } = useColorScheme();
  const auth = useAuthContext();
  return (
    <TouchableOpacity
      onPress={(e) => {
        auth.onLogout();
      }}
      className="p-2.5 rounded-full active:bg-gray-200 dark:active:bg-gray-700"
    >
      <Icon
        name="LogOut"
        size={20}
        color={colorScheme === "dark" ? "#F9FAFB" : "#1F2937"}
      />
    </TouchableOpacity>
  );
}
