import { BookChapterImportStatus } from "@/components/book/book-chapter-import-status";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { buildChapterRows } from "@/lib/book-chapter-tree";
import { useTranslation } from "@/lib/i18n";
import { useCachedBookChapters } from "@/hooks/use-cached-book-chapters";
import { useBookOfflineStore } from "@/store/book-offline-store";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useState,
} from "react";
import {
	ActivityIndicator,
	FlatList,
	Platform,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BookChaptersScreen() {
	const { bookId } = useLocalSearchParams<{ bookId: string }>();
	const bookIdNum = Number(bookId);
	const router = useRouter();
	const colors = useColors();
	const insets = useSafeAreaInsets();
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const search = useDeferredValue(query.trim());
	// Empty means every branch is expanded, including newly imported descendants.
	const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
	const [openingId, setOpeningId] = useState<number | null>(null);
	const [openError, setOpenError] = useState<string | null>(null);
	useFocusEffect(
		useCallback(() => {
			setOpeningId(null);
			setCollapsed(new Set());
		}, []),
	);
	useEffect(() => {
		setCollapsed(new Set());
		setQuery("");
		setOpenError(null);
	}, [bookIdNum]);
	const chapters = useCachedBookChapters(bookIdNum);
	const { refetch, refreshIfStale } = chapters;
	useFocusEffect(
		useCallback(() => {
			refreshIfStale();
		}, [refreshIfStale]),
	);
	const items = buildChapterRows(chapters.data?.items ?? [], collapsed, search);
	const lastPageId = useBookOfflineStore((s) => s.readingProgress[bookIdNum]);
	const currentSourcePage = useBookOfflineStore(
		(s) => s.savedPageSummaries[lastPageId]?.sourcePageNo,
	);
	const openPage = (id: number, sourcePageNo: number) => {
		setOpeningId(id);
		setOpenError(null);
		router.push({ pathname: "/book-read-source", params: { bookId, sourcePageNo } } as any);
	};
	const toggle = (id: number) => {
		setQuery("");
		setCollapsed((current) => {
			const next = new Set(current);
			if (!search && next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};
	return (
		<View className="flex-1 bg-background">
			<SafeArea>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						backgroundColor: colors.secondary,
						paddingHorizontal: 10,
						minHeight: 48,
					}}
				>
					<Pressable
						accessibilityLabel="Back"
						onPress={() => router.back()}
						style={{
							width: 44,
							height: 44,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Icon name="ChevronLeft" size={20} className="text-foreground" />
					</Pressable>
					<Text
						style={{
							flex: 1,
							textAlign: "right",
							color: colors.foreground,
							fontSize: 17,
							fontWeight: "600",
						}}
					>
						فصول الكتاب
					</Text>
				</View>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						paddingHorizontal: 15,
						minHeight: 40,
					}}
				>
					<Pressable
						accessibilityLabel={
							collapsed.size ? "Expand all chapters" : "Collapse all chapters"
						}
						onPress={() => {
							setQuery("");
							setCollapsed((current) =>
								current.size
									? new Set()
									: new Set((chapters.data?.items ?? []).map((n) => n.id)),
							);
						}}
						style={{ minHeight: 44, justifyContent: "center" }}
					>
						<Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
							{collapsed.size ? "توسيع الكل" : "طي الكل"}
						</Text>
					</Pressable>
					<Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
						{items.length} / {chapters.data?.items.length ?? 0}
					</Text>
				</View>
				{openError ? (
					<Text
						accessibilityRole="alert"
						style={{
							color: colors.foreground,
							paddingHorizontal: 15,
							paddingBottom: 10,
						}}
					>
						{openError}
					</Text>
				) : null}
				<FlatList
					key={search ? "search" : "tree"}
					data={items}
					style={{ flex: 1 }}
					keyExtractor={(item) => String(item.id)}
					contentContainerStyle={{
						paddingHorizontal: 12,
						paddingBottom: 105 + insets.bottom,
					}}
					initialNumToRender={18}
					maxToRenderPerBatch={18}
					windowSize={7}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag"
					ListHeaderComponent={
						<View>
							<BookChapterImportStatus bookId={bookIdNum} hideCompleted />
							{chapters.cacheError && <Text className="px-3 py-2 text-sm text-destructive">Chapters are visible, but could not be saved offline. {chapters.cacheError.message}</Text>}
							{chapters.data?.cache?.revision === "legacy-unverified" && <Text className="px-3 py-2 text-sm text-muted-foreground">Older offline chapter index. Connect and refresh to verify that every chapter is included.</Text>}
						</View>
					}
					ListEmptyComponent={
						chapters.isPending ? (
							<ActivityIndicator color={colors.primary} />
						) : !chapters.isError ? (
							<Text
								style={{
									color: colors.mutedForeground,
									textAlign: "center",
									padding: 25,
								}}
							>
								{search ? "لا توجد فصول مطابقة" : "No chapters found."}
							</Text>
						) : null
					}
					ListFooterComponent={
						chapters.isError ? (
							<Pressable onPress={() => void refetch()} style={{ padding: 20 }}>
								<Text style={{ textAlign: "center", color: colors.primary }}>
									{chapters.error?.message ?? "Unable to load chapters."} Tap to retry.
								</Text>
							</Pressable>
						) : null
					}
					renderItem={({ item }) => {
						const expanded = Boolean(search) || !collapsed.has(item.id);
						const current =
							item.sourcePageNo != null &&
							item.sourcePageNo === currentSourcePage;
						const indent = Math.min(item.depth, 8) * 12;
						return (
							<View style={{ paddingRight: indent }}>
								{item.ancestorIds.slice(0, 8).map((id, index) => (
									<View
										key={id}
										pointerEvents="none"
										style={{
											position: "absolute",
											right: index * 12 + 5,
											top: 0,
											bottom: 0,
											borderRightWidth: StyleSheet.hairlineWidth,
											borderColor: colors.border,
											borderStyle: "dotted",
										}}
									/>
								))}
								<View
									style={{
										flexDirection: "row-reverse",
										alignItems: "flex-start",
										borderBottomWidth: StyleSheet.hairlineWidth,
										borderColor: colors.border,
										backgroundColor: current
											? colors.secondary
											: colors.background,
									}}
								>
									{item.childCount ? (
										<Pressable
											onPress={() => toggle(item.id)}
											accessibilityLabel={`${expanded ? "Collapse" : "Expand"}: ${item.title}`}
											accessibilityRole="button"
											accessibilityState={{ expanded }}
											style={{
												width: 34,
												minHeight: 44,
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											<Text
												style={{
													fontSize: 11,
													color: colors.mutedForeground,
													backgroundColor: colors.secondary,
												}}
											>
												{expanded ? "[-]" : "[+]"}
											</Text>
										</Pressable>
									) : (
										<View
											style={{
												width: 34,
												minHeight: 44,
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											<Text style={{ color: colors.mutedForeground }}>-</Text>
										</View>
									)}
									<Pressable
										disabled={openingId !== null || item.sourcePageNo == null}
										accessibilityLabel={`${item.title}, page ${item.sourcePageNo ?? "unavailable"}`}
										onPress={() =>
											item.sourcePageNo != null &&
											void openPage(item.id, item.sourcePageNo)
										}
										style={{ flex: 1, paddingVertical: 7, minHeight: 44 }}
									>
										<Text
											style={{
												fontFamily:
													Platform.OS === "android" ? "serif" : undefined,
												writingDirection: "rtl",
												textAlign: "right",
												color: current ? colors.primary : colors.foreground,
												fontSize: 17,
												lineHeight: 27,
											}}
										>
											{item.title}
										</Text>
									</Pressable>
									<View
										style={{ width: 34, paddingTop: 14, alignItems: "center" }}
									>
										{openingId === item.id ? (
											<ActivityIndicator size="small" color={colors.primary} />
										) : (
											<Text
												style={{ fontSize: 10, color: colors.mutedForeground }}
											>
												{item.sourcePageNo ?? ""}
											</Text>
										)}
									</View>
								</View>
							</View>
						);
					}}
				/>
				<KeyboardStickyView
					offset={{ closed: 0, opened: insets.bottom }}
					style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
				>
					<View
						style={{
							backgroundColor: colors.background,
							borderTopWidth: StyleSheet.hairlineWidth,
							borderColor: colors.border,
							paddingHorizontal: 14,
							paddingTop: 7,
							paddingBottom: Math.max(insets.bottom, 10),
						}}
					>
						<View
							style={{
								flexDirection: "row-reverse",
								alignItems: "center",
								gap: 8,
								borderBottomWidth: StyleSheet.hairlineWidth,
								borderColor: colors.border,
							}}
						>
							<Icon name="Search" size={17} className="text-muted-foreground" />
							<TextInput
								value={query}
								onChangeText={setQuery}
								maxLength={200}
								placeholder={t("searchChapters")}
								accessibilityLabel="Search chapters by title or page number"
								placeholderTextColor={colors.mutedForeground}
								style={{
									flex: 1,
									minHeight: 48,
									textAlign: "right",
									writingDirection: "rtl",
									color: colors.foreground,
									fontSize: 14,
									paddingVertical: 8,
								}}
								returnKeyType="search"
							/>
							{query ? (
								<Pressable
									accessibilityLabel="Clear search"
									onPress={() => setQuery("")}
									style={{
										width: 44,
										height: 44,
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Icon name="X" size={18} className="text-muted-foreground" />
								</Pressable>
							) : null}
						</View>
					</View>
				</KeyboardStickyView>
			</SafeArea>
		</View>
	);
}
