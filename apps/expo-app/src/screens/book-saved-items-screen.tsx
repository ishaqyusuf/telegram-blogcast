import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import type { LocalHighlight } from "@/db/local-schema";
import { readBookAnnotations, readerHighlight } from "@/lib/book-annotation-service";
import { useAuthContext } from "@/hooks/use-auth";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { pullServerHighlights } from "@/hooks/use-highlights-sync";
import { useColors } from "@/hooks/use-color";
import { savedTextPreview, sortSavedItems } from "@/lib/book-saved-items";
import { useBookOfflineStore } from "@/store/book-offline-store";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { withBookCacheDeadline } from "@/lib/book-cache-resource";

const EMPTY_BOOKMARKS: never[] = [];
type SavedItem = {
	key: string;
	pageId: number;
	color: string | null;
	startOffset: number | null;
	pageNo?: number | null;
	sourcePageNo?: number | null;
	preview: string;
};

export default function BookSavedItemsScreen() {
	const { bookId, kind } = useLocalSearchParams<{
		bookId: string;
		kind: string;
	}>();
	const id = Number(bookId);
	const isHighlights = kind !== "bookmarks";
	const title = isHighlights ? "Highlights" : "Bookmarks";
	const router = useRouter();
	const colors = useColors();
	const { profile } = useAuthContext();
	const scope = bookCacheScopeForUser(profile?.user?.id);
	const network = useNetInfo();
	const online = network.isConnected === true && network.isInternetReachable !== false;
	const bookmarks = useBookOfflineStore(
		(s) => s.bookmarks[id] ?? EMPTY_BOOKMARKS,
	);
	const summaries = useBookOfflineStore((s) => s.savedPageSummaries);
	const cachePageSummaries = useBookOfflineStore((s) => s.cachePageSummaries);
	const [highlightState, setHighlightState] = useState<{ scope: string; bookId: number; rows: LocalHighlight[] }>({ scope, bookId: id, rows: [] });
	const highlights = highlightState.scope === scope && highlightState.bookId === id ? highlightState.rows : [];
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [refresh, setRefresh] = useState(0);

	useFocusEffect(
		useCallback(() => {
			let active = true;
			const controller = new AbortController();
			setLoading(true);
			setError(null);
			const loadLocal = async () => {
				const rows = (await readBookAnnotations(scope, id)).flatMap((row) => { const highlight = readerHighlight(row); return highlight ? [highlight] : []; });
				if (active) setHighlightState({ scope, bookId: id, rows });
				return rows;
			};
			void (async () => {
				try {
					let rows = isHighlights ? await loadLocal() : [];
					if (active) setLoading(false);
					if (!active || !online) return;
					if (isHighlights) {
						try {
							await pullServerHighlights(id, scope);
							rows = await loadLocal();
						} catch {
							if (active)
								setError(
									"Could not refresh highlights. Saved highlights are still available.",
								);
						}
					}
					const pageIds = [
						...new Set(
							(isHighlights ? rows : bookmarks).map((row) => row.pageId),
						),
					];
					for (
						let offset = 0;
						active && offset < pageIds.length;
						offset += 100
					) {
						const pages = await withBookCacheDeadline((signal) => vanillaTrpc.book.getSavedPageSummaries.query({
							bookId: id,
							pageIds: pageIds.slice(offset, offset + 100),
						}, { signal }), controller.signal);
						if (active)
							cachePageSummaries(pages);
					}
				} catch {
					if (active)
						setError("Could not refresh page details. Showing saved previews.");
				} finally {
					if (active) setLoading(false);
				}
			})();
			return () => {
				active = false;
				controller.abort();
			};
		}, [id, scope, isHighlights, bookmarks, refresh, cachePageSummaries, online]),
	);

	const items = sortSavedItems<SavedItem>(
		isHighlights
			? highlights.map((row) => ({
					key: row.localId,
					pageId: row.pageId,
					color: row.color,
					startOffset: row.startOffset,
					pageNo: summaries[row.pageId]?.pageNo,
					sourcePageNo: summaries[row.pageId]?.sourcePageNo,
					preview:
						savedTextPreview(row.quoteText) ||
						savedTextPreview(row.note) ||
						"Highlighted passage",
				}))
			: bookmarks.map((row) => ({
					key: String(row.pageId),
					pageId: row.pageId,
					color: null,
					startOffset: null,
					pageNo: summaries[row.pageId]?.pageNo ?? row.pageNo,
					sourcePageNo: summaries[row.pageId]?.sourcePageNo,
					preview: summaries[row.pageId]?.preview || "Page preview unavailable",
				})),
	);

	return (
		<View className="flex-1 bg-background">
			<SafeArea>
				<View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
					<Pressable
						accessibilityLabel="Back"
						onPress={() => router.back()}
						className="size-11 items-center justify-center rounded-full bg-card"
					>
						<Icon name="ChevronLeft" size={22} className="text-foreground" />
					</Pressable>
					<Text className="flex-1 text-xl font-bold text-foreground">
						{title}
					</Text>
					<Text className="text-sm text-muted-foreground">{items.length}</Text>
				</View>
				{error ? (
					<Pressable
						onPress={() => setRefresh((value) => value + 1)}
						className="px-4 py-3"
					>
						<Text className="text-sm text-muted-foreground">
							{error} Tap to retry.
						</Text>
					</Pressable>
				) : null}
				<FlatList
					data={items}
					keyExtractor={(item) => item.key}
					contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
					ListEmptyComponent={
						loading ? (
							<ActivityIndicator color={colors.primary} />
						) : (
							<Text className="py-10 text-center text-muted-foreground">
								No {title.toLowerCase()} in this book yet.
							</Text>
						)
					}
					renderItem={({ item }) => (
						<Pressable
							accessibilityLabel={`${title === "Highlights" ? "Highlight" : "Bookmark"}, page ${item.pageNo ?? item.sourcePageNo ?? "unknown"}`}
							onPress={() =>
								router.push(`/books/${id}/reader/${item.pageId}` as any)
							}
							className="mb-3 rounded-2xl border border-border bg-card p-4"
						>
							<View className="mb-2 flex-row items-center gap-2">
								{item.color ? (
									<View
										style={{
											width: 14,
											height: 14,
											borderRadius: 7,
											backgroundColor: item.color,
										}}
									/>
								) : (
									<Icon name="Bookmark" size={16} className="text-primary" />
								)}
								<Text className="text-sm font-semibold text-muted-foreground">
									Page {item.pageNo ?? item.sourcePageNo ?? "?"}
									{item.sourcePageNo != null &&
									item.pageNo != null &&
									item.sourcePageNo !== item.pageNo
										? ` (Shamela ${item.sourcePageNo})`
										: ""}
								</Text>
							</View>
							<Text
								numberOfLines={2}
								ellipsizeMode="tail"
								className="text-base leading-7 text-foreground"
							>
								{item.preview}
							</Text>
						</Pressable>
					)}
				/>
			</SafeArea>
		</View>
	);
}
