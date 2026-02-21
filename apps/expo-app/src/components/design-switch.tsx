import { cn } from "@/lib/utils";
import { getColorFromName } from "@gnd/utils/colors";
import { useState } from "react";
import { Pressable, View } from "react-native";

interface Props {
  screens?: any[];
  screen?: boolean;
  className?: string;
}
export function DesignSwitch(props: Props) {
  const [index, setIndex] = useState(0);

  return (
    <View className={cn("flex-1 relative", props.className)}>
      {props?.screens?.[index]}

      <View
        className={cn(
          "absolute z-999 flex-row gap-4 top-0 left-0 p-2 ",
          props.screen && "p-8 left-1/2",
        )}
      >
        {props?.screens?.length! < 2
          ? undefined
          : props?.screens?.map((s, i) => (
              <Pressable
                key={i}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  borderWidth: index === i ? 1 : 0,
                  backgroundColor: getColorFromName(`screen-${i}`),
                }}
                onPress={(e) => {
                  setIndex(i);
                }}
              />
            ))}
      </View>
    </View>
  );
}
