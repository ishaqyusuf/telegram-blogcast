import { useState } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Plus, Timer, MessageSquare } from "lucide-react-native";

export function CommentsFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      friction: 5,
      useNativeDriver: true,
    }).start();
    setIsOpen(!isOpen);
  };

  const fabStyle = {
    transform: [
      {
        rotate: animation.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "45deg"],
        }),
      },
    ],
  };

  const item1Style = {
    transform: [
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -70],
        }),
      },
    ],
    opacity: animation,
  };

  const item2Style = {
    transform: [
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -140],
        }),
      },
    ],
    opacity: animation,
  };

  return (
    <View className="absolute bottom-28 right-2 flex flex-col items-end gap-4 z-40">
      <Animated.View style={item2Style}>
        <TouchableOpacity className="flex-row items-center gap-3 bg-card border border-border p-2 pr-5 pl-2 rounded-full shadow-xl">
          <View className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <Timer size={20} className="text-primary" />
          </View>
          <View className="flex flex-col items-start">
            <Text className="text-foreground font-bold text-sm">
              Add Timestamp
            </Text>
            <Text className="text-muted-foreground text-[10px] font-medium">
              at 10:45
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
      <Animated.View style={item1Style}>
        <TouchableOpacity className="flex-row items-center gap-3 bg-card border border-border p-2 pr-5 pl-2 rounded-full shadow-xl">
          <View className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-foreground">
            <MessageSquare size={20} className="text-foreground" />
          </View>
          <Text className="text-foreground font-bold text-sm">Add Comment</Text>
        </TouchableOpacity>
      </Animated.View>
      <Animated.View style={fabStyle}>
        <TouchableOpacity
          onPress={toggleMenu}
          className="h-14 w-14 bg-primary text-primary-foreground rounded-2xl shadow-lg flex items-center justify-center"
        >
          <Plus size={28} color="white" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
