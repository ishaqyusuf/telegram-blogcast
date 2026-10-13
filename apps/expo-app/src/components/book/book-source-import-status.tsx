import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { BookSourceImportProgress, isSourceImportActive } from "./book-source-import-progress";

/** Latest provider import for a book, reconciled while the screen is active. */
export function BookSourceImportStatus({ bookId }: { bookId: number }) {
	const router = useRouter();
	const qc = useQueryClient();
	const [active, setActive] = useState(AppState.currentState === "active");
	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
		return () => subscription.remove();
	}, []);
	const query = useQuery(
		_trpc.bookSource.latestForBook.queryOptions(
			{ bookId },
			{
				enabled: active,
				refetchInterval: (state) => (active && isSourceImportActive(state.state.data) ? 2500 : false),
				refetchIntervalInBackground: false,
			},
		),
	);
	const update = useMutation(
		_trpc.bookSource.start.mutationOptions({
			onSettled: () => qc.invalidateQueries({ queryKey: _trpc.bookSource.latestForBook.queryKey({ bookId }) }),
		}),
	);
	const job = query.data;
	if (!job) return null;
	return (
		<View className="mx-4 mb-3 gap-2 rounded-xl border border-border bg-card px-4 py-3">
			{job.status === "complete" ? (
				<View className="flex-row items-center gap-3">
					<Text className="flex-1 text-[13px] text-muted-foreground">
						{`KetabOnline #${job.sourceBookId} · ${job.pagesSaved.toLocaleString()} page${job.pagesSaved === 1 ? "" : "s"} · ${job.chaptersSaved.toLocaleString()} chapter${job.chaptersSaved === 1 ? "" : "s"}`}
					</Text>
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ disabled: update.isPending }}
						disabled={update.isPending}
						onPress={() => update.mutate({ sourceBookId: job.sourceBookId })}
						className={update.isPending ? "py-1 opacity-50" : "py-1"}
					>
						<Text className="font-semibold text-primary">{update.isPending ? "Starting…" : "Update"}</Text>
					</Pressable>
				</View>
			) : (
				<BookSourceImportProgress job={job} onOpenPage={(book, page) => router.push(`/books/${book}/reader/${page}` as never)} />
			)}
			{update.error ? <Text className="text-[13px] text-destructive">{update.error.message}</Text> : null}
		</View>
	);
}
