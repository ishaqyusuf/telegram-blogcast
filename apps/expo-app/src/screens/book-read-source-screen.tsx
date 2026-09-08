import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeArea } from "@/components/safe-area";
import { BookReaderSkeleton } from "@/components/book/book-reader-skeleton";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { useBookPageResource } from "@/hooks/use-book-page-resource";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";

export default function BookReadSourceScreen() {
	const { url, bookId, sourcePageNo } = useLocalSearchParams<{
		url?: string;
		bookId?: string;
		sourcePageNo?: string;
	}>();
	const router = useRouter();
	const focused = useIsFocused();
	const colors = useColors();
	const { isRtl } = useTranslation();
	const resource = useBookPageResource(
		{
			url,
			bookId: bookId ? Number(bookId) : undefined,
			sourcePageNo: sourcePageNo ? Number(sourcePageNo) : undefined,
		},
		focused,
	);
	const navigated = useRef<string | null>(null);
	useEffect(() => {
		const load = resource.load;
		if (
			!focused ||
			load?.status !== "ready" ||
			!load.result ||
			navigated.current === load.key
		)
			return;
		navigated.current = load.key;
		router.replace(
			`/books/${load.result.bookId}/reader/${load.result.pageId}` as never,
		);
	}, [focused, resource.load, router]);
	return (
		<SafeArea>
			<View
				style={{
					paddingHorizontal: 16,
					paddingVertical: 12,
					flexDirection: "row",
					alignItems: "center",
					gap: 16,
					borderBottomWidth: 1,
					borderBottomColor: colors.border,
				}}
			>
				<Pressable
					accessibilityLabel={isRtl ? "رجوع" : "Back"}
					onPress={() =>
						router.canGoBack()
							? router.back()
							: router.replace("/books" as never)
					}
					style={{ padding: 8 }}
				>
					<Icon name="ChevronLeft" size={22} className="text-foreground" />
				</Pressable>
				<Text
					style={{
						flex: 1,
						color: colors.foreground,
						fontSize: 16,
						fontWeight: "600",
					}}
				>
					{isRtl ? "قراءة الكتاب" : "Book reader"}
				</Text>
				{bookId ? (
					<Pressable
						accessibilityLabel={isRtl ? "الفصول" : "Chapters"}
						onPress={() => router.push(`/books/${bookId}/chapters` as never)}
						style={{ padding: 8 }}
					>
						<Icon name="BookOpen" size={22} className="text-foreground" />
					</Pressable>
				) : null}
			</View>
			<BookReaderSkeleton
				status={resource.load?.status}
				error={resource.error}
				onRetry={resource.load ? resource.retry : undefined}
				onShowSource={resource.load ? resource.showSource : undefined}
			/>
		</SafeArea>
	);
}
