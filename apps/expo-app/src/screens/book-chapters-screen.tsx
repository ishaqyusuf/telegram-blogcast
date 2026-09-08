import { BookChapterImportStatus } from "@/components/book/book-chapter-import-status";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";
import { useInfiniteQuery } from "@/lib/react-query";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Text,
	TextInput,
	View,
} from "react-native";

export default function BookChaptersScreen() {
	const { bookId } = useLocalSearchParams<{ bookId: string }>();
	const bookIdNum = Number(bookId);
	const router = useRouter();
	const colors = useColors();
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const [search, setSearch] = useState("");
	const [ancestors, setAncestors] = useState<{ id: number; title: string }[]>(
		[],
	);
	const [openingId, setOpeningId] = useState<number | null>(null);
	const busy = useRef(false);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	useEffect(() => {
		const timer = setTimeout(() => setSearch(query.trim()), 250);
		return () => clearTimeout(timer);
	}, [query]);
	const parent = ancestors.at(-1);
	const chapters = useInfiniteQuery(
		_trpc.bookChapter.list.infiniteQueryOptions(
			{
				bookId: bookIdNum,
				parentId: parent?.id ?? null,
				q: search,
				limit: 40,
			},
			{ getNextPageParam: (page) => page.nextCursor },
		),
	);
	const items = chapters.data?.pages.flatMap((page) => page.items) ?? [];
	const openPage = async (id: number, sourcePageNo: number) => {
		if (busy.current) return;
		busy.current = true;
		setOpeningId(id);
		try {
			const target = await vanillaTrpc.bookChapter.resolvePage.query({
				bookId: bookIdNum,
				sourcePageNo,
			});
			if (!mounted.current) return;
			if (target.pageId)
				router.push(`/books/${bookId}/reader/${target.pageId}` as any);
			else if (target.sourceUrl)
				router.push({
					pathname: "/book-fetch-browser",
					params: { bookId, url: target.sourceUrl },
				} as any);
		} catch (error) {
			if (mounted.current)
				Alert.alert(
					t("error"),
					error instanceof Error
						? error.message
						: "Unable to open this chapter.",
				);
		} finally {
			busy.current = false;
			if (mounted.current) setOpeningId(null);
		}
	};
	return (
		<View className="flex-1 bg-background">
			<SafeArea>
				<View className="gap-3 border-b border-border px-4 py-3">
					<View className="flex-row items-center gap-3">
						<Pressable
							onPress={() =>
								parent && !search
									? setAncestors((value) => value.slice(0, -1))
									: router.back()
							}
							className="size-10 items-center justify-center rounded-full bg-card"
							accessibilityLabel="Back"
						>
							<Icon name="ChevronLeft" size={22} className="text-foreground" />
						</Pressable>
						<Text
							style={{
								flex: 1,
								textAlign: "right",
								writingDirection: "rtl",
								fontSize: 17,
								fontWeight: "700",
								color: colors.foreground,
							}}
							numberOfLines={2}
						>
							{search
								? t("searchChapters")
								: (parent?.title ?? t("index", { count: items.length }))}
						</Text>
						{parent ? (
							<Pressable onPress={() => setAncestors([])} className="py-2">
								<Text className="text-primary">All Chapters</Text>
							</Pressable>
						) : null}
					</View>
					<View className="flex-row-reverse items-center gap-2 rounded-xl bg-card px-3 py-2">
						<Icon name="Search" size={16} className="text-muted-foreground" />
						<TextInput
							value={query}
							onChangeText={setQuery}
							placeholder={t("searchChapters")}
							placeholderTextColor={colors.mutedForeground}
							style={{
								flex: 1,
								color: colors.foreground,
								textAlign: "right",
								writingDirection: "rtl",
								fontSize: 14,
								paddingVertical: 8,
							}}
							returnKeyType="search"
						/>
						{query ? (
							<Pressable
								onPress={() => setQuery("")}
								accessibilityLabel="Clear search"
							>
								<Icon name="X" size={18} className="text-muted-foreground" />
							</Pressable>
						) : null}
					</View>
					<Text className="text-xs text-muted-foreground">
						Tap a title to read. Use the arrow to browse its subchapters.
					</Text>
				</View>
				<FlatList
					key={`${parent?.id ?? "root"}:${search}`}
					data={items}
					keyExtractor={(item) => String(item.id)}
					contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
					keyboardShouldPersistTaps="handled"
					onEndReachedThreshold={0.5}
					onEndReached={() => {
						if (
							chapters.hasNextPage &&
							!chapters.isFetchingNextPage &&
							!chapters.isError
						)
							void chapters.fetchNextPage();
					}}
					ListHeaderComponent={<BookChapterImportStatus bookId={bookIdNum} />}
					ListEmptyComponent={
						chapters.isPending ? (
							<ActivityIndicator color={colors.primary} />
						) : !chapters.isError ? (
							<Text className="py-8 text-center text-muted-foreground">
								No chapters found.
							</Text>
						) : null
					}
					ListFooterComponent={
						chapters.isFetchingNextPage ? (
							<ActivityIndicator color={colors.primary} />
						) : chapters.isError ? (
							<Pressable onPress={() => chapters.refetch()} className="py-5">
								<Text className="text-center text-primary">
									Unable to load chapters. Tap to retry.
								</Text>
							</Pressable>
						) : null
					}
					renderItem={({ item }) => (
						<View className="mb-2 flex-row-reverse items-center gap-2 rounded-xl border border-border bg-card p-3">
							<Pressable
								disabled={openingId !== null || item.sourcePageNo == null}
								onPress={() =>
									item.sourcePageNo != null &&
									openPage(item.id, item.sourcePageNo)
								}
								className="flex-1 gap-2 py-1"
							>
								<Text
									style={{
										textAlign: "right",
										writingDirection: "rtl",
										color: colors.foreground,
										fontSize: 16,
										lineHeight: 25,
									}}
								>
									{item.title}
								</Text>
								{search && item.parentTitle ? (
									<Text
										style={{
											textAlign: "right",
											writingDirection: "rtl",
											color: colors.mutedForeground,
											fontSize: 12,
										}}
									>
										{item.parentTitle}
									</Text>
								) : null}
								<Text className="text-right text-xs text-muted-foreground">
									{item.sourcePageNo != null
										? `#${item.sourcePageNo}`
										: "Section"}
									{item.pageId ? " · Saved" : ""}
									{item.childCount ? ` · ${item.childCount} subchapters` : ""}
								</Text>
							</Pressable>
							{openingId === item.id ? (
								<ActivityIndicator color={colors.primary} />
							) : null}
							{item.childCount > 0 ? (
								<Pressable
									accessibilityLabel={`Browse subchapters: ${item.title}`}
									onPress={() => {
										setQuery("");
										setSearch("");
										setAncestors((value) =>
											search
												? [{ id: item.id, title: item.title }]
												: [...value, { id: item.id, title: item.title }],
										);
									}}
									className="size-11 items-center justify-center rounded-full bg-secondary"
								>
									<Icon name="ChevronLeft" size={20} className="text-primary" />
								</Pressable>
							) : null}
						</View>
					)}
				/>
			</SafeArea>
		</View>
	);
}
