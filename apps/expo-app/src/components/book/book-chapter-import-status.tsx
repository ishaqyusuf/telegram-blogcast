import { _trpc } from "@/components/static-trpc";
import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Text, View } from "react-native";
import { ChapterImportProgress } from "./chapter-import-progress";

const returnedImports = new Set<string>();

export function BookChapterImportStatus({
	bookId,
	pageId,
	hideCompleted = false,
}: { bookId: number; pageId?: number; hideCompleted?: boolean }) {
	const router = useRouter();
	const focused = useIsFocused();
	const query = useQuery(_trpc.bookChapter.bookState.queryOptions({ bookId }));
	const { refetch } = query;
	useFocusEffect(
		useCallback(() => {
			void refetch();
		}, [refetch]),
	);
	const book = query.data;
	if (!book?.shamelaId) return null;
	const job = book.chapterImports[0];
	const settled = !job || job.status === "complete";
	if (hideCompleted && book.tocStatus === "complete" && settled) return null;
	if (
		book.tocStatus === "complete" &&
		settled &&
		(!job || job.returnPageId === pageId)
	)
		return null;
	const returnPageId = pageId ?? job?.returnPageId ?? book.pages[0]?.id;
	if (!returnPageId) return null;
	const captureRoot = () =>
		router.push({
			pathname: "/book-fetch-browser",
			params: {
				bookId,
				returnPageId,
				url: `https://shamela.ws/book/${book.shamelaId}`,
			},
		} as any);
	const viewSavedPage = () => {
		const target = job?.returnPageId ?? returnPageId;
		if (target !== pageId)
			router.push(`/books/${bookId}/reader/${target}` as any);
	};
	return (
		<View className="px-4 py-2">
			{job?.status === "complete" ? (
				<Pressable onPress={viewSavedPage} className="rounded-xl bg-card p-3">
					<Text className="font-semibold text-primary">
						Chapters ready. View Saved Page
					</Text>
				</Pressable>
			) : null}
			{job && job.status !== "complete" ? (
				<ChapterImportProgress
					importId={job.id}
					enabled={focused}
					onViewPage={viewSavedPage}
					onComplete={() => {
						void refetch();
						const key = `${job.id}:${job.generation}`;
						if (focused && !returnedImports.has(key)) {
							returnedImports.add(key);
							viewSavedPage();
						}
					}}
				/>
			) : null}
			{!job || ["failed", "cancelled"].includes(job.status) ? (
				<Pressable onPress={captureRoot} className="rounded-xl bg-card p-3">
					<Text className="font-semibold text-primary">
						{job ? "Capture Chapters Again" : "Fetch Book Chapters"}
					</Text>
					<Text className="mt-1 text-sm text-muted-foreground">
						Your page is saved. Open the book root to finish its chapter tree.
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}
