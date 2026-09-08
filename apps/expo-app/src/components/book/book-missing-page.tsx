import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useBookPageResource } from "@/hooks/use-book-page-resource";
import { BookReaderSkeleton } from "./book-reader-skeleton";

export function BookMissingPage({
	bookId,
	sourcePageNo,
	enabled,
}: { bookId: number; sourcePageNo: number; enabled: boolean }) {
	const resource = useBookPageResource({ bookId, sourcePageNo }, enabled);
	const qc = useQueryClient();
	const trpc = useTRPC();
	const ready = resource.load?.status === "ready";
	useEffect(() => {
		if (!ready || !enabled) return;
		void qc.invalidateQueries({
			queryKey: trpc.book.getReaderWindow.queryKey(),
		});
		void qc.invalidateQueries({ queryKey: trpc.book.getPage.queryKey() });
	}, [ready, enabled, qc, trpc]);
	return (
		<BookReaderSkeleton
			status={resource.load?.status}
			error={resource.error}
			onRetry={resource.retry}
			onShowSource={resource.showSource}
		/>
	);
}
