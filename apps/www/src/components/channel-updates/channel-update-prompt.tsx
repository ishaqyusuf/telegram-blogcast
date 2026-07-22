"use client";

import {
	buildChannelUpdatePromptModel,
	isChannelUpdateSurface,
	isLocalChannelUpdateHost,
} from "@/lib/channel-update-prompt";
import { useTRPC } from "@/trpc/client";
import { Button } from "@acme/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@acme/ui/dialog";
import { useMutation, useQuery } from "@acme/ui/tanstack";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type SummaryChannel =
	RouterOutputs["channel"]["getUpdatePromptSummary"]["channels"][number];

const CHECKED_SESSION_KEY = "channel-updates:auto-check-completed";

function formatCount(value: number | null) {
	return value === null ? "Unknown" : new Intl.NumberFormat().format(value);
}

function channelStatus(channel: SummaryChannel) {
	if (!channel.canUpdate) return "Stored cursor unavailable";
	if (channel.delta === null) return "Update check available";
	if (channel.delta === 0) return "Up to date";
	return "Updates available";
}

function ChannelOption({
	channel,
	selected,
	onToggle,
}: {
	channel: SummaryChannel;
	selected: boolean;
	onToggle: () => void;
}) {
	const hasUpdates = channel.delta !== null && channel.delta > 0;

	return (
		<label
			className={`flex gap-3 rounded-xl border px-3 py-3 transition-colors ${
				channel.canUpdate
					? "cursor-pointer border-border hover:bg-muted/60"
					: "cursor-not-allowed border-border/60 opacity-55"
			}`}
		>
			<span
				className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${
					selected
						? "border-foreground bg-foreground text-background"
						: "border-border bg-background"
				}`}
			>
				{selected ? <Check aria-hidden="true" size={14} /> : null}
			</span>
			<input
				type="checkbox"
				checked={selected}
				disabled={!channel.canUpdate}
				onChange={onToggle}
				className="sr-only"
				aria-label={`Update ${channel.title ?? channel.username}`}
			/>
			<span className="min-w-0 flex-1">
				<span className="flex items-start justify-between gap-3">
					<span
						dir="auto"
						className="truncate text-sm font-medium text-foreground"
					>
						{channel.title ?? channel.username}
					</span>
					<span
						className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
							hasUpdates && channel.canUpdate
								? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
								: "bg-muted text-muted-foreground"
						}`}
					>
						{channelStatus(channel)}
					</span>
				</span>
				<span className="mt-1 block truncate text-xs text-muted-foreground">
					@{channel.username} · {formatCount(channel.storedCount)} saved
					{channel.latestKnownCount === null
						? ""
						: ` · ${formatCount(channel.latestKnownCount)} on Telegram`}
				</span>
			</span>
		</label>
	);
}

