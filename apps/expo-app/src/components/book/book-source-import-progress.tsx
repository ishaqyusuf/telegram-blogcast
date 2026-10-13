import { _trpc } from "@/components/static-trpc";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { notifyBookCacheChanged } from "@/lib/book-cache-events";
import { useMutation, useQueryClient } from "@/lib/react-query";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export type BookSourceImportView = NonNullable<RouterOutputs["bookSource"]["status"]>;

const ACTIVE = ["queued", "running"];

export const isSourceImportActive = (job?: Pick<BookSourceImportView, "status"> | null) =>
	Boolean(job && ACTIVE.includes(job.status));

const plural = (value: number, unit: string) => `${value.toLocaleString()} ${unit}${value === 1 ? "" : "s"}`;

/** Progress comes only from known counts per phase; no invented overall percentage. */
function describe(job: BookSourceImportView) {
	const count = (done: number, total: number | null) =>
		total ? `${done.toLocaleString()} / ${total.toLocaleString()}` : done.toLocaleString();
	switch (job.status) {
		case "complete":
			return { label: "Imported", detail: `${plural(job.pagesSaved, "page")} · ${plural(job.chaptersSaved, "chapter")}`, ratio: null };
		case "unavailable":
			return { label: "Text not available", detail: null, ratio: null };
		case "cancelled":
			return { label: "Import cancelled", detail: null, ratio: null };
		case "failed":
			return { label: job.phase === "chapters" ? "Chapters incomplete" : "Import paused", detail: null, ratio: null };
	}
	if (job.phase === "pages")
		return { label: "Saving pages", detail: count(job.pagesSaved, job.pagesTotal), ratio: job.pagesTotal ? job.pagesSaved / job.pagesTotal : null };
	if (job.phase === "chapters")
		return { label: "Saving chapters", detail: `Volumes ${count(job.volumesIndexed, job.volumesTotal)}`, ratio: job.volumesTotal ? job.volumesIndexed / job.volumesTotal : null };
	if (job.phase === "download") return { label: "Downloading text", detail: job.pagesTotal ? `${job.pagesTotal.toLocaleString()} pages` : null, ratio: null };
	if (job.phase === "metadata") return { label: "Reading book details", detail: null, ratio: null };
	return { label: "Waiting to start", detail: null, ratio: null };
}

export function BookSourceImportProgress({
	job,
	onOpenPage,
	onOpenBook,
}: {
	job: BookSourceImportView;
	onOpenPage?: (bookId: number, pageId: number) => void;
	onOpenBook?: (bookId: number) => void;
}) {
	const qc = useQueryClient();
	const colors = useColors();
	const notified = useRef<string | null>(null);
	const refresh = () => {
		qc.invalidateQueries({ queryKey: _trpc.bookSource.mine.queryKey() });
		qc.invalidateQueries({ queryKey: _trpc.bookSource.status.queryKey({ importId: job.id }) });
		if (job.bookId) qc.invalidateQueries({ queryKey: _trpc.bookSource.latestForBook.queryKey({ bookId: job.bookId }) });
	};
	const retry = useMutation(_trpc.bookSource.retry.mutationOptions({ onSettled: refresh }));
	const cancel = useMutation(_trpc.bookSource.cancel.mutationOptions({ onSettled: refresh }));

	useEffect(() => {
		if (job.status !== "complete" || !job.bookId) return;
		const identity = `${job.id}:${job.generation}`;
		if (notified.current === identity) return;
		notified.current = identity;
		// Readers and offline copies pick up the newly published text and chapters.
		notifyBookCacheChanged({ kind: "chapters", bookId: job.bookId });
		qc.invalidateQueries({ queryKey: _trpc.book.getBook.queryKey({ id: job.bookId }) });
		qc.invalidateQueries({ queryKey: _trpc.book.getBooks.queryKey() });
		// Search rows show an "In library" badge once the book exists locally.
		qc.invalidateQueries({ queryKey: _trpc.bookSource.search.queryKey() });
		qc.invalidateQueries({ queryKey: _trpc.bookChapter.tree.queryKey({ bookId: job.bookId }) });
	}, [job, qc]);

	const active = isSourceImportActive(job);
	const { label, detail, ratio } = describe(job);
	const failed = ["failed", "cancelled", "unavailable"].includes(job.status);
	const pending = retry.isPending || cancel.isPending;
	const error = retry.error?.message ?? cancel.error?.message;
	return (
		<View className="gap-2" accessibilityLiveRegion="polite">
			<View className="flex-row items-center gap-2">
				{active ? <ActivityIndicator size="small" /> : null}
				<Text className={failed ? "flex-1 text-sm font-semibold text-destructive" : "flex-1 text-sm font-semibold text-foreground"}>{label}</Text>
				{detail ? <Text className="text-xs tabular-nums text-muted-foreground">{detail}</Text> : null}
			</View>
			{active && ratio !== null ? (
				<View className="h-1.5 overflow-hidden rounded-full bg-border">
					<View style={{ height: "100%", borderRadius: 999, backgroundColor: colors.primary, width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
				</View>
			) : null}
			{job.errorMessage ? <Text className="text-[13px] leading-5 text-muted-foreground">{job.errorMessage}</Text> : null}
			{active && !job.errorMessage ? <Text className="text-[13px] text-muted-foreground">Continues if you leave this screen.</Text> : null}
			{error ? <Text className="text-[13px] text-destructive">{error}</Text> : null}
			<View className="flex-row flex-wrap gap-x-5">
				{job.firstPageId && job.bookId && onOpenPage ? (
					<Pressable accessibilityRole="button" onPress={() => onOpenPage(job.bookId!, job.firstPageId!)} className="py-2">
						<Text className="font-semibold text-primary">{job.status === "complete" ? "Read" : "Read saved pages"}</Text>
					</Pressable>
				) : null}
				{job.status === "complete" && job.bookId && onOpenBook ? (
					<Pressable accessibilityRole="button" onPress={() => onOpenBook(job.bookId!)} className="py-2">
						<Text className="font-semibold text-primary">Open book</Text>
					</Pressable>
				) : null}
				{failed && job.canManage && job.status !== "unavailable" ? (
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ disabled: pending }}
						disabled={pending}
						onPress={() => retry.mutate({ importId: job.id })}
						className={pending ? "py-2 opacity-50" : "py-2"}
					>
						<Text className="font-semibold text-primary">{retry.isPending ? "Retrying…" : "Retry"}</Text>
					</Pressable>
				) : null}
				{active && job.canManage ? (
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ disabled: pending }}
						disabled={pending}
						onPress={() => cancel.mutate({ importId: job.id })}
						className={pending ? "py-2 opacity-50" : "py-2"}
					>
						<Text className="text-muted-foreground">{cancel.isPending ? "Cancelling…" : "Cancel"}</Text>
					</Pressable>
				) : null}
			</View>
		</View>
	);
}
