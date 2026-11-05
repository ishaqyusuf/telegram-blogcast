import { useRenameAudio } from "@/hooks/use-rename-audio";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import { Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { BlogItem } from "@/components/blog-card";
import { AddToAlbumModal } from "@/components/channel-chat/add-to-album-modal";
import { AddToPlaylistModal } from "@/components/channel-chat/add-to-playlist-modal";
import { AudioRenameSheet } from "@/components/audio-blog-view/audio-rename-sheet";
import { _trpc } from "@/components/static-trpc";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Pressable } from "@/components/ui/pressable";
import { Icon, type IconKeys } from "@/components/ui/icon";
import { Toast } from "@/components/ui/toast";
import { useMutation, useQueryClient } from "@/lib/react-query";
import {
	invalidateAudioQueries,
	reconcileAudioMembership,
} from "@/lib/audio-membership-cache";
import { getAudioDisplayTitle } from "@/lib/audio-title";
import { getBlogShareUrl } from "@/lib/share-links";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { cacheMedia } from "@/lib/media-cache";
import { notifyAudioDownloadsChanged } from "@/lib/downloaded-audio";
import { useTranscriptionQueue } from "@/hooks/use-transcription-queue";

type Action = "menu" | "album" | "remove" | "playlist" | "rename" | "delete";
type Props = {
	posts: BlogItem[];
	onClose: () => void;
	onCompleted?: () => void;
	initialAction?: Action;
};

