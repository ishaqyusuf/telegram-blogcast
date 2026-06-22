import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent, ScrollView, Text, View, StyleProp, TextStyle } from "react-native";

interface AnimatedMarqueeProps {
  text: string;
  style?: StyleProp<TextStyle>;
  duration?: number;
  delay?: number;
}

export function AnimatedMarquee({ text, style, duration = 6000, delay = 2000 }: AnimatedMarqueeProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const shouldAnimate = textWidth > containerWidth && containerWidth > 0;

  useEffect(() => {
    if (!shouldAnimate) {
      translateX.setValue(0);
      return;
    }

    const distance = textWidth - containerWidth;
    
    // We animate from 0 to -distance because we are in RTL or LTR?
    // Let's assume standard LTR for the transform, RTL handles text alignment.
    // If it's Arabic, it usually starts from right and moves left.
    // So we move translateX from 0 to distance (since it's RTL, moving positive X might move it right? Let's check).
    // Actually, React Native RTL reverses X axis.
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateX, {
          toValue: -distance - 40, // move past the edge slightly
          duration: duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    anim.start();

    return () => anim.stop();
  }, [shouldAnimate, textWidth, containerWidth, translateX, duration, delay]);

  return (
    <View
      style={{ overflow: "hidden", width: "100%", flexShrink: 1 }}
      onLayout={(e: LayoutChangeEvent) => {
        setContainerWidth(e.nativeEvent.layout.width);
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}>
        <Animated.View style={{ transform: [{ translateX }], flexDirection: "row" }}>
          <Text
            onLayout={(e: LayoutChangeEvent) => {
              setTextWidth(e.nativeEvent.layout.width);
            }}
            style={[style, { writingDirection: "rtl" }]}
            numberOfLines={1}
          >
            {text}
          </Text>
          {shouldAnimate && (
            <Text
              style={[style, { paddingLeft: 40, writingDirection: "rtl" }]}
              numberOfLines={1}
            >
              {text}
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
