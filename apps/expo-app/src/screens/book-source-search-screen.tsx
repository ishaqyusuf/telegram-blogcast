import { parseKetabOnlineBookId } from "@acme/document/book/ketabonline";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, Text, TextInput, View } from "react-native";

import {
	BookSourceImportProgress,
	isSourceImportActive,
} from "@/components/book/book-source-import-progress";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { FlatList } from "@/components/ui/scroll-surfaces";
import { useColors } from "@/hooks/use-color";
import { useMutation, useQueries, useQuery, useQueryClient } from "@/lib/react-query";

type SearchItem = RouterOutputs["bookSource"]["search"]["items"][number];

function useAppActive() {
	const [active, setActive] = useState(AppState.currentState === "active");
	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
		return () => subscription.remove();
	}, []);
	return active;
}

function bookMeta(item: { authors: string[]; pagesCount: number; partsCount?: number; volumesCount?: number }) {
	const volumes = item.volumesCount ?? item.partsCount ?? 0;
	// English counts lead so the line keeps LTR order; the Arabic author trails as content.
	return [
		item.pagesCount ? `${item.pagesCount.toLocaleString()} pages` : null,
		volumes > 1 ? `${volumes} volumes` : null,
		item.authors[0],
	]
		.filter(Boolean)
		.join(" · ");
}