export function AudioActionsSheet({
	posts,
	onClose,
	onCompleted,
	initialAction = "menu",
}: Props) {
	const client = useQueryClient();
	const router = useRouter();
	const [action, setAction] = useState<Action>(initialAction);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState<string | null>(null);
	const running = useRef(false);
	const completedIds = useRef(new Map<string, Set<number>>());
	const remove = useMutation(_trpc.album.removeMembership.mutationOptions());
	const rename = useRenameAudio();
	const deletePosts = useMutation(
		_trpc.blog.deleteAudioPosts.mutationOptions(),
	);
	const transcription = useTranscriptionQueue(undefined, {
		reloadOnEnqueue: false,
		autoLoad: false,
	});
	const audioPosts = posts.filter(
		(post): post is BlogItem & { audio: NonNullable<BlogItem["audio"]> } =>
			!!post.audio?.mediaId,
	);
	const mediaIds = audioPosts.map((post) => post.audio.mediaId);
	const single = audioPosts.length === 1 ? audioPosts[0] : undefined;
	const hasMembership = audioPosts.some((post) => !!post.audio?.albumId);
	const busy =
		!!progress || remove.isPending || rename.isPending || deletePosts.isPending;
	function finish() {
		onCompleted?.();
		onClose();
	}
	async function execute(work: () => Promise<void>, complete = true) {
		if (running.current) return;
		running.current = true;
		setError(null);
		try {
			await work();
			if (complete) finish();
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "The action failed. Try again.",
			);
		} finally {
			running.current = false;
			setProgress(null);
		}
	}
	async function batch(kind: "download" | "transcribe") {
		await execute(async () => {
			const done = completedIds.current.get(kind) ?? new Set<number>();
			completedIds.current.set(kind, done);
			const failures: string[] = [];
			// One file/job at a time avoids exhausting device memory or the network.
			for (const post of audioPosts) {
				const audio = post.audio;
				if (done.has(audio.mediaId)) continue;
				setProgress(
					`${kind === "download" ? "Downloading" : "Queueing"} ${done.size + 1} of ${audioPosts.length}`,
				);
				try {
					if (kind === "transcribe")
						await transcription.enqueue({
							mediaId: audio.mediaId,
							telegramFileId: audio.telegramFileId,
							audioUrl: audio.url,
						});
					else {
						const url =
							audio.url ||
							(audio.telegramFileId
								? (await getTelegramFileUrl(audio.telegramFileId))?.url
								: null);
						if (!url) throw new Error("No downloadable file");
						await cacheMedia({
							kind: "audio",
							cacheKey: `media-${audio.mediaId}`,
							fileName: audio.fileName || `audio-${audio.mediaId}.mp3`,
							url,
							expectedSize: audio.size,
						});
						notifyAudioDownloadsChanged();
					}
					done.add(audio.mediaId);
				} catch (cause) {
					failures.push(
						`${getAudioDisplayTitle(post, "Audio")}: ${cause instanceof Error ? cause.message : "Failed"}`,
					);
				}
			}
			if (failures.length)
				throw new Error(
					`${done.size} completed; ${failures.length} failed. Retry continues only unfinished items.\n${failures[0]}`,
				);
			Toast.show(
				kind === "download"
					? "Audio downloaded"
					: "Audio queued for transcription",
				{ type: "success" },
			);
		});
	}
	function row(
		label: string,
		icon: IconKeys,
		onPress: () => void,
		danger = false,
	) {
		return (
			<Pressable
				disabled={busy}
				onPress={onPress}
				className="min-h-14 flex-row items-center gap-3 py-3"
			>
				<Icon
					name={icon}
					size={20}
					className={danger ? "text-destructive" : "text-primary"}
				/>
				<Text
					className={
						danger
							? "text-destructive font-semibold"
							: "text-foreground font-semibold"
					}
				>
					{label}
				</Text>
			</Pressable>
		);
	}
	if (action === "album")
		return (
			<AddToAlbumModal
				mediaIds={mediaIds}
				onClose={onClose}
				onAdded={() => onCompleted?.()}
			/>
		);
	if (action === "playlist")
		return <AddToPlaylistModal visible mediaIds={mediaIds} onClose={onClose} />;
	if (action === "rename" && single?.audio)
		return (
			<AudioRenameSheet
				visible
				originalTitle={getAudioDisplayTitle(single, "Audio")}
				currentOverride={single.audio.titleOverride}
				saving={rename.isPending}
				error={error}
				onErrorClear={() => setError(null)}
				onClose={onClose}
				onSave={(value) =>
					void execute(async () => {
						await rename.mutateAsync({
							mediaId: single.audio.mediaId,
							titleOverride: value,
						});
					})
				}
			/>
		);
	return (
		<FloatingBottomSheet
			visible
			onClose={() => {
				if (!busy) onClose();
			}}
			title={
				action === "remove"
					? "Remove from album?"
					: action === "delete"
						? "Delete audio posts?"
						: `${audioPosts.length} audio ${audioPosts.length === 1 ? "track" : "tracks"}`
			}
			accessibilityLabel="Audio actions"
			snapPoints={["75%"]}
			enableDynamicSizing={false}
			scrollableContent
		>
			<BottomSheetScrollView
				contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 28 }}
			>
				{error ? (
					<Text accessibilityRole="alert" className="text-destructive py-3">
						{error}
					</Text>
				) : null}
				{progress ? (
					<Text accessibilityLiveRegion="polite" className="text-primary py-3">
						{progress}
					</Text>
				) : null}
				{action === "remove" ? (
					<>
						<Text className="text-muted-foreground py-3">
							Remove {mediaIds.length} selected audio{" "}
							{mediaIds.length === 1 ? "track" : "tracks"} from their albums.
							The posts and audio files will remain.
						</Text>
						{row(
							busy ? "Removing…" : "Remove from album",
							"X",
							() =>
								void execute(async () => {
									await remove.mutateAsync({
										expectedMembership: audioPosts.map((post) => ({
											mediaId: post.audio.mediaId,
											albumId: post.audio.albumId ?? null,
										})),
									});
									await reconcileAudioMembership(client, mediaIds, null);
								}),
							true,
						)}
					</>
				) : action === "delete" ? (
					<>
						<Text className="text-muted-foreground py-3">
							Delete {audioPosts.length} selected posts from the library. To
							keep the posts and only change album membership, choose Remove
							from album.
						</Text>
						{row(
							busy ? "Deleting…" : "Delete posts",
							"Trash2",
							() =>
								void execute(async () => {
									await deletePosts.mutateAsync({
										ids: audioPosts.map((post) => post.id),
									});
									await invalidateAudioQueries(client);
								}),
							true,
						)}
					</>
				) : (
					<>
						{row(hasMembership ? "Change album" : "Add to album", "Plus", () =>
							setAction("album"),
						)}
						{single?.audio?.albumId
							? row("Open album", "Disc3", () => {
									onClose();
									router.push(`/albums/${single.audio.albumId}` as never);
								})
							: null}
						{hasMembership
							? row("Remove from album", "X", () => setAction("remove"), true)
							: null}
						{row("Add to playlist", "ListMusic", () => setAction("playlist"))}
						{row("Download", "Download", () => void batch("download"))}
						{row(
							"Share",
							"Share",
							() =>
								void execute(async () => {
									await Share.share({
										message: audioPosts
											.map((post) => getBlogShareUrl(post.id))
											.join("\n"),
									});
								}, false),
						)}
						{single
							? row("Rename audio", "Pencil", () => setAction("rename"))
							: null}
						{row("Transcribe", "Captions", () => void batch("transcribe"))}
						{row("Delete posts", "Trash2", () => setAction("delete"), true)}
					</>
				)}
				{row("Cancel", "X", onClose)}
			</BottomSheetScrollView>
		</FloatingBottomSheet>
	);
}
