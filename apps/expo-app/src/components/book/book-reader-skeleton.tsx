import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-color";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useTranslation } from "@/lib/i18n";
import { Pressable } from "@/components/ui/pressable";
import type { PageLoadStatus } from "@/lib/book-page-loader";

export function BookReaderSkeleton({
	status,
	error,
	onRetry,
	onShowSource,
}: {
	status?: PageLoadStatus;
	error?: string;
	onRetry?: () => void;
	onShowSource?: () => void;
}) {
	const colors = useColors();
	const { isRtl } = useTranslation();
	const theme = useAppSettingsStore((state) => state.readerTheme);
	const background =
		theme === "sepia"
			? "#f7f0df"
			: theme === "night"
				? "#111827"
				: colors.background;
	const line =
		theme === "sepia"
			? "#e4d7bb"
			: theme === "night"
				? "#374151"
				: colors.border;
	const foreground =
		theme === "sepia"
			? "#2f2418"
			: theme === "night"
				? "#f9fafb"
				: colors.foreground;
	const label = error
		? isRtl
			? "تعذر تحميل الصفحة"
			: "Unable to load page"
		: status === "paused"
			? isRtl
				? "بانتظار الاتصال…"
				: "Waiting for connection…"
			: status === "saving"
				? isRtl
					? "جارٍ تجهيز الصفحة…"
					: "Preparing page…"
				: isRtl
					? "جارٍ تحميل الصفحة…"
					: "Loading page…";
	return (
		<View
			style={{
				flex: 1,
				minHeight: 320,
				backgroundColor: background,
				padding: 20,
				gap: 18,
			}}
		>
			<Text
				accessibilityLiveRegion="polite"
				style={{ textAlign: isRtl ? "right" : "left", color: foreground }}
			>
				{label}
			</Text>
			{error ? (
				<View style={{ gap: 16 }}>
					<Text style={{ color: foreground }}>{error}</Text>
					<View style={{ flexDirection: "row", gap: 24 }}>
						{onRetry ? (
							<Pressable accessibilityRole="button" onPress={onRetry}>
								<Text style={{ color: colors.primary, paddingVertical: 12 }}>
									{isRtl ? "إعادة المحاولة" : "Retry"}
								</Text>
							</Pressable>
						) : null}
						{onShowSource ? (
							<Pressable accessibilityRole="button" onPress={onShowSource}>
								<Text style={{ color: colors.primary, paddingVertical: 12 }}>
									{isRtl ? "فتح المصدر" : "Open source"}
								</Text>
							</Pressable>
						) : null}
					</View>
				</View>
			) : (
				<View
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					style={{ gap: 28 }}
				>
					{[0, 1, 2].map((paragraph) => (
						<View key={paragraph} style={{ gap: 15, alignItems: "flex-end" }}>
							{[100, 96, 100, 88, 63].map((width, index) => (
								<View
									key={index}
									style={{
										width: `${width}%`,
										height: 14,
										borderRadius: 4,
										backgroundColor: line,
									}}
								/>
							))}
						</View>
					))}
				</View>
			)}
		</View>
	);
}