export default function BookSourceSearchScreen() {
	const router = useRouter();
	const colors = useColors();
	const qc = useQueryClient();
	const appActive = useAppActive();
	// `q` lets other screens and links open a prefilled search.
	const { q } = useLocalSearchParams<{ q?: string }>();
	const [query, setQuery] = useState(typeof q === "string" ? q.slice(0, 120) : "");
	const [debounced, setDebounced] = useState("");
	const [pageCount, setPageCount] = useState(1);
	const [selected, setSelected] = useState<number | null>(null);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebounced(query.trim());
			setPageCount(1);
		}, 400);
		return () => clearTimeout(timer);
	}, [query]);

	const directId = useMemo(() => {
		const looksLikeId = /^\d+$/.test(debounced) || /^https?:\/\//i.test(debounced);
		return looksLikeId ? parseKetabOnlineBookId(debounced) : null;
	}, [debounced]);
	const invalidId = Boolean(debounced) && directId === null && (/^\d+$/.test(debounced) || /^https?:\/\//i.test(debounced));
	const titleQuery = directId === null && !invalidId && debounced.length >= 2 ? debounced : "";

	const pages = useQueries({
		queries: Array.from({ length: titleQuery ? pageCount : 0 }, (_, index) =>
			_trpc.bookSource.search.queryOptions({ query: titleQuery, page: index + 1 }, { staleTime: 60_000 }),
		),
	});
	const results = pages.flatMap((page) => page.data?.items ?? []);
	const lastPage = pages.at(-1);
	const searching = pages.some((page) => page.isFetching);

	const imports = useQuery(
		_trpc.bookSource.mine.queryOptions(
			{ limit: 5 },
			{
				enabled: appActive,
				refetchInterval: (state) => (appActive && state.state.data?.some(isSourceImportActive) ? 2500 : false),
				refetchIntervalInBackground: false,
			},
		),
	);
	// Reconcile durable worker progress whenever the user returns to this screen.
	useFocusEffect(
		useCallback(() => {
			qc.invalidateQueries({ queryKey: _trpc.bookSource.mine.queryKey() });
		}, [qc]),
	);

	const openPage = (bookId: number, pageId: number) => router.push(`/books/${bookId}/reader/${pageId}` as never);
	const openBook = (bookId: number) => router.push(`/books/${bookId}` as never);

	const header = (
		<View>
			{imports.data?.length ? (
				<View className="border-b border-border pb-2">
					<Text className="px-4 pb-1 pt-3 text-xs font-bold text-muted-foreground">Imports</Text>
					{imports.data.map((job) => (
						<View key={job.id} className="gap-1 px-4 py-2.5">
							<Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
								{job.title ?? `KetabOnline #${job.sourceBookId}`}
							</Text>
							<BookSourceImportProgress job={job} onOpenPage={openPage} onOpenBook={openBook} />
						</View>
					))}
				</View>
			) : null}
			{directId !== null ? (
				<Pressable
					accessibilityRole="button"
					onPress={() => setSelected(directId)}
					className="flex-row items-center gap-3 border-b border-border px-4 py-3.5"
				>
					<Icon name="BookOpen" size={20} className="text-primary" />
					<Text className="flex-1 text-[15px] font-semibold text-foreground">Book #{directId}</Text>
					<Icon name="ChevronRight" size={18} className="text-muted-foreground" />
				</Pressable>
			) : null}
			{titleQuery && results.length ? (
				<Text className="px-4 pb-1 pt-3 text-xs font-bold text-muted-foreground">
					Results · {(pages[0]?.data?.total ?? results.length).toLocaleString()}
				</Text>
			) : null}
		</View>
	);

	const empty = (() => {
		if (searching && !results.length) return <View className="pt-10"><ActivityIndicator color={colors.primary} /></View>;
		if (invalidId) return <EmptyNote icon="AlertCircle" text="Enter a KetabOnline book ID or a ketabonline.com book link." />;
		const failed = pages.find((page) => page.isError);
		if (failed)
			return (
				<View className="items-center gap-3 px-8 pt-10">
					<Text className="text-center text-sm text-muted-foreground">{failed.error?.message ?? "Search failed."}</Text>
					<Pressable accessibilityRole="button" onPress={() => failed.refetch()} className="rounded-full bg-card px-4 py-2">
						<Text className="font-semibold text-primary">Try again</Text>
					</Pressable>
				</View>
			);
		if (titleQuery) return <EmptyNote icon="SearchX" text={`No books match “${titleQuery}”.`} />;
		if (directId === null && !imports.data?.length)
			return <EmptyNote icon="Search" text="Search by title, or enter a book ID or link." />;
		return null;
	})();

	return (
		<View className="flex-1 bg-background">
			<SafeArea>
				<View className="flex-row items-center gap-2.5 px-4 pb-2 pt-2.5">
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Back"
						onPress={() => router.back()}
						className="size-[34px] items-center justify-center rounded-full bg-card"
					>
						<Icon name="ChevronLeft" size={20} className="text-foreground" />
					</Pressable>
					<Text className="text-[17px] font-bold text-foreground">KetabOnline</Text>
				</View>
				<View className="mx-4 mb-2 h-12 flex-row items-center gap-2 rounded-full border border-border bg-card px-4">
					<Icon name="Search" size={18} className="text-muted-foreground" />
					<TextInput
						value={query}
						onChangeText={setQuery}
						placeholder="Title, book ID or link"
						placeholderTextColor={colors.mutedForeground}
						accessibilityLabel="Search KetabOnline by title, book ID or link"
						className="h-full flex-1 py-0 text-[15px] text-foreground"
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="search"
					/>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Clear search"
						accessibilityElementsHidden={!query}
						importantForAccessibility={query ? "auto" : "no-hide-descendants"}
						disabled={!query}
						onPress={() => setQuery("")}
						hitSlop={10}
						className={query ? "opacity-100" : "opacity-0"}
					>
						<Icon name="X" size={16} className="text-muted-foreground" />
					</Pressable>
				</View>
				<FlatList
					data={titleQuery ? results : []}
					keyExtractor={(item: SearchItem) => String(item.id)}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag"
					ListHeaderComponent={header}
					ListEmptyComponent={empty}
					renderItem={({ item }: { item: SearchItem }) => (
						<Pressable
							accessibilityRole="button"
							onPress={() => setSelected(item.id)}
							className="flex-row gap-3 border-b border-border px-4 py-3"
						>
							<View style={{ width: 6, borderRadius: 3, backgroundColor: item.colors[0] ?? colors.border }} />
							<View className="flex-1 gap-0.5">
								<Text className="text-[15px] font-semibold text-foreground" numberOfLines={2}>
									{item.title}
								</Text>
								<Text className="text-xs text-muted-foreground" numberOfLines={1}>
									{bookMeta(item)}
								</Text>
								{item.localBookId ? (
									<View className="flex-row">
										<Text className="mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">In library</Text>
									</View>
								) : null}
							</View>
						</Pressable>
					)}
					ListFooterComponent={
						titleQuery && lastPage?.data?.hasMore ? (
							<Pressable
								accessibilityRole="button"
								accessibilityState={{ disabled: searching }}
								disabled={searching}
								onPress={() => setPageCount((count) => count + 1)}
								className={searching ? "items-center py-4 opacity-50" : "items-center py-4"}
							>
								<Text className="font-semibold text-primary">{searching ? "Loading…" : "Load more"}</Text>
							</Pressable>
						) : null
					}
					contentContainerStyle={{ paddingBottom: 32 }}
				/>
			</SafeArea>
			<FloatingBottomSheet
				visible={selected !== null}
				onClose={() => setSelected(null)}
				accessibilityLabel="Book details"
			>
				{selected !== null ? (
					<BookSourcePreview
						sourceBookId={selected}
						onStarted={() => setSelected(null)}
						onOpenBook={(bookId) => {
							setSelected(null);
							openBook(bookId);
						}}
					/>
				) : null}
			</FloatingBottomSheet>
		</View>
	);
}

