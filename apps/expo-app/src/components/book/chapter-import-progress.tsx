import { _trpc } from "@/components/static-trpc";
import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";

export function ChapterImportProgress({
	importId,
	onComplete,
	onViewPage,
	enabled = true,
}: {
	importId: string;
	onComplete?: () => void;
	onViewPage?: () => void;
	enabled?: boolean;
}) {
	const qc = useQueryClient();
	const [active, setActive] = useState(AppState.currentState === "active");
	const notified = useRef<string | null>(null);
	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) =>
			setActive(state === "active"),
		);
		return () => subscription.remove();
	}, []);
	const query = useQuery(
		_trpc.bookChapter.status.queryOptions(
			{ importId },
			{
				enabled: active && enabled,
				refetchInterval: (query) =>
					active &&
					enabled &&
					(!query.state.data ||
						["queued", "running"].includes(query.state.data.status))
						? 2000
						: false,
				refetchIntervalInBackground: false,
			},
		),
	);
	const refresh = () =>
		qc.invalidateQueries({
			queryKey: _trpc.bookChapter.status.queryKey({ importId }),
		});
	const retry = useMutation(
		_trpc.bookChapter.retry.mutationOptions({ onSuccess: refresh }),
	);
	const cancel = useMutation(
		_trpc.bookChapter.cancel.mutationOptions({ onSuccess: refresh }),
	);
	const job = query.data;
	useEffect(() => {
		if (!job || job.status !== "complete") return;
		const identity = `${job.id}:${job.generation}`;
		if (notified.current === identity) return;
		notified.current = identity;
		qc.invalidateQueries({
			queryKey: _trpc.book.getBook.queryKey({ id: job.bookId }),
		});
		qc.invalidateQueries({
			queryKey: _trpc.bookChapter.latest.queryKey({ bookId: job.bookId }),
		});
		qc.invalidateQueries({ queryKey: _trpc.bookChapter.list.queryKey() });
		qc.invalidateQueries({
			queryKey: _trpc.bookChapter.bookState.queryKey({ bookId: job.bookId }),
		});
		onComplete?.();
	}, [job, onComplete, qc]);
	const running = !job || ["queued", "running"].includes(job.status);
	const failed = job && ["failed", "cancelled"].includes(job.status);
	return (
		<View className="gap-3 rounded-xl border border-border bg-card p-4">
			<View className="flex-row items-center gap-2">
				{running ? <ActivityIndicator /> : null}
				<Text className="flex-1 font-semibold text-foreground">
					{job?.status === "complete"
						? `${job.nodeCount.toLocaleString()} chapters ready`
						: failed
							? "Chapter import paused"
							: job?.status === "running"
								? "Processing chapters"
								: "Chapters queued"}
				</Text>
			</View>
			<Text className="text-sm text-muted-foreground">
				{job?.errorMessage ||
					(running
						? "Your page is saved. Import continues even if you close the app."
						: "Your saved page content and annotations are unchanged.")}
			</Text>
			{query.isError || retry.isError || cancel.isError ? (
				<Text className="text-sm text-destructive">
					{retry.error?.message ||
						cancel.error?.message ||
						"Unable to check progress. Reconnect and try again."}
				</Text>
			) : null}
			<View className="flex-row flex-wrap gap-4">
				{failed && job?.canManage ? (
					<Pressable
						disabled={retry.isPending}
						onPress={() => retry.mutate({ importId })}
						className="py-2"
					>
						<Text className="font-semibold text-primary">
							{retry.isPending ? "Retrying..." : "Retry Chapters"}
						</Text>
					</Pressable>
				) : null}
				{running && job?.canManage ? (
					<Pressable
						disabled={cancel.isPending}
						onPress={() => cancel.mutate({ importId })}
						className="py-2"
					>
						<Text className="text-muted-foreground">
							{cancel.isPending ? "Cancelling..." : "Cancel Import"}
						</Text>
					</Pressable>
				) : null}
				{query.isError ? (
					<Pressable onPress={() => query.refetch()} className="py-2">
						<Text className="text-primary">Refresh Status</Text>
					</Pressable>
				) : null}
				{onViewPage ? (
					<Pressable onPress={onViewPage} className="py-2">
						<Text className="font-semibold text-primary">View Saved Page</Text>
					</Pressable>
				) : null}
			</View>
		</View>
	);
}
