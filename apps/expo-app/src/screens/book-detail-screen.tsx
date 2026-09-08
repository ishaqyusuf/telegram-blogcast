import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Image,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { ChapterTree, type TocNode } from "@/components/book/chapter-tree";
import { BookChapterImportStatus } from "@/components/book/book-chapter-import-status";
import { saveBookDownloadToLocalDb } from "@/lib/book-offline-download";
import { useBookOfflineStore } from "@/store/book-offline-store";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { useTranslation } from "@/lib/i18n";
import { useColors } from "@/hooks/use-color";
import { toAbsoluteShamelaUrl } from "@/lib/shamela-url";

function normalizeChapterSearch(value: string) {
	return value.trim().toLowerCase();
}

function pageMatchesChapterSearch(
	page: {
		chapterTitle: string | null;
		topicTitle: string | null;
		shamelaPageNo: number;
		printedPageNo: number | null;
	},
	query: string,
) {
	if (!query) return true;
	return [
		page.chapterTitle,
		page.topicTitle,
		String(page.shamelaPageNo),
		page.printedPageNo != null ? String(page.printedPageNo) : null,
	].some((value) => value?.toLowerCase().includes(query));
}

function filterTocNodes(nodes: TocNode[], query: string) {
	if (!query) return nodes;
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const byParent = new Map<number | null, TocNode[]>();
	for (const node of nodes) {
		const key = node.parentId ?? null;
		byParent.set(key, [...(byParent.get(key) ?? []), node]);
	}
	const included = new Set<number>();

	const includeDescendants = (node: TocNode) => {
		for (const child of byParent.get(node.id) ?? []) {
			included.add(child.id);
			includeDescendants(child);
		}
	};

	for (const node of nodes) {
		const matches = [
			node.title,
			node.shamelaPageNo != null ? String(node.shamelaPageNo) : null,
			node.page?.printedPageNo != null ? String(node.page.printedPageNo) : null,
		].some((value) => value?.toLowerCase().includes(query));
		if (!matches) continue;

		let current: TocNode | undefined = node;
		while (current) {
			included.add(current.id);
			current =
				current.parentId != null ? byId.get(current.parentId) : undefined;
		}
		includeDescendants(node);
	}

	return nodes.filter((node) => included.has(node.id));
}