function EmptyNote({ icon, text }: { icon: "Search" | "SearchX" | "AlertCircle"; text: string }) {
	return (
		<View className="items-center gap-2 px-8 pt-12">
			<Icon name={icon} size={36} className="text-muted-foreground" />
			<Text className="text-center text-sm text-muted-foreground">{text}</Text>
		</View>
	);
}

function BookSourcePreview({
	sourceBookId,
	onStarted,
	onOpenBook,
}: {
	sourceBookId: number;
	onStarted: () => void;
	onOpenBook: (bookId: number) => void;
}) {
	const qc = useQueryClient();
	const preview = useQuery(_trpc.bookSource.preview.queryOptions({ sourceBookId }, { staleTime: 30_000 }));
	const start = useMutation(
		_trpc.bookSource.start.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: _trpc.bookSource.mine.queryKey() });
				qc.invalidateQueries({ queryKey: _trpc.bookSource.preview.queryKey({ sourceBookId }) });
				onStarted();
			},
		}),
	);
	if (preview.isPending)
		return (
			<View className="items-center px-5 py-10">
				<ActivityIndicator />
			</View>
		);
	if (preview.isError)
		return (
			<View className="gap-3 px-5 pb-5 pt-2">
				<Text className="text-base font-semibold text-foreground">Couldn’t load this book</Text>
				<Text className="text-sm text-muted-foreground">{preview.error.message}</Text>
				<SheetButton label="Try again" onPress={() => preview.refetch()} />
			</View>
		);
	const book = preview.data;
	const running = isSourceImportActive(book.latestImport);
	const pending = start.isPending;
	return (
		<View className="gap-3 px-5 pb-5 pt-2">
			<View className="gap-1">
				<Text className="text-[17px] font-bold leading-7 text-foreground">
					{book.title ?? `KetabOnline #${book.sourceBookId}`}
				</Text>
				{book.authors.length || book.categories.length ? (
					<Text className="text-[13px] text-muted-foreground">
						{[book.authors.join(", "), book.categories[0]].filter(Boolean).join(" · ")}
					</Text>
				) : null}
			</View>
			{book.available ? (
				<View className="flex-row gap-6">
					<Stat value={book.pagesCount} label="pages" />
					<Stat value={book.volumesCount} label={book.volumesCount === 1 ? "volume" : "volumes"} />
					<Stat value={book.chaptersCount} label={book.chaptersCount === 1 ? "chapter" : "chapters"} />
				</View>
			) : (
				<View className="flex-row items-start gap-2 rounded-2xl bg-destructive/10 p-3">
					<Icon name="AlertCircle" size={18} className="text-destructive" />
					<View className="flex-1 gap-0.5">
						<Text className="font-semibold text-foreground">Text not available</Text>
						<Text className="text-[13px] leading-5 text-muted-foreground">{book.unavailableReason}</Text>
					</View>
				</View>
			)}
			{book.source ? (
				<Text className="text-xs text-muted-foreground">
					{`Source · ${book.source}`}
				</Text>
			) : null}
			{start.error ? <Text className="text-[13px] text-destructive">{start.error.message}</Text> : null}
			{running && book.latestImport ? (
				<View className="rounded-2xl bg-background p-3">
					<BookSourceImportProgress job={book.latestImport} />
				</View>
			) : null}
			<View className="gap-2">
				{book.localBookId ? <SheetButton primary label="Open book" onPress={() => onOpenBook(book.localBookId!)} /> : null}
				{book.available && !running ? (
					<SheetButton
						primary={!book.localBookId}
						disabled={pending}
						label={pending ? "Starting…" : book.localBookId ? "Update from KetabOnline" : "Import book"}
						onPress={() => start.mutate({ sourceBookId })}
					/>
				) : null}
			</View>
		</View>
	);
}

function Stat({ value, label }: { value: number; label: string }) {
	return (
		<View className="items-start">
			<Text className="text-lg font-bold text-foreground">{value.toLocaleString()}</Text>
			<Text className="text-xs text-muted-foreground">{label}</Text>
		</View>
	);
}

function SheetButton({
	label,
	onPress,
	primary = false,
	disabled = false,
}: {
	label: string;
	onPress: () => void;
	primary?: boolean;
	disabled?: boolean;
}) {
	const base = primary ? "items-center rounded-2xl bg-primary py-3.5" : "items-center rounded-2xl border border-border bg-background py-3";
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			className={disabled ? `${base} opacity-50` : base}
		>
			<Text className={primary ? "text-[15px] font-bold text-primary-foreground" : "text-[15px] font-semibold text-foreground"}>{label}</Text>
		</Pressable>
	);
}