export function ChannelUpdatePrompt() {
	const pathname = usePathname();
	const router = useRouter();
	const trpc = useTRPC();
	const [shouldCheck, setShouldCheck] = useState(false);
	const [open, setOpen] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

	useEffect(() => {
		if (
			!isChannelUpdateSurface(pathname) ||
			!isLocalChannelUpdateHost(window.location.hostname)
		) {
			setShouldCheck(false);
			return;
		}
		if (sessionStorage.getItem(CHECKED_SESSION_KEY) === "true") return;
		setShouldCheck(true);
	}, [pathname]);

	const summaryQuery = useQuery(
		trpc.channel.getUpdatePromptSummary.queryOptions(undefined, {
			enabled: shouldCheck,
			retry: false,
			staleTime: 0,
		}),
	);

	const model = useMemo(
		() => buildChannelUpdatePromptModel(summaryQuery.data?.channels ?? []),
		[summaryQuery.data?.channels],
	);

	useEffect(() => {
		if (
			!shouldCheck ||
			!summaryQuery.data ||
			!isChannelUpdateSurface(pathname)
		) {
			return;
		}

		sessionStorage.setItem(CHECKED_SESSION_KEY, "true");
		setShouldCheck(false);
		setSelectedIds(new Set(model.selectedIds));
		if (summaryQuery.data.channels.length > 0) setOpen(true);
	}, [model.selectedIds, pathname, shouldCheck, summaryQuery.data]);

	useEffect(() => {
		if (!shouldCheck || !summaryQuery.error) return;
		setShouldCheck(false);
	}, [shouldCheck, summaryQuery.error]);

	const updateMutation = useMutation(
		trpc.channel.startRecentUpdateJob.mutationOptions({
			onSuccess(job) {
				setOpen(false);
				const query = job?.id ? `?updateJob=${encodeURIComponent(job.id)}` : "";
				router.push(`/dashboard${query}`);
			},
		}),
	);

	const toggleChannel = (channelId: number) => {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (next.has(channelId)) next.delete(channelId);
			else next.add(channelId);
			return next;
		});
	};

	const proceed = () => {
		const channelIds = Array.from(selectedIds);
		if (channelIds.length === 0 || updateMutation.isPending) return;
		updateMutation.mutate({ channelIds });
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden rounded-2xl border-border p-0 shadow-2xl">
				<DialogHeader className="border-b border-border px-6 py-5 pr-12 text-left">
					<div className="mb-3 flex size-9 items-center justify-center rounded-full bg-muted">
						<RefreshCw aria-hidden="true" size={17} />
					</div>
					<DialogTitle className="text-xl">Recent channel updates</DialogTitle>
					<DialogDescription className="leading-5">
						Choose which downloaded Telegram channels to refresh. Channels with
						new posts are selected for you.
					</DialogDescription>
				</DialogHeader>

				<div className="max-h-[52vh] space-y-5 overflow-y-auto px-6 py-5">
					{model.updated.length > 0 ? (
						<section className="space-y-2">
							<div className="flex items-center justify-between">
								<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Updates available
								</h3>
								<span className="text-xs text-muted-foreground">
									{model.updated.length} channel
									{model.updated.length === 1 ? "" : "s"}
								</span>
							</div>
							{model.updated.map((channel) => (
								<ChannelOption
									key={channel.channelId}
									channel={channel}
									selected={selectedIds.has(channel.channelId)}
									onToggle={() => toggleChannel(channel.channelId)}
								/>
							))}
						</section>
					) : (
						<div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
							No confirmed new posts. You can still check any downloaded channel
							below.
						</div>
					)}

					{model.other.length > 0 ? (
						<section className="space-y-2">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Other downloaded channels
							</h3>
							{model.other.map((channel) => (
								<ChannelOption
									key={channel.channelId}
									channel={channel}
									selected={selectedIds.has(channel.channelId)}
									onToggle={() => toggleChannel(channel.channelId)}
								/>
							))}
						</section>
					) : null}
				</div>

				<DialogFooter className="items-center gap-3 border-t border-border bg-muted/20 px-6 py-4 sm:justify-between sm:space-x-0">
					<p className="text-xs text-muted-foreground">
						{selectedIds.size} selected
					</p>
					<div className="flex w-full gap-2 sm:w-auto">
						<Button
							type="button"
							variant="outline"
							className="flex-1 rounded-lg sm:flex-none"
							onClick={() => setOpen(false)}
						>
							Not now
						</Button>
						<Button
							type="button"
							className="flex-1 rounded-lg sm:flex-none"
							disabled={selectedIds.size === 0 || updateMutation.isPending}
							onClick={proceed}
						>
							{updateMutation.isPending ? (
								<Loader2
									aria-hidden="true"
									className="mr-2 animate-spin"
									size={15}
								/>
							) : null}
							Proceed
						</Button>
					</div>
					{updateMutation.error ? (
						<p className="w-full text-xs text-destructive sm:text-right">
							{updateMutation.error.message}
						</p>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
