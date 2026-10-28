import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Animated,
	AppState,
	Easing,
	type StyleProp,
	Text,
	type TextStyle,
	View,
} from "react-native";

export function AnimatedMarquee({
	text,
	style,
	duration,
	delay = 1600,
}: {
	text: string;
	style?: StyleProp<TextStyle>;
	duration?: number;
	delay?: number;
}) {
	const [containerWidth, setContainerWidth] = useState(0);
	const [textWidth, setTextWidth] = useState(0);
	const [reduceMotion, setReduceMotion] = useState(true);
	const [active, setActive] = useState(AppState.currentState === "active");
	const translateX = useRef(new Animated.Value(0)).current;
	const firstLetter = text.match(/\p{L}/u)?.[0] ?? "";
	const rtl = /[\u0590-\u08ff]/.test(firstLetter);
	const singleLine = text.replace(/\s+/g, " ");
	const width = Math.max(containerWidth, textWidth + 1);
	const overflow = Math.max(0, width - containerWidth);
	const start = rtl ? -overflow : 0;

	useEffect(() => {
		let mounted = true;
		void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
			if (mounted) setReduceMotion(enabled);
		});
		const motion = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			setReduceMotion,
		);
		const app = AppState.addEventListener("change", (state) =>
			setActive(state === "active"),
		);
		return () => {
			mounted = false;
			motion.remove();
			app.remove();
		};
	}, []);

	useEffect(() => {
		translateX.stopAnimation();
		translateX.setValue(start);
		if (!active || reduceMotion || containerWidth <= 0 || overflow <= 4) return;
		const animation = Animated.loop(
			Animated.sequence([
				Animated.delay(delay),
				Animated.timing(translateX, {
					toValue: rtl ? 0 : -overflow,
					duration: duration ?? Math.max(2000, overflow * 32),
					easing: Easing.linear,
					useNativeDriver: true,
				}),
				Animated.delay(1400),
				Animated.timing(translateX, {
					toValue: start,
					duration: 0,
					useNativeDriver: true,
				}),
			]),
		);
		animation.start();
		return () => animation.stop();
	}, [
		active,
		containerWidth,
		delay,
		duration,
		overflow,
		reduceMotion,
		rtl,
		singleLine,
		start,
		translateX,
	]);

	return (
		<View
			style={{ overflow: "hidden", width: "100%" }}
			onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
		>
			<Animated.View style={{ width, transform: [{ translateX }] }}>
				<Text
					numberOfLines={1}
					ellipsizeMode="clip"
					style={[
						style,
						{
							writingDirection: rtl ? "rtl" : "ltr",
							textAlign: rtl ? "right" : "left",
						},
					]}
				>
					{singleLine}
				</Text>
			</Animated.View>
			<Text
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				pointerEvents="none"
				numberOfLines={1}
				onTextLayout={(event) =>
					setTextWidth(event.nativeEvent.lines[0]?.width ?? 0)
				}
				style={[
					style,
					{
						position: "absolute",
						width: 100000,
						opacity: 0,
						writingDirection: rtl ? "rtl" : "ltr",
					},
				]}
			>
				{singleLine}
			</Text>
		</View>
	);
}
