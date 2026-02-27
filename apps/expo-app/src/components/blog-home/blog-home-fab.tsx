import { Pressable } from "react-native";

import { Icon } from "@/components/ui/icon";

export function BlogHomeFab() {
  return (
    <Pressable className="absolute bottom-32 right-4 size-14 bg-accent rounded-full shadow-lg items-center justify-center active:scale-95 active:opacity-90 z-40">
      <Icon name="Mic" className="text-accent-foreground" />
    </Pressable>
  );
}