export default function BookDetailScreen() {
	const { bookId } = useLocalSearchParams<{ bookId: string }>();
	const router = useRouter();
	const { t } = useTranslation();
	const colors = useColors();
	const bookIdNum = Number(bookId);

	const [fetchUrl, setFetchUrl] = useState("");
	const [showFetchInput, setShowFetchInput] = useState(false);
	const fetchingPageId = null;
	const [isDownloadingBook, setIsDownloadingBook] = useState(false);
	const [chapterQuery, setChapterQuery] = useState("");

	const navigationBusy = useRef(false);
	const [isFetching, setIsFetching] = useState(false);

	// ── Reading progress + bookmarks ───────────────────────────────────────────
	const getLastPage = useBookOfflineStore((s) => s.getLastPage);
	const getBookmarks = useBookOfflineStore((s) => s.getBookmarks);
	const removeBookmark = useBookOfflineStore((s) => s.removeBookmark);
	const setDownloaded = useBookOfflineStore((s) => s.setDownloaded);
	const setDownloadProgress = useBookOfflineStore((s) => s.setDownloadProgress);
	const clearDownloadProgress = useBookOfflineStore(
		(s) => s.clearDownloadProgress,
	);
	const downloadProgress = useBookOfflineStore(
		(s) => s.downloadProgress[bookIdNum] ?? 0,
	);
	const [showBookmarks, setShowBookmarks] = useState(false);

	const { data: book, isLoading } = useQuery(
		_trpc.book.getBook.queryOptions({ id: bookIdNum, includeToc: false }),
	);
	const { data: pageImportHistory } = useQuery(
		_trpc.book.getBookPageImportHistory.queryOptions({
			bookId: bookIdNum,
			limit: 8,
		}),
	);

	async function downloadBookForOffline() {
		if (isDownloadingBook || !Number.isFinite(bookIdNum)) return;

		setIsDownloadingBook(true);
		setDownloadProgress(bookIdNum, 0.08);

		try {
			const payload = await vanillaTrpc.book.getBookForDownload.query({
				bookId: bookIdNum,
			});
			setDownloadProgress(bookIdNum, 0.55);

			const meta = await saveBookDownloadToLocalDb(payload);
			setDownloaded(meta);
			setDownloadProgress(bookIdNum, 1);
			Alert.alert(t("savedOffline"), t("downloadOffline"));
		} catch (e) {
			Alert.alert(t("error"), e instanceof Error ? e.message : String(e));
		} finally {
			setIsDownloadingBook(false);
			clearDownloadProgress(bookIdNum);
		}
	}

	if (isLoading) {
		return (
			<View
				style={[
					{
						flex: 1,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: colors.background,
					},
					{ backgroundColor: colors.background },
				]}
			>
				<ActivityIndicator color={colors.primary} />
			</View>
		);
	}

	if (!book) return null;

	const lastFetchedPage = [...(book.pages ?? [])]
		.filter((p) => p.status === "fetched")
		.sort((a, b) => b.shamelaPageNo - a.shamelaPageNo)[0];
	const nextSourcePageNo = lastFetchedPage?.nextShamelaPageNo;
	const nextPageCandidate = book.pages.find(
		(page) => page.shamelaPageNo === nextSourcePageNo,
	);
	const nextSourceUrl =
		lastFetchedPage?.nextShamelaUrl ??
		(nextSourcePageNo && book.shamelaId
			? `https://shamela.ws/book/${book.shamelaId}/${nextSourcePageNo}`
			: null);

	const fetchedCount = book.pages.filter((p) => p.status === "fetched").length;
	const totalCount = book.pages.length;
	const isImportedBook =
		book.editable === false ||
		book.sourceType === "shamela" ||
		Boolean(book.shamelaId || book.shamelaUrl);

	const continuePageId = getLastPage(bookIdNum);
	const lastReadPage =
		continuePageId != null
			? book.pages.find(
					(page) => page.id === continuePageId && page.status === "fetched",
				)
			: null;
	const firstFetchedPage = book.pages.find((page) => page.status === "fetched");
	const firstFetchablePage = book.pages.find((page) => page.shamelaUrl);
	const primaryReadPage =
		lastReadPage ?? firstFetchedPage ?? firstFetchablePage;
	const bookmarks = getBookmarks(bookIdNum);

	const openReader = (targetPageId: number) => {
		router.push(`/books/${bookId}/reader/${targetPageId}` as any);
	};

	const openCaptureBrowser = async (targetUrl: string) => {
		if (navigationBusy.current) return;
		navigationBusy.current = true;
		setIsFetching(true);
		try {
			const absoluteUrl = toAbsoluteShamelaUrl(targetUrl);
			const parsed = new URL(absoluteUrl);
			const expectedBookId =
				book.shamelaId ??
				(book.shamelaUrl
					? new URL(toAbsoluteShamelaUrl(book.shamelaUrl)).pathname.match(
							/^\/book\/(\d+)/,
						)?.[1]
					: null);
			const match = parsed.pathname.match(/^\/book\/([0-9]+)\/([0-9]+)\/?$/);
			if (
				parsed.hostname !== "shamela.ws" ||
				parsed.protocol !== "https:" ||
				!match ||
				match[1] !== String(expectedBookId)
			) {
				throw new Error("Use a page link from this Shamela book.");
			}
			const target = await vanillaTrpc.bookChapter.resolvePage.query({
				bookId: bookIdNum,
				sourcePageNo: Number(match[2]),
			});
			if (target.pageId) openReader(target.pageId);
			else
				router.push(
					`/book-read-source?url=${encodeURIComponent(absoluteUrl)}&bookId=${bookIdNum}` as any,
				);
		} catch (error) {
			Alert.alert(
				t("error"),
				error instanceof Error ? error.message : "Unable to open page.",
			);
		} finally {
			navigationBusy.current = false;
			setIsFetching(false);
		}
	};
	const openPrimaryReadTarget = () => {
		if (!primaryReadPage) return;
		if (primaryReadPage.status === "fetched") {
			openReader(primaryReadPage.id);
			return;
		}
		if (primaryReadPage.shamelaUrl) {
			openCaptureBrowser(primaryReadPage.shamelaUrl);
		}
	};
	const openPhysicalLibraryCreate = () => {
		const authorText = book.authors.map((a) => a.nameAr ?? a.name).join("، ");
		const params = new URLSearchParams({
			bookId: String(book.id),
			titleAr: book.nameAr ?? book.nameEn ?? "",
		});
		if (book.nameEn) params.set("titleEn", book.nameEn);
		if (authorText) params.set("authorText", authorText);
		router.push(`/books/library/new?${params.toString()}` as any);
	};
	const tocNodes = ((book as any).tocNodes ?? []) as TocNode[];
	const normalizedChapterQuery = normalizeChapterSearch(chapterQuery);
	const visibleTocNodes = filterTocNodes(tocNodes, normalizedChapterQuery);
	const visiblePages = normalizedChapterQuery
		? book.pages.filter((page) =>
				pageMatchesChapterSearch(page, normalizedChapterQuery),
			)
		: book.pages;
	const visibleChapterCount = tocNodes.length
		? visibleTocNodes.filter(
				(node) => node.kind !== "volume" && node.shamelaPageNo != null,
			).length
		: visiblePages.length;

	return (
		<View
			style={[
				{ flex: 1, backgroundColor: colors.background },
				{ backgroundColor: colors.background },
			]}
		>
			<SafeArea>
				<View className="flex-row items-center gap-3 px-4 py-3">
					<Pressable
						onPress={() => router.back()}
						className="size-9 items-center justify-center rounded-full bg-card"
					>
						<Icon name="ChevronLeft" size={22} className="text-foreground" />
					</Pressable>

					<Text
						style={[
							{
								flex: 1,
								textAlign: "right",
								fontSize: 17,
								fontWeight: "700",
								color: colors.foreground,
							},
							{ writingDirection: "rtl" },
						]}
						numberOfLines={1}
					>
						{book.nameAr ?? book.nameEn}
					</Text>

					{bookmarks.length > 0 && (
						<Pressable
							onPress={() => setShowBookmarks(!showBookmarks)}
							className={
								showBookmarks
									? "size-9 items-center justify-center rounded-full bg-primary/15"
									: "size-9 items-center justify-center rounded-full bg-card"
							}
						>
							<Icon
								name="Bookmark"
								size={18}
								className={showBookmarks ? "text-primary" : "text-foreground"}
							/>
						</Pressable>
					)}

					<Pressable
						onPress={() => router.push(`/books/${bookId}/search` as any)}
						className="size-9 items-center justify-center rounded-full bg-card"
					>
						<Icon name="Search" size={18} className="text-foreground" />
					</Pressable>
				</View>

				<ScrollView
					style={{ backgroundColor: colors.background }}
					contentContainerStyle={{ paddingBottom: 120 }}
				>
					<BookChapterImportStatus bookId={bookIdNum} />
					<View
						style={{
							flexDirection: "row",
							gap: 14,
							paddingHorizontal: 16,
							marginBottom: 20,
						}}
					>
						<View
							style={{
								width: 110,
								height: 154,
								borderRadius: 10,
								overflow: "hidden",
								backgroundColor: book.coverColor ?? colors.primary,
								flexShrink: 0,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							{book.coverUrl ? (
								<Image
									source={{ uri: book.coverUrl }}
									style={{ width: "100%", height: "100%" }}
									resizeMode="cover"
								/>
							) : (
								<Text
									style={{
										fontSize: 24,
										fontWeight: "bold",
										color: "white",
										textAlign: "center",
										writingDirection: "rtl",
									}}
								>
									{(book.nameAr ?? book.nameEn ?? t("bookTitle")).slice(0, 2)}
								</Text>
							)}
						</View>

						<View style={{ flex: 1, gap: 6, justifyContent: "center" }}>
							<Text
								style={[
									{
										textAlign: "right",
										fontSize: 18,
										fontWeight: "800",
										color: colors.foreground,
									},
									{ writingDirection: "rtl" },
								]}
							>
								{book.nameAr ?? book.nameEn}
							</Text>
							{book.nameEn && (
								<Text className="text-[13px] text-muted-foreground">
									{book.nameEn}
								</Text>
							)}
							{book.authors.length > 0 && (
								<Text
									style={[
										{ textAlign: "right", fontSize: 14, color: colors.primary },
										{ writingDirection: "rtl" },
									]}
								>
									{book.authors.map((a) => a.nameAr ?? a.name).join("، ")}
								</Text>
							)}
							{book.shelf && (
								<View className="self-end rounded-md bg-card px-2 py-0.5">
									<Text
										style={[
											{ fontSize: 12, color: colors.mutedForeground },
											{ writingDirection: "rtl" },
										]}
									>
										{book.shelf.nameAr ?? book.shelf.name}
									</Text>
								</View>
							)}
							{book.category && (
								<Text
									style={[
										{
											textAlign: "right",
											fontSize: 12,
											color: colors.mutedForeground,
										},
										{ writingDirection: "rtl" },
									]}
								>
									{book.category}
								</Text>
							)}
						</View>
					</View>

					{isImportedBook && (
						<View
							style={[
								{
									marginHorizontal: 16,
									marginBottom: 12,
									borderRadius: 12,
									borderWidth: 1,
									borderColor: colors.border,
									backgroundColor: colors.card,
									paddingHorizontal: 16,
									paddingVertical: 12,
								},
								{ gap: 5 },
							]}
						>
							<Text
								style={[
									{
										textAlign: "right",
										fontSize: 13,
										fontWeight: "700",
										color: colors.foreground,
									},
									{ writingDirection: "rtl" },
								]}
							>
								Imported read-only book
							</Text>
							<Text
								style={[
									{
										textAlign: "right",
										fontSize: 12,
										color: colors.mutedForeground,
									},
									{ writingDirection: "rtl" },
								]}
							>
								Pages can be refreshed from the Shamela source. Direct editing
								stays disabled.
							</Text>
							{book.shamelaUrl ? (
								<Text
									className="text-left text-[11px] text-muted-foreground"
									numberOfLines={1}
								>
									{book.shamelaUrl}
								</Text>
							) : null}
						</View>
					)}

					{primaryReadPage && (
						<Pressable
							onPress={openPrimaryReadTarget}
							className="mx-4 mb-3 flex-row-reverse items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3"
						>
							<View className="size-9 items-center justify-center rounded-full bg-primary">
								<Icon name="BookOpen" size={18} className="text-background" />
							</View>
							<View style={{ flex: 1 }}>
								<Text
									style={[
										{
											textAlign: "right",
											fontSize: 13,
											fontWeight: "700",
											color: colors.primary,
										},
										{ writingDirection: "rtl" },
									]}
								>
									{lastReadPage ? t("continueReading") : t("openBook")}
								</Text>
								<Text
									style={[
										{
											textAlign: "right",
											fontSize: 11,
											color: colors.mutedForeground,
										},
										{ writingDirection: "rtl" },
									]}
								>
									{lastReadPage
										? t("backToLastPage")
										: firstFetchedPage
											? t("openFirstPage")
											: t("fetchFirstPage")}
								</Text>
							</View>
							<Icon name="ChevronLeft" size={18} className="text-primary" />
						</Pressable>
					)}

					<Pressable
						onPress={openPhysicalLibraryCreate}
						className="mx-4 mb-3 flex-row-reverse items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3"
					>
						<View className="size-9 items-center justify-center rounded-full bg-background">
							<Icon name="Library" size={18} className="text-foreground" />
						</View>
						<View style={{ flex: 1 }}>
							<Text
								style={[
									{
										textAlign: "right",
										fontSize: 13,
										fontWeight: "700",
										color: colors.foreground,
									},
									{ writingDirection: "rtl" },
								]}
							>
								{t("catalogPhysicalCopy")}
							</Text>
							<Text
								style={[
									{
										textAlign: "right",
										fontSize: 11,
										color: colors.mutedForeground,
									},
									{ writingDirection: "rtl" },
								]}
							>
								{t("catalogPhysicalCopyDescription")}
							</Text>
						</View>
						<Icon
							name="ChevronLeft"
							size={18}
							className="text-muted-foreground"
						/>
					</Pressable>

					{showBookmarks && bookmarks.length > 0 && (
						<View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
							<Text
								style={[
									{
										marginBottom: 8,
										textAlign: "right",
										fontSize: 14,
										fontWeight: "700",
										color: colors.foreground,
									},
									{ writingDirection: "rtl" },
								]}
							>
								{t("bookmarks", { count: bookmarks.length })}
							</Text>
							{bookmarks.map((bm) => (
								<View
									key={bm.pageId}
									className="mb-1.5 flex-row-reverse items-center gap-2.5 rounded-xl bg-card px-3 py-2.5"
								>
									<Icon name="Bookmark" size={15} className="text-primary" />
									<Pressable
										style={{ flex: 1 }}
										onPress={() => openReader(bm.pageId)}
									>
										<Text
											style={[
												{
													textAlign: "right",
													fontSize: 13,
													color: colors.foreground,
												},
												{ writingDirection: "rtl" },
											]}
											numberOfLines={1}
										>
											{bm.chapterTitle ??
												`${t("page")} ${bm.pageNo ?? bm.pageId}`}
										</Text>
										{bm.pageNo && (
											<Text className="text-[11px] text-muted-foreground">
												{t("pageShort", { number: bm.pageNo })}
											</Text>
										)}
									</Pressable>
									<Pressable
										onPress={() => removeBookmark(bookIdNum, bm.pageId)}
										hitSlop={10}
									>
										<Icon
											name="X"
											size={15}
											className="text-muted-foreground"
										/>
									</Pressable>
								</View>
							))}
						</View>
					)}

					{book.blog.content && (
						<View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
							<Text
								style={[
									{
										textAlign: "right",
										fontSize: 14,
										lineHeight: 22,
										color: colors.mutedForeground,
									},
									{ writingDirection: "rtl" },
								]}
							>
								{book.blog.content}
							</Text>
						</View>
					)}

					<View style={{ paddingHorizontal: 16, marginBottom: 20, gap: 8 }}>
						{showFetchInput ? (
							<KeyboardAvoidingView
								behavior={Platform.OS === "ios" ? "padding" : undefined}
							>
								<View className="flex-row items-center gap-2 rounded-xl bg-card p-2.5">
									<TextInput
										value={fetchUrl}
										onChangeText={setFetchUrl}
										placeholder={t("pageLink")}
										placeholderTextColor={colors.mutedForeground}
										style={{
											flex: 1,
											color: colors.foreground,
											fontSize: 13,
											textAlign: "right",
										}}
										autoFocus
										returnKeyType="done"
									/>
									<Pressable
										onPress={() => {
											if (!fetchUrl.trim()) return;
											void openCaptureBrowser(fetchUrl.trim());
										}}
										className="rounded-lg bg-primary px-3.5 py-2"
									>
										{isFetching ? (
											<ActivityIndicator
												size="small"
												color={colors.primaryForeground}
											/>
										) : (
											<Text className="text-[13px] font-bold text-primary-foreground">
												{t("fetch")}
											</Text>
										)}
									</Pressable>
									<Pressable onPress={() => setShowFetchInput(false)}>
										<Icon
											name="X"
											size={18}
											className="text-muted-foreground"
										/>
									</Pressable>
								</View>
							</KeyboardAvoidingView>
						) : (
							<View style={{ gap: 8 }}>
								<View style={{ flexDirection: "row", gap: 8 }}>
									<Pressable
										onPress={() => setShowFetchInput(true)}
										className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5"
									>
										<Icon
											name="Download"
											size={16}
											className="text-background"
										/>
										<Text className="text-sm font-bold text-primary-foreground">
											{t("fetchPage")}
										</Text>
									</Pressable>

									{nextSourceUrl && (
										<Pressable
											onPress={() => {
												void openCaptureBrowser(nextSourceUrl);
											}}
											className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-card py-2.5"
										>
											{isFetching ? (
												<ActivityIndicator
													size="small"
													color={colors.primary}
												/>
											) : (
												<>
													<Icon
														name="ChevronRight"
														size={16}
														className="text-primary"
													/>
													<Text className="text-sm font-semibold text-primary">
														{nextPageCandidate?.status === "fetched"
															? t("next")
															: nextPageCandidate
																? `Import #${nextPageCandidate.shamelaPageNo}`
																: t("next")}
													</Text>
												</>
											)}
										</Pressable>
									)}
								</View>

								<Pressable
									onPress={downloadBookForOffline}
									disabled={isDownloadingBook}
									style={[
										{
											flexDirection: "row",
											alignItems: "center",
											justifyContent: "center",
											gap: 8,
											borderRadius: 12,
											backgroundColor: colors.card,
											paddingVertical: 10,
										},
										{ opacity: isDownloadingBook ? 0.65 : 1 },
									]}
								>
									{isDownloadingBook ? (
										<>
											<ActivityIndicator size="small" color={colors.primary} />
											<Text className="text-[13px] font-semibold text-primary">
												{Math.round(downloadProgress * 100)}%
											</Text>
										</>
									) : (
										<>
											<Icon
												name="Download"
												size={15}
												className="text-muted-foreground"
											/>
											<Text className="text-[13px] font-semibold text-muted-foreground">
												{t("downloadOffline")}
											</Text>
										</>
									)}
								</Pressable>
							</View>
						)}
					</View>

					{pageImportHistory?.length ? (
						<View style={{ paddingHorizontal: 16, marginBottom: 20, gap: 8 }}>
							<Text
								style={[
									{
										textAlign: "right",
										fontSize: 14,
										fontWeight: "700",
										color: colors.foreground,
									},
									{ writingDirection: "rtl" },
								]}
							>
								{t("history")}
							</Text>
							{pageImportHistory.map((entry) => (
								<View
									key={entry.id}
									style={[
										{
											borderRadius: 12,
											backgroundColor: colors.card,
											paddingHorizontal: 12,
											paddingVertical: 12,
										},
										{ gap: 6 },
									]}
								>
									<View className="flex-row items-center justify-between">
										<View
											className={
												entry.status === "success"
													? "rounded-full bg-primary/15 px-2 py-1"
													: entry.status === "failed"
														? "rounded-full bg-destructive/10 px-2 py-1"
														: "rounded-full bg-secondary px-2 py-1"
											}
										>
											<Text
												className={
													entry.status === "success"
														? "text-[11px] font-semibold text-primary"
														: entry.status === "failed"
															? "text-[11px] font-semibold text-destructive"
															: "text-[11px] font-semibold text-muted-foreground"
												}
											>
												{entry.status === "success"
													? t("importSuccess")
													: entry.status === "failed"
														? t("importFailed")
														: t("importPending")}
											</Text>
										</View>
										<Text className="text-[11px] text-muted-foreground">
											#{entry.id}
										</Text>
									</View>

									<Text
										style={[
											{
												textAlign: "right",
												fontSize: 13,
												fontWeight: "600",
												color: colors.foreground,
											},
											{ writingDirection: "rtl" },
										]}
									>
										{entry.chapterTitle ??
											entry.topicTitle ??
											`${t("page")} ${entry.shamelaPageNo ?? "-"}`}
									</Text>
									<Text
										style={[
											{
												textAlign: "right",
												fontSize: 12,
												color: colors.mutedForeground,
											},
											{ writingDirection: "rtl" },
										]}
									>
										{entry.importMethod === "manual_paste"
											? t("entryManual")
											: t("bookImportTitle")}
										{entry.paragraphCount
											? ` - ${t("paragraphCount", { count: entry.paragraphCount })}`
											: ""}
									</Text>
									{entry.errorMessage ? (
										<Text
											style={[
												{
													textAlign: "right",
													fontSize: 12,
													color: colors.destructive,
												},
												{ writingDirection: "rtl" },
											]}
										>
											{entry.errorMessage}
										</Text>
									) : null}

									{entry.sourceUrl ? (
										<Pressable
											onPress={() => {
												setFetchUrl(entry.sourceUrl ?? "");
												setShowFetchInput(true);
											}}
											className="items-center rounded-lg bg-background py-2"
										>
											<Text className="text-[12px] font-semibold text-primary">
												{t("reuseLink")}
											</Text>
										</Pressable>
									) : null}
								</View>
							))}
						</View>
					) : null}

					{isImportedBook ? (
						<Pressable
							onPress={() => router.push(`/books/${bookId}/chapters` as any)}
							className="mx-4 rounded-xl bg-card p-4"
						>
							<Text className="font-semibold text-primary">
								{t("searchChapters")}
							</Text>
							<Text className="mt-1 text-sm text-muted-foreground">
								Browse the chapter hierarchy and load more as you scroll.
							</Text>
						</Pressable>
					) : totalCount > 0 ? (
						<View style={{ paddingHorizontal: 14 }}>
							<View
								style={[
									{
										marginBottom: 12,
										flexDirection: "row-reverse",
										alignItems: "center",
										gap: 8,
										borderRadius: 12,
										backgroundColor: colors.card,
										paddingHorizontal: 12,
										paddingVertical: 10,
									},
									{ backgroundColor: colors.card },
								]}
							>
								<Icon
									name="Search"
									size={16}
									className="text-muted-foreground"
								/>
								<TextInput
									value={chapterQuery}
									onChangeText={setChapterQuery}
									placeholder={t("searchChapters")}
									placeholderTextColor={colors.mutedForeground}
									style={{
										flex: 1,
										color: colors.foreground,
										fontSize: 14,
										textAlign: "right",
										writingDirection: "rtl",
									}}
									returnKeyType="search"
								/>
								{chapterQuery.length > 0 ? (
									<Pressable onPress={() => setChapterQuery("")}>
										<Icon
											name="X"
											size={16}
											className="text-muted-foreground"
										/>
									</Pressable>
								) : null}
							</View>

							<View
								style={{
									flexDirection: "row-reverse",
									alignItems: "center",
									justifyContent: "space-between",
									marginBottom: 12,
								}}
							>
								<Text
									style={[
										{
											fontSize: 15,
											fontWeight: "700",
											color: colors.foreground,
										},
										{ writingDirection: "rtl" },
									]}
								>
									{t("index", { count: visibleChapterCount })}
								</Text>
								{fetchedCount > 0 && (
									<Text className="text-xs text-muted-foreground">
										{t("fetchedRemaining", {
											fetched: fetchedCount,
											remaining: totalCount - fetchedCount,
										})}
									</Text>
								)}
							</View>

							<ChapterTree
								pages={visiblePages}
								volumes={book.volumes}
								tocNodes={visibleTocNodes}
								fetchingPageId={fetchingPageId}
								onPagePress={(page) => {
									if (page.status === "fetched") {
										openReader(page.id);
									} else if (page.shamelaUrl && !fetchingPageId) {
										openCaptureBrowser(page.shamelaUrl);
									}
								}}
								onTocNodePress={(node) => {
									if (node.page?.status === "fetched" && node.page.id) {
										openReader(node.page.id);
										return;
									}
									const targetUrl =
										node.page?.shamelaUrl ??
										node.shamelaPath ??
										(book.shamelaId && node.shamelaPageNo
											? `https://shamela.ws/book/${book.shamelaId}/${node.shamelaPageNo}`
											: null);
									if (targetUrl) openCaptureBrowser(targetUrl);
								}}
							/>
						</View>
					) : null}
				</ScrollView>
			</SafeArea>
		</View>
	);
}
