import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Animated,
	Clipboard,
	FlatList,
	KeyboardAvoidingView,
	Modal,
	PanResponder,
	Platform,
	ScrollView,
	Share,
	Text,
	TextInput,
	View,
	useWindowDimensions,
} from "react-native";

import { KaraokeTranscript } from "@/components/audio-blog-view/karaoke-transcript";
import { TranscriptReadMode } from "@/components/audio-blog-view/transcript-read-mode";
import {
	buildTranscriptDocument,
	normalizeTranscriptSegment,
	selectTranscriptSegment,
	type RawTranscriptSegment,
	type TranscriptSegmentData,
	type TranscriptTextSelection,
} from "@/components/audio-blog-view/transcript-timing";
import { BlogCard, type BlogItem } from "@/components/blog-card";
import { AddToPlaylistModal } from "@/components/channel-chat/add-to-playlist-modal";
import { useCommentsState } from "@/components/comments-sheet";
import { CommentInput } from "@/components/comments-sheet/comment-input";
import { CommentsAudioContext } from "@/components/comments-sheet/comments-audio-context";
import { CommentsHeader } from "@/components/comments-sheet/comments-header";
import { CommentsList } from "@/components/comments-sheet/comments-list";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { TranscriptionRequestModal } from "@/components/transcription-request-modal";
import { AnimatedMarquee } from "@/components/ui/animated-marquee";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Icon, type IconKeys } from "@/components/ui/icon";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top-button";
import { Toast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-color";
import { usePlayHistorySync } from "@/hooks/use-play-history-sync";
import { useScrollChrome } from "@/hooks/use-scroll-chrome";
import { useTranscriptionQueue } from "@/hooks/use-transcription-queue";
import { getAudioDisplayTitle } from "@/lib/audio-title";
import { uploadBlogMediaAsset, type BlobMediaUpload } from "@/lib/blob-upload";
import { getBlogShareUrl } from "@/lib/share-links";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { getMediaFileUrl } from "@/lib/media-source";
import {
	getDefaultTranscriberUrl,
	isHttpTranscriberUrl,
} from "@/lib/transcribe";
import { getTranscriptionBadgeState } from "@/lib/transcription-status";
import { withAlpha } from "@/lib/theme";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useAudioStore } from "@/store/audio-store";
import { useRecentlyViewedStore } from "@/store/recently-viewed-store";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";

// ── Constants ─────────────────────────────────────────────────────────────────

const ALBUM_COLORS = [
	"#1e40af",
	"#0f766e",
	"#b45309",
	"#4f46e5",
	"#be123c",
	"#0369a1",
];

function getInitials(name?: string | null) {
	if (!name) return "AL";
	return name
		.split(" ")
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("");
}

function albumColor(id?: number | null) {
	if (!id) return ALBUM_COLORS[0];
	return ALBUM_COLORS[id % ALBUM_COLORS.length];
}

function formatMs(ms: number) {
	const totalSec = Math.floor(ms / 1000);
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPercent(value: number) {
	return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

type Tab = "info" | "books";
const TRANSCRIPT_CHUNK_SEC = 30;
const TRANSCRIPT_PREFETCH_AT_SEC = 20;
const SAVED_TRANSCRIPT_WINDOW_SEC = 60;
const SAVED_TRANSCRIPT_PREFETCH_AT_SEC = 45;
const NEXT_CONTENT_PEEK_HEIGHT = 68;

type SavedTranscriptWindow = {
	mediaId: number;
	transcriptId: number | null;
	status: string | null;
	windowDurationSec: number;
	windowStartSec: number;
	windowEndSec: number;
	previousWindowStartSec: number | null;
	nextWindowStartSec: number | null;
	hasPrevious: boolean;
	hasNext: boolean;
	durationSec: number | null;
	segmentCount: number;
	maxEndSec: number;
	segments: RawTranscriptSegment[];
};

type RelatedAlbumSuggestion = {
	id: number;
	name: string;
	_count?: { medias?: number | null } | null;
	channel?: { title?: string | null; username?: string | null } | null;
};

function getTranscriptChunkStart(sec: number) {
	return (
		Math.floor(Math.max(0, sec) / TRANSCRIPT_CHUNK_SEC) * TRANSCRIPT_CHUNK_SEC
	);
}

function getSavedTranscriptWindowStart(sec: number) {
	return (
		Math.floor(Math.max(0, sec) / SAVED_TRANSCRIPT_WINDOW_SEC) *
		SAVED_TRANSCRIPT_WINDOW_SEC
	);
}

function RelatedAlbumSuggestionSheet({
	album,
	isAdding,
	onAdd,
	onDismiss,
}: {
	album: RelatedAlbumSuggestion;
	isAdding: boolean;
	onAdd: () => void;
	onDismiss: () => void;
}) {
	const colors = useColors();
	const albumAccent = albumColor(album.id);
	const channelLabel =
		album.channel?.title || album.channel?.username || "Same channel";

	return (
		<View
			style={{
				position: "absolute",
				left: 14,
				right: 14,
				bottom: 16,
				borderRadius: 18,
				backgroundColor: colors.card,
				borderWidth: 1,
				borderColor: colors.border,
				padding: 14,
				shadowColor: "#000",
				shadowOpacity: 0.22,
				shadowRadius: 18,
				shadowOffset: { width: 0, height: 8 },
				elevation: 10,
			}}
		>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
				<View
					style={{
						width: 46,
						height: 46,
						borderRadius: 12,
						backgroundColor: albumAccent,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
						{getInitials(album.name)}
					</Text>
				</View>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text
						style={{
							color: colors.mutedForeground,
							fontSize: 11,
							fontWeight: "800",
							textTransform: "uppercase",
						}}
					>
						Related album
					</Text>
					<Text
						numberOfLines={1}
						style={{
							color: colors.foreground,
							fontSize: 15,
							fontWeight: "800",
							textAlign: "right",
							marginTop: 2,
						}}
					>
						{album.name}
					</Text>
					<Text
						numberOfLines={1}
						style={{
							color: colors.mutedForeground,
							fontSize: 12,
							textAlign: "right",
							marginTop: 2,
						}}
					>
						{channelLabel} · {album._count?.medias ?? 0} tracks
					</Text>
				</View>
				<Pressable
					onPress={onDismiss}
					className="size-9 items-center justify-center rounded-full active:opacity-70"
					style={{ backgroundColor: colors.muted }}
				>
					<Icon name="X" size={16} className="text-muted-foreground" />
				</Pressable>
			</View>
			<Pressable
				onPress={onAdd}
				disabled={isAdding}
				style={{
					height: 44,
					borderRadius: 999,
					backgroundColor: colors.primary,
					alignItems: "center",
					justifyContent: "center",
					flexDirection: "row",
					gap: 8,
					marginTop: 12,
					opacity: isAdding ? 0.65 : 1,
				}}
			>
				{isAdding ? (
					<ActivityIndicator size="small" color={colors.primaryForeground} />
				) : (
					<Icon name="Plus" size={17} className="text-primary-foreground" />
				)}
				<Text
					style={{
						color: colors.primaryForeground,
						fontSize: 14,
						fontWeight: "800",
					}}
				>
					Add to album
				</Text>
			</Pressable>
		</View>
	);
}

function AudioBookReferences({
	mediaId,
	albumId,
}: {
	mediaId: number;
	albumId?: number | null;
}) {
	const colors = useColors();
	const router = useRouter();
	const qc = useQueryClient();
	const position = useAudioStore((s) => s.position);
	const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
	const [pageSearch, setPageSearch] = useState("");
	const [pageIdInput, setPageIdInput] = useState("");
	const [note, setNote] = useState("");

	const { data: references = [] } = useQuery(
		_trpc.album.getMediaBookPageReferences.queryOptions({ mediaId }),
	);
	const { data: album } = useQuery({
		..._trpc.album.getAlbum.queryOptions({ id: albumId ?? 0 }),
		enabled: Number.isFinite(albumId) && Number(albumId) > 0,
	});
	const { data: booksData } = useQuery(
		_trpc.book.getBooks.queryOptions({ limit: 20 }),
	);
	const searchText = pageSearch.trim();
	const { data: pageMatches = [], isFetching: isSearchingPages } = useQuery({
		..._trpc.book.searchBookContent.queryOptions({
			bookId: selectedBookId ?? 0,
			query: searchText || " ",
		}),
		enabled: !!selectedBookId && searchText.length >= 2,
	});
	const mediaReferences = Array.isArray(references) ? references : [];
	const attachedBooks = useMemo(() => {
		const refs = Array.isArray((album as any)?.bookReferences)
			? ((album as any).bookReferences as any[])
			: [];
		return refs.map((reference) => reference.book).filter((book) => book?.id);
	}, [album]);
	const libraryBooks = useMemo(
		() =>
			Array.isArray((booksData as any)?.data)
				? ((booksData as any).data as any[])
				: [],
		[booksData],
	);
	const candidateBooks = useMemo(
		() => (attachedBooks.length > 0 ? attachedBooks : libraryBooks.slice(0, 8)),
		[attachedBooks, libraryBooks],
	);
	const searchResults = Array.isArray(pageMatches) ? pageMatches : [];

	useEffect(() => {
		if (candidateBooks.length === 0) return;
		if (
			selectedBookId &&
			candidateBooks.some((book: any) => book.id === selectedBookId)
		) {
			return;
		}
		setSelectedBookId(candidateBooks[0].id);
	}, [candidateBooks, selectedBookId]);

	const { mutate: addReference, isPending } = useMutation(
		_trpc.album.addMediaBookPageReference.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: _trpc.album.getMediaBookPageReferences.queryKey({
						mediaId,
					}),
				});
				setPageIdInput("");
				setPageSearch("");
				setNote("");
			},
			onError: (e) => Alert.alert("Error", e.message),
		}),
	);
	const { mutate: deleteReference, isPending: isDeletingReference } =
		useMutation(
			_trpc.album.deleteMediaBookPageReference.mutationOptions({
				onSuccess: () => {
					qc.invalidateQueries({
						queryKey: _trpc.album.getMediaBookPageReferences.queryKey({
							mediaId,
						}),
					});
				},
				onError: (e) => Alert.alert("Error", e.message),
			}),
		);

	const pageId = Number(pageIdInput.trim());
	const canAttach = Number.isFinite(pageId) && pageId > 0;
	const attachPage = (targetPageId: number, targetBookId?: number | null) => {
		addReference({
			mediaId,
			bookId: targetBookId ?? undefined,
			pageId: targetPageId,
			startSec: Math.floor(position / 1000),
			note: note.trim() || undefined,
		});
	};

	return (
		<View style={{ gap: 10, marginTop: 14 }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<Text
					style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}
				>
					Book pages
				</Text>
				<Text style={{ fontSize: 12, color: colors.mutedForeground }}>
					{mediaReferences.length} refs
				</Text>
			</View>

			{mediaReferences.map((reference: any) => (
				<View
					key={reference.id}
					style={{
						flexDirection: "row-reverse",
						alignItems: "center",
						gap: 9,
						borderRadius: 12,
						backgroundColor: colors.card,
						paddingHorizontal: 12,
						paddingVertical: 10,
					}}
				>
					<Pressable
						onPress={() =>
							router.push(
								`/books/${reference.bookId}/reader/${reference.pageId}?referenceId=${reference.id}&mediaId=${mediaId}${
									reference.startSec != null
										? `&seekSec=${reference.startSec}`
										: ""
								}` as any,
							)
						}
						style={{
							flex: 1,
							flexDirection: "row-reverse",
							alignItems: "center",
							gap: 9,
						}}
					>
						<Icon name="BookOpen" size={16} className="text-primary" />
						<View style={{ flex: 1 }}>
							<Text
								style={{
									fontSize: 13,
									fontWeight: "700",
									color: colors.foreground,
									textAlign: "right",
									writingDirection: "rtl",
								}}
								numberOfLines={1}
							>
								{reference.page?.chapterTitle ??
									reference.page?.topicTitle ??
									reference.book?.nameAr ??
									"Book page"}
							</Text>
							<Text
								style={{
									fontSize: 11,
									color: colors.mutedForeground,
									textAlign: "right",
								}}
							>
								{reference.startSec != null
									? formatMs(reference.startSec * 1000)
									: "No timestamp"}
							</Text>
						</View>
					</Pressable>
					<Pressable
						disabled={isDeletingReference}
						onPress={() => deleteReference({ id: reference.id })}
						style={{
							width: 30,
							height: 30,
							borderRadius: 15,
							alignItems: "center",
							justifyContent: "center",
							opacity: isDeletingReference ? 0.45 : 1,
						}}
					>
						<Icon name="Trash2" size={14} className="text-muted-foreground" />
					</Pressable>
				</View>
			))}

			{mediaReferences.length === 0 ? (
				<View
					style={{
						borderRadius: 12,
						backgroundColor: colors.card,
						padding: 12,
					}}
				>
					<Text
						style={{
							fontSize: 12,
							color: colors.mutedForeground,
							textAlign: "center",
						}}
					>
						No book pages referenced yet.
					</Text>
				</View>
			) : null}

			<View
				style={{
					gap: 8,
					borderRadius: 12,
					backgroundColor: colors.card,
					padding: 12,
				}}
			>
				{candidateBooks.length > 0 && (
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ gap: 8 }}
					>
						{candidateBooks.map((book: any) => {
							const selected = selectedBookId === book.id;
							return (
								<Pressable
									key={book.id}
									onPress={() => setSelectedBookId(book.id)}
									style={{
										maxWidth: 180,
										borderRadius: 999,
										backgroundColor: selected
											? colors.primary
											: colors.background,
										borderWidth: 1,
										borderColor: selected ? colors.primary : colors.border,
										paddingHorizontal: 12,
										paddingVertical: 8,
									}}
								>
									<Text
										style={{
											color: selected
												? colors.primaryForeground
												: colors.foreground,
											fontSize: 12,
											fontWeight: "700",
											textAlign: "right",
											writingDirection: "rtl",
										}}
										numberOfLines={1}
									>
										{book.nameAr ?? book.nameEn ?? "Book"}
									</Text>
								</Pressable>
							);
						})}
					</ScrollView>
				)}

				<TextInput
					value={pageSearch}
					onChangeText={setPageSearch}
					placeholder="Search page title or text"
					placeholderTextColor={colors.mutedForeground}
					style={{
						borderRadius: 10,
						backgroundColor: colors.background,
						borderWidth: 1,
						borderColor: colors.border,
						color: colors.foreground,
						paddingHorizontal: 12,
						paddingVertical: 9,
					}}
				/>
				{isSearchingPages ? (
					<ActivityIndicator size="small" color={colors.primary} />
				) : null}
				{searchResults.slice(0, 6).map((result: any) => (
					<Pressable
						key={result.pageId}
						disabled={isPending}
						onPress={() => attachPage(result.pageId, selectedBookId)}
						style={{
							flexDirection: "row-reverse",
							alignItems: "center",
							gap: 8,
							borderRadius: 10,
							backgroundColor: colors.background,
							borderWidth: 1,
							borderColor: colors.border,
							paddingHorizontal: 10,
							paddingVertical: 9,
							opacity: isPending ? 0.55 : 1,
						}}
					>
						<Icon name="Plus" size={14} className="text-primary" />
						<View style={{ flex: 1 }}>
							<Text
								style={{
									color: colors.foreground,
									fontSize: 12,
									fontWeight: "700",
									textAlign: "right",
									writingDirection: "rtl",
								}}
								numberOfLines={1}
							>
								{result.chapterTitle ??
									result.topicTitle ??
									`Page ${result.shamelaPageNo}`}
							</Text>
							<Text
								style={{
									color: colors.mutedForeground,
									fontSize: 11,
									textAlign: "right",
									writingDirection: "rtl",
								}}
								numberOfLines={1}
							>
								{result.snippet ?? `Shamela page ${result.shamelaPageNo}`}
							</Text>
						</View>
					</Pressable>
				))}

				<TextInput
					value={pageIdInput}
					onChangeText={setPageIdInput}
					placeholder="Or enter book page id"
					placeholderTextColor={colors.mutedForeground}
					keyboardType="number-pad"
					style={{
						borderRadius: 10,
						backgroundColor: colors.background,
						borderWidth: 1,
						borderColor: colors.border,
						color: colors.foreground,
						paddingHorizontal: 12,
						paddingVertical: 9,
					}}
				/>
				<TextInput
					value={note}
					onChangeText={setNote}
					placeholder="Optional note"
					placeholderTextColor={colors.mutedForeground}
					style={{
						borderRadius: 10,
						backgroundColor: colors.background,
						borderWidth: 1,
						borderColor: colors.border,
						color: colors.foreground,
						paddingHorizontal: 12,
						paddingVertical: 9,
					}}
				/>
				<Pressable
					disabled={!canAttach || isPending}
					onPress={() => attachPage(pageId)}
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "center",
						gap: 8,
						borderRadius: 999,
						backgroundColor: colors.primary,
						paddingVertical: 10,
						opacity: !canAttach || isPending ? 0.45 : 1,
					}}
				>
					{isPending ? (
						<ActivityIndicator size="small" color={colors.primaryForeground} />
					) : (
						<Icon
							name="BookOpen"
							size={15}
							className="text-primary-foreground"
						/>
					)}
					<Text
						style={{
							fontSize: 13,
							fontWeight: "700",
							color: colors.primaryForeground,
						}}
					>
						Attach current time to page
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

// ── Player controls ───────────────────────────────────────────────────────────

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0] as const;
const SLEEP_OPTIONS = [5, 10, 15, 30, 45, 60] as const;

function AnimatedPlayButton({
	isPlaying,
	isLoading,
	isDownloading,
	downloadProgress,
	onPress,
	size = 64,
}: {
	isPlaying: boolean;
	isLoading: boolean;
	isDownloading: boolean;
	downloadProgress: number;
	onPress: () => void;
	size?: number;
}) {
	const colors = useColors();
	const pulse = useRef(new Animated.Value(0)).current;
	const busy = isLoading || isDownloading;

	useEffect(() => {
		if (!busy) {
			pulse.stopAnimation();
			pulse.setValue(0);
			return;
		}

		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(pulse, {
					toValue: 1,
					duration: 650,
					useNativeDriver: true,
				}),
				Animated.timing(pulse, {
					toValue: 0,
					duration: 650,
					useNativeDriver: true,
				}),
			]),
		);
		loop.start();
		return () => loop.stop();
	}, [busy, pulse]);

	const scale = pulse.interpolate({
		inputRange: [0, 1],
		outputRange: [1, 1.08],
	});
	const opacity = pulse.interpolate({
		inputRange: [0, 1],
		outputRange: [0.18, 0.36],
	});
	const progress = isLoading ? 0 : downloadProgress;

	return (
		<Pressable
			onPress={onPress}
			disabled={isLoading}
			className="items-center justify-center active:opacity-90"
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: colors.primary,
				opacity: isLoading ? 0.92 : 1,
			}}
		>
			{busy ? (
				<Animated.View
					pointerEvents="none"
					style={{
						position: "absolute",
						width: size + 12,
						height: size + 12,
						borderRadius: (size + 12) / 2,
						backgroundColor: colors.primary,
						opacity,
						transform: [{ scale }],
					}}
				/>
			) : null}
			{busy ? (
				<View
					pointerEvents="none"
					style={{
						position: "absolute",
						top: 4,
						right: 4,
						bottom: 4,
						left: 4,
						borderRadius: size / 2,
						borderWidth: 3,
						borderColor: "rgba(0,0,0,0.18)",
						overflow: "hidden",
					}}
				>
					<View
						style={{
							position: "absolute",
							left: 0,
							bottom: 0,
							width: "100%",
							height: `${Math.max(8, progress * 100)}%`,
							backgroundColor: "rgba(0,0,0,0.22)",
						}}
					/>
				</View>
			) : null}
			{busy ? (
				<View style={{ alignItems: "center", gap: size >= 60 ? 2 : 0 }}>
					<ActivityIndicator color={colors.primaryForeground} />
					{isDownloading && size >= 60 ? (
						<Text
							style={{
								color: colors.primaryForeground,
								fontSize: 10,
								fontWeight: "800",
								lineHeight: 12,
							}}
						>
							{formatPercent(downloadProgress)}
						</Text>
					) : null}
				</View>
			) : (
				<Icon
					name={isPlaying ? "Pause" : "Play"}
					size={size >= 60 ? 28 : 22}
					className="text-primary-foreground"
				/>
			)}
		</Pressable>
	);
}

function SleepTimerModal({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const colors = useColors();
	const setSleepTimer = useAudioStore((s) => s.setSleepTimer);
	const clearSleepTimer = useAudioStore((s) => s.clearSleepTimer);
	const sleepTimerEnd = useAudioStore((s) => s.sleepTimerEnd);
	const isActive = sleepTimerEnd != null && sleepTimerEnd > Date.now();
	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
		>
			<Pressable
				style={{
					flex: 1,
					backgroundColor: "rgba(0,0,0,0.6)",
					justifyContent: "flex-end",
				}}
				onPress={onClose}
			>
				<Pressable
					onPress={() => {}}
					style={{
						backgroundColor: colors.card,
						borderTopLeftRadius: 20,
						borderTopRightRadius: 20,
						padding: 20,
						gap: 4,
					}}
				>
					<View
						style={{
							width: 36,
							height: 4,
							backgroundColor: colors.muted,
							borderRadius: 2,
							alignSelf: "center",
							marginBottom: 12,
						}}
					/>
					<Text
						style={{
							fontSize: 16,
							fontWeight: "700",
							color: colors.foreground,
							textAlign: "center",
							marginBottom: 12,
						}}
					>
						Sleep timer
					</Text>
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							justifyContent: "space-around",
							gap: 8,
						}}
					>
						{SLEEP_OPTIONS.map((min) => (
							<Pressable
								key={min}
								onPress={() => {
									setSleepTimer(min);
									onClose();
								}}
								style={{
									paddingHorizontal: 20,
									paddingVertical: 12,
									borderRadius: 12,
									backgroundColor: colors.muted,
									minWidth: 70,
									alignItems: "center",
								}}
							>
								<Text
									style={{
										fontSize: 14,
										fontWeight: "700",
										color: colors.mutedForeground,
									}}
								>
									{min} min
								</Text>
							</Pressable>
						))}
					</View>
					{isActive && (
						<Pressable
							onPress={() => {
								clearSleepTimer();
								onClose();
							}}
							style={{
								marginTop: 12,
								paddingVertical: 12,
								borderRadius: 12,
								backgroundColor: "rgba(239,68,68,0.12)",
								alignItems: "center",
							}}
						>
							<Text
								style={{ color: "#ef4444", fontWeight: "700", fontSize: 14 }}
							>
								Cancel timer
							</Text>
						</Pressable>
					)}
					<View style={{ height: 16 }} />
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function PlayerSection({
	theme = "light",
	isActiveAudio,
	isPlaying,
	position,
	duration,
	isLoading,
	isDownloading,
	downloadProgress,
	onPlayPause,
	onSeek,
	onPlusPress,
	onReadPress,
}: {
	theme?: "light" | "dark";
	isActiveAudio: boolean;
	isPlaying: boolean;
	position: number;
	duration: number;
	isLoading: boolean;
	isDownloading: boolean;
	downloadProgress: number;
	onPlayPause: () => void;
	onSeek?: (positionMillis: number) => void | Promise<void>;
	onPlusPress?: () => void;
	onReadPress?: () => void;
}) {
	const colors = useColors();
	const playbackRate = useAudioStore((s) => s.playbackRate);
	const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);
	const canSeek = isActiveAudio && Boolean(onSeek) && duration > 0;

	const fgColor = theme === "dark" ? "#ffffff" : colors.foreground;
	const mutedFgColor =
		theme === "dark" ? "rgba(255,255,255,0.7)" : colors.mutedForeground;
	const trackBgColor =
		theme === "dark" ? "rgba(255,255,255,0.2)" : colors.muted;

	const cycleSpeed = () => {
		const idx = SPEED_OPTIONS.findIndex(
			(r) => Math.abs(playbackRate - r) < 0.01,
		);
		const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]!;
		setPlaybackRate(next);
	};
	const [trackWidth, setTrackWidth] = useState(0);
	// Label ms — updated via Animated listener, drives only the two Text nodes
	const [labelMs, setLabelMs] = useState(position);

	// Animated value (0–1) drives fill + knob natively, no React re-renders during drag
	const progressAnim = useRef(new Animated.Value(0)).current;
	const isDragging = useRef(false);
	const dragValueRef = useRef(0);

	// Refs to avoid stale closures inside PanResponder
	const trackWidthRef = useRef(0);
	const trackRef = useRef<View>(null);
	const trackPageXRef = useRef(0);
	const hasTrackPageXRef = useRef(false);
	const durationRef = useRef(duration);
	const seekRef = useRef(onSeek);
	const canSeekRef = useRef(canSeek);
	useEffect(() => {
		durationRef.current = duration;
	}, [duration]);
	useEffect(() => {
		seekRef.current = onSeek;
	}, [onSeek]);
	useEffect(() => {
		canSeekRef.current = canSeek;
	}, [canSeek]);

	const syncTrackPageX = useCallback(() => {
		trackRef.current?.measureInWindow((x) => {
			trackPageXRef.current = x;
			hasTrackPageXRef.current = true;
		});
	}, []);

	const getGestureProgress = useCallback((evt: any) => {
		const w = trackWidthRef.current;
		if (!w) return null;

		const pageX = evt?.nativeEvent?.pageX;
		const localX =
			typeof pageX === "number" && hasTrackPageXRef.current
				? pageX - trackPageXRef.current
				: (evt?.nativeEvent?.locationX ?? 0);

		return Math.max(0, Math.min(1, localX / w));
	}, []);

	// Sync store position → animated value when not dragging
	useEffect(() => {
		if (!isDragging.current) {
			const p = duration > 0 ? position / duration : 0;
			progressAnim.setValue(p);
			setLabelMs(position);
		}
	}, [position, duration, progressAnim]);

	// Listen to animated value changes → update time labels (only 2 Text nodes re-render)
	useEffect(() => {
		const id = progressAnim.addListener(({ value }) => {
			setLabelMs(value * durationRef.current);
		});
		return () => progressAnim.removeListener(id);
	}, [progressAnim]);

	// Interpolated pixel positions — recalculated only when trackWidth changes
	const KNOB = 22;
	const fillWidth = useMemo(
		() =>
			progressAnim.interpolate({
				inputRange: [0, 1],
				outputRange: [0, trackWidth],
			}),
		[progressAnim, trackWidth],
	);
	const knobLeft = useMemo(
		() =>
			progressAnim.interpolate({
				inputRange: [0, 1],
				outputRange: [-(KNOB / 2), trackWidth - KNOB / 2],
			}),
		[progressAnim, trackWidth],
	);

	const seekPanResponder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => canSeekRef.current,
			onMoveShouldSetPanResponder: () => canSeekRef.current,
			onPanResponderGrant: (evt) => {
				if (!canSeekRef.current) return;
				syncTrackPageX();
				const p = getGestureProgress(evt);
				if (p == null) return;
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
				isDragging.current = true;
				useAudioStore.setState({ isSeeking: true });
				dragValueRef.current = p;
				setLabelMs(p * durationRef.current);
				progressAnim.setValue(p);
			},
			onPanResponderMove: (evt) => {
				if (!canSeekRef.current) return;
				const p = getGestureProgress(evt);
				if (p == null) return;
				dragValueRef.current = p;
				setLabelMs(p * durationRef.current);
				progressAnim.setValue(p);
			},
			onPanResponderRelease: () => {
				if (!canSeekRef.current) {
					isDragging.current = false;
					useAudioStore.setState({ isSeeking: false });
					return;
				}
				const d = durationRef.current;
				const seek = seekRef.current;
				if (!seek || d <= 0) {
					isDragging.current = false;
					useAudioStore.setState({ isSeeking: false });
					return;
				}

				const targetPosition = Math.max(0, Math.min(d, dragValueRef.current * d));
				void Promise.resolve(seek(targetPosition))
					.catch(() => undefined)
					.finally(() => {
						isDragging.current = false;
					});
				// Store isSeeking is cleared by seek() after native seek resolves.
			},
			onPanResponderTerminate: () => {
				isDragging.current = false;
				useAudioStore.setState({ isSeeking: false });
			},
		}),
	).current;

	return (
		<View className="gap-4">
			{/* Scrubber */}
			<View style={{ paddingTop: 4, paddingBottom: 2 }}>
				<View
					ref={trackRef}
					onLayout={(e) => {
						trackWidthRef.current = e.nativeEvent.layout.width;
						setTrackWidth(e.nativeEvent.layout.width);
						requestAnimationFrame(syncTrackPageX);
					}}
					style={{
						height: 42,
						justifyContent: "center",
						position: "relative",
					}}
					{...seekPanResponder.panHandlers}
				>
					<View
						pointerEvents="none"
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							height: 5,
							borderRadius: 9999,
							overflow: "hidden",
							backgroundColor:
								theme === "dark" ? "rgba(255,255,255,0.24)" : trackBgColor,
						}}
					/>
					<Animated.View
						pointerEvents="none"
						style={{
							position: "absolute",
							left: 0,
							height: 5,
							backgroundColor: theme === "dark" ? "#ffffff" : colors.primary,
							borderRadius: 9999,
							width: fillWidth,
						}}
					/>
					{trackWidth > 0 && (
						<Animated.View
							style={{
								position: "absolute",
								width: KNOB,
								height: KNOB,
								backgroundColor: "#ffffff",
								borderRadius: 9999,
								borderWidth: theme === "dark" ? 0 : 2,
								borderColor: colors.primary,
								shadowColor: "#000",
								shadowOffset: { width: 0, height: 2 },
								shadowOpacity: 0.24,
								shadowRadius: 4,
								elevation: 4,
								zIndex: 20,
								left: knobLeft,
							}}
						/>
					)}
				</View>
				<View
					style={{
						flexDirection: "row",
						justifyContent: "space-between",
						marginTop: -4,
					}}
				>
					<Text
						style={{ color: mutedFgColor, fontSize: 12, fontWeight: "500" }}
					>
						{formatMs(labelMs)}
					</Text>
					<Text
						style={{ color: mutedFgColor, fontSize: 12, fontWeight: "500" }}
					>
						-{formatMs(Math.max(0, duration - labelMs))}
					</Text>
				</View>
			</View>

			{/* Controls */}
			<View className="flex-row items-center justify-between">
				<View className="flex-row items-center gap-2">
					<Pressable
						onPress={onReadPress}
						className="size-10 items-center justify-center rounded-full active:opacity-70"
						disabled={!onReadPress}
						style={{
							backgroundColor: trackBgColor,
							opacity: onReadPress ? 1 : 0.45,
						}}
					>
						<Icon name="BookOpen" size={20} color={mutedFgColor} />
					</Pressable>
					<Pressable
						onPress={cycleSpeed}
						className="rounded-md px-2 py-1 active:opacity-70"
						style={{ backgroundColor: trackBgColor }}
					>
						<Text
							style={{ fontSize: 12, fontWeight: "700", color: mutedFgColor }}
						>
							{playbackRate}x
						</Text>
					</Pressable>
				</View>
				<View className="flex-row items-center gap-6">
					<Pressable
						className="p-2 active:opacity-50"
						disabled={!canSeek}
						onPress={() => onSeek?.(Math.max(0, position - 5000))}
						style={{ opacity: canSeek ? 1 : 0.45 }}
					>
						<Icon name="Backward5" size={32} color={fgColor} />
					</Pressable>
					<AnimatedPlayButton
						isPlaying={isPlaying}
						isLoading={isLoading}
						isDownloading={isDownloading}
						downloadProgress={downloadProgress}
						onPress={onPlayPause}
					/>
					<Pressable
						className="p-2 active:opacity-50"
						disabled={!canSeek}
						onPress={() => onSeek?.(Math.min(duration, position + 5000))}
						style={{ opacity: canSeek ? 1 : 0.45 }}
					>
						<Icon name="Forward5" size={32} color={fgColor} />
					</Pressable>
				</View>
				{onPlusPress ? (
					<Pressable className="p-2 active:opacity-50" onPress={onPlusPress}>
						<Icon name="Plus" size={22} color={mutedFgColor} />
					</Pressable>
				) : (
					<View style={{ width: 38 }} />
				)}
			</View>
		</View>
	);
}

function FloatingPlayerWidget({
	visible,
	isActiveAudio,
	isPlaying,
	position,
	duration,
	isLoading,
	isDownloading,
	downloadProgress,
	onPlayPause,
	onSeek,
	onPlusPress,
}: {
	visible: boolean;
	isActiveAudio: boolean;
	isPlaying: boolean;
	position: number;
	duration: number;
	isLoading: boolean;
	isDownloading: boolean;
	downloadProgress: number;
	onPlayPause: () => void;
	onSeek?: (positionMillis: number) => void;
	onPlusPress?: () => void;
}) {
	const colors = useColors();
	const playbackRate = useAudioStore((s) => s.playbackRate);
	const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);
	const canSeek = isActiveAudio && Boolean(onSeek) && duration > 0;

	const cycleSpeed = () => {
		const idx = SPEED_OPTIONS.findIndex(
			(rate) => Math.abs(playbackRate - rate) < 0.01,
		);
		const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]!;
		setPlaybackRate(next);
	};

	if (!visible) return null;

	return (
		<View
			pointerEvents="box-none"
			style={{
				position: "absolute",
				left: 16,
				right: 16,
				bottom: 16,
			}}
		>
			<View className="overflow-hidden rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-2xl">
				<View className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
					<View
						style={{
							width: `${duration > 0 ? (position / duration) * 100 : 0}%`,
							height: "100%",
							backgroundColor: colors.primary,
						}}
					/>
				</View>
				<View className="flex-row items-center justify-between">
					<Pressable
						onPress={cycleSpeed}
						className="rounded-md bg-muted px-2 py-1 active:opacity-70"
					>
						<Text
							style={{
								color: colors.mutedForeground,
								fontSize: 12,
								fontWeight: "800",
							}}
						>
							{playbackRate}x
						</Text>
					</Pressable>
					<Pressable
						className="p-2 active:opacity-50"
						disabled={!canSeek}
						onPress={() => onSeek?.(Math.max(0, position - 5000))}
						style={{ opacity: canSeek ? 1 : 0.45 }}
					>
						<Icon name="Backward5" size={24} color={colors.mutedForeground} />
					</Pressable>
					<AnimatedPlayButton
						isPlaying={isPlaying}
						isLoading={isLoading}
						isDownloading={isDownloading}
						downloadProgress={downloadProgress}
						onPress={onPlayPause}
						size={48}
					/>
					<Pressable
						className="p-2 active:opacity-50"
						disabled={!canSeek}
						onPress={() => onSeek?.(Math.min(duration, position + 5000))}
						style={{ opacity: canSeek ? 1 : 0.45 }}
					>
						<Icon name="Forward5" size={24} color={colors.mutedForeground} />
					</Pressable>
					{onPlusPress ? (
						<Pressable className="p-2 active:opacity-50" onPress={onPlusPress}>
							<Icon name="Plus" size={22} color={colors.foreground} />
						</Pressable>
					) : (
						<View style={{ width: 38 }} />
					)}
				</View>
			</View>
		</View>
	);
}

// ── Info tab ──────────────────────────────────────────────────────────────────

function InfoTab({
	blog,
	commentsState,
	onCommentsPress,
}: {
	blog: any;
	commentsState: any;
	onCommentsPress: () => void;
}) {
	const colors = useColors();
	const tags =
		blog.blogTags?.map((bt: any) => bt.tags?.title).filter(Boolean) ?? [];
	const title = getAudioDisplayTitle(
		{ content: blog.content, media: blog.medias?.[0] },
		"Untitled",
	);
	const channelName =
		blog.channel?.title || blog.channel?.username || "Unknown channel";
	const channelHandle = blog.channel?.username
		? `@${blog.channel.username}`
		: null;

	return (
		<View className="gap-4 pb-8">
			<View className="flex-row items-center gap-3 py-4 border-b border-border">
				<View className="size-10 rounded-full bg-muted items-center justify-center">
					<Text className="text-sm font-bold text-muted-foreground">
						{getInitials(channelName)}
					</Text>
				</View>
				<View className="flex-1">
					<Text className="text-xs text-muted-foreground font-medium">
						Channel
					</Text>
					<Text className="text-sm font-bold text-foreground" numberOfLines={1}>
						{channelName}
					</Text>
					{channelHandle ? (
						<Text className="text-xs text-muted-foreground" numberOfLines={1}>
							{channelHandle}
						</Text>
					) : null}
				</View>
				<Pressable className="px-4 py-1.5 rounded-full border border-border active:bg-muted">
					<Text className="text-xs font-bold text-muted-foreground">
						Follow
					</Text>
				</Pressable>
			</View>

			<View className="gap-2">
				<Text
					style={{
						fontSize: 20,
						fontWeight: "700",
						color: colors.foreground,
						textAlign: "right",
						writingDirection: "rtl",
					}}
				>
					{title}
				</Text>
				{tags.length > 0 && (
					<View className="flex-row flex-wrap gap-2 justify-end mt-1">
						{tags.map((tag: string) => (
							<Pressable
								key={tag}
								className="px-3 py-1 bg-muted rounded-lg active:opacity-70"
							>
								<Text className="text-sm font-medium text-primary">#{tag}</Text>
							</Pressable>
						))}
					</View>
				)}
			</View>

			{/* Inline comments section */}
			<View className="mt-2">
				<View className="flex-row items-center justify-between mb-3">
					<View className="flex-row items-center gap-2">
						<Icon name="MessageCircle" size={18} className="text-foreground" />
						<Text className="text-sm font-bold text-foreground">Comments</Text>
						<View className="px-1.5 py-0.5 rounded-full bg-muted">
							<Text className="text-xs text-muted-foreground">
								{commentsState.comments?.length ?? 0}
							</Text>
						</View>
					</View>
					<Pressable
						onPress={onCommentsPress}
						className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-primary active:opacity-80"
					>
						<Icon name="Plus" size={14} className="text-primary-foreground" />
						<Text className="text-xs font-bold text-primary-foreground">
							New Comment
						</Text>
					</Pressable>
				</View>

				{/* Embedded comments list */}
				<View className="rounded-xl bg-card overflow-hidden">
					<CommentsList state={commentsState} />
				</View>
			</View>
		</View>
	);
}

function AudioArtSourceSheet({
	visible,
	hasChannelPictures,
	isBusy,
	onClose,
	onBrowsePictures,
	onChannelPictures,
}: {
	visible: boolean;
	hasChannelPictures: boolean;
	isBusy: boolean;
	onClose: () => void;
	onBrowsePictures: () => void;
	onChannelPictures: () => void;
}) {
	const colors = useColors();
	if (!visible) return null;

	const action = ({
		icon,
		label,
		description,
		onPress,
		disabled,
	}: {
		icon: IconKeys;
		label: string;
		description: string;
		onPress: () => void;
		disabled?: boolean;
	}) => (
		<Pressable
			disabled={disabled || isBusy}
			onPress={onPress}
			style={{
				minHeight: 58,
				borderRadius: 16,
				flexDirection: "row",
				alignItems: "center",
				gap: 12,
				paddingHorizontal: 12,
				opacity: disabled || isBusy ? 0.5 : 1,
			}}
		>
			<View
				style={{
					width: 42,
					height: 42,
					borderRadius: 999,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: colors.muted,
				}}
			>
				{isBusy && label === "Browse pictures" ? (
					<ActivityIndicator size="small" color={colors.primary} />
				) : (
					<Icon name={icon} size={19} color={colors.foreground} />
				)}
			</View>
			<View style={{ flex: 1 }}>
				<Text
					style={{
						color: colors.foreground,
						fontSize: 14,
						fontWeight: "800",
					}}
				>
					{label}
				</Text>
				<Text
					numberOfLines={1}
					style={{
						color: colors.mutedForeground,
						fontSize: 12,
						marginTop: 2,
					}}
				>
					{description}
				</Text>
			</View>
			<Icon name="ChevronRight" size={17} color={colors.mutedForeground} />
		</Pressable>
	);

	return (
		<FloatingBottomSheet
			visible
			onClose={onClose}
			accessibilityLabel="Add or edit audio art"
		>
			<View style={{ paddingHorizontal: 16, paddingBottom: 22, gap: 6 }}>
				<View
					style={{
						width: 40,
						height: 4,
						borderRadius: 99,
						alignSelf: "center",
						marginBottom: 12,
						backgroundColor: colors.input,
					}}
				/>
				<Text
					style={{
						color: colors.foreground,
						fontSize: 18,
						fontWeight: "900",
						marginBottom: 4,
					}}
				>
					Add/Edit Art
				</Text>
				{action({
					icon: "Image",
					label: "Browse pictures",
					description: "Choose an image from this device",
					onPress: onBrowsePictures,
				})}
				{action({
					icon: "Image",
					label: "Channel pictures",
					description: hasChannelPictures
						? "Search image posts from this channel"
						: "No channel is linked to this audio",
					onPress: onChannelPictures,
					disabled: !hasChannelPictures,
				})}
			</View>
		</FloatingBottomSheet>
	);
}

function ChannelPicturePickerSheet({
	visible,
	posts,
	query,
	isLoading,
	isSelecting,
	onQueryChange,
	onClose,
	onSelect,
	onDelete,
}: {
	visible: boolean;
	posts: BlogItem[];
	query: string;
	isLoading: boolean;
	isSelecting: boolean;
	onQueryChange: (value: string) => void;
	onClose: () => void;
	onSelect: (post: BlogItem) => void;
	onDelete?: (post: BlogItem) => Promise<void> | void;
}) {
	const colors = useColors();
	if (!visible) return null;

	return (
		<Modal
			visible
			transparent
			animationType="slide"
			statusBarTranslucent
			onRequestClose={onClose}
		>
			<Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
				<Pressable
					onPress={(event) => event.stopPropagation()}
					style={{
						maxHeight: "90%",
						minHeight: "68%",
						overflow: "hidden",
						borderTopLeftRadius: 24,
						borderTopRightRadius: 24,
						backgroundColor: colors.background,
					}}
				>
					<View
						style={{
							paddingHorizontal: 16,
							paddingTop: 14,
							paddingBottom: 10,
							borderBottomWidth: 1,
							borderBottomColor: colors.border,
							gap: 12,
						}}
					>
						<View
							style={{
								width: 40,
								height: 4,
								borderRadius: 99,
								alignSelf: "center",
								backgroundColor: colors.input,
							}}
						/>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								gap: 12,
							}}
						>
							<Text
								style={{
									color: colors.foreground,
									fontSize: 18,
									fontWeight: "900",
								}}
							>
								Channel pictures
							</Text>
							<Pressable
								onPress={onClose}
								style={{
									width: 38,
									height: 38,
									borderRadius: 999,
									alignItems: "center",
									justifyContent: "center",
									backgroundColor: colors.muted,
								}}
							>
								<Icon name="X" size={17} color={colors.mutedForeground} />
							</Pressable>
						</View>
						<View
							style={{
								minHeight: 44,
								borderRadius: 16,
								borderWidth: 1,
								borderColor: colors.border,
								backgroundColor: colors.card,
								flexDirection: "row",
								alignItems: "center",
								gap: 8,
								paddingHorizontal: 12,
							}}
						>
							<Icon name="Search" size={17} color={colors.mutedForeground} />
							<TextInput
								value={query}
								onChangeText={onQueryChange}
								placeholder="Search pictures and comments"
								placeholderTextColor={colors.mutedForeground}
								returnKeyType="search"
								style={{ flex: 1, color: colors.foreground, fontSize: 14 }}
							/>
							{query.length > 0 ? (
								<Pressable onPress={() => onQueryChange("")} hitSlop={8}>
									<Icon name="X" size={15} color={colors.mutedForeground} />
								</Pressable>
							) : null}
						</View>
					</View>

					<FlatList
						data={posts}
						keyExtractor={(item) => String(item.id)}
						keyboardDismissMode="interactive"
						keyboardShouldPersistTaps="handled"
						showsVerticalScrollIndicator={false}
						contentContainerStyle={{ paddingBottom: 28 }}
						ListEmptyComponent={
							<View style={{ alignItems: "center", paddingVertical: 48 }}>
								{isLoading ? (
									<ActivityIndicator color={colors.primary} />
								) : (
									<Text style={{ color: colors.mutedForeground }}>
										No pictures found
									</Text>
								)}
							</View>
						}
						renderItem={({ item }) => (
							<View style={{ opacity: isSelecting ? 0.65 : 1 }}>
								<BlogCard
									post={item}
									hideChannelName
									onPress={onSelect}
									onDelete={onDelete}
								/>
							</View>
						)}
					/>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

// ── More menu sheet ───────────────────────────────────────────────────────────

function MoreMenu({
	visible,
	hasAlbum,
	albumId,
	onClose,
	onComment,
	onShare,
	onTranscribe,
	transcriptionActionLabel,
	transcriptionActionDescription,
	onResetTranscription,
	onAddArt,
	onAddToAlbum,
	onAddToPlaylist,
	onViewAlbum,
	onSleepTimer,
}: {
	visible: boolean;
	hasAlbum: boolean;
	albumId?: number | null;
	onClose: () => void;
	onComment: () => void;
	onShare: () => void;
	onTranscribe: () => void;
	transcriptionActionLabel: string;
	transcriptionActionDescription: string;
	onResetTranscription: () => void;
	onAddArt: () => void;
	onAddToAlbum: () => void;
	onAddToPlaylist: () => void;
	onViewAlbum: () => void;
	onSleepTimer: () => void;
}) {
	const colors = useColors();
	const onComingSoon = () => {
		Alert.alert("Coming soon", "This action is not connected yet.");
	};
	const menuAction = ({
		icon,
		label,
		description,
		onPress,
	}: {
		icon: IconKeys;
		label: string;
		description: string;
		onPress: () => void;
	}) => (
		<Pressable
			onPress={() => {
				onClose();
				setTimeout(onPress, 250);
			}}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 14,
				paddingVertical: 14,
				paddingHorizontal: 8,
			}}
		>
			<Icon name={icon} size={22} className="text-foreground" />
			<View style={{ flex: 1 }}>
				<Text
					style={{
						fontSize: 15,
						color: colors.foreground,
						fontWeight: "500",
					}}
				>
					{label}
				</Text>
				<Text
					style={{
						marginTop: 2,
						fontSize: 12,
						color: colors.mutedForeground,
					}}
					numberOfLines={1}
				>
					{description}
				</Text>
			</View>
		</Pressable>
	);
	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
		>
			<Pressable
				style={{
					flex: 1,
					backgroundColor: "rgba(0,0,0,0.6)",
					justifyContent: "flex-end",
				}}
				onPress={onClose}
			>
				<Pressable
					onPress={() => {}}
					style={{
						backgroundColor: colors.card,
						borderTopLeftRadius: 20,
						borderTopRightRadius: 20,
						padding: 20,
						gap: 4,
					}}
				>
					<View
						style={{
							width: 36,
							height: 4,
							backgroundColor: colors.input,
							borderRadius: 2,
							alignSelf: "center",
							marginBottom: 8,
						}}
					/>

					{menuAction({
						icon: "Share",
						label: "Share",
						description: "Send a web link to this audio",
						onPress: onShare,
					})}
					{menuAction({
						icon: "MessageSquare",
						label: "Comment",
						description: "Open the discussion for this post",
						onPress: onComment,
					})}
					{menuAction({
						icon: "Captions",
						label: transcriptionActionLabel,
						description: transcriptionActionDescription,
						onPress: onTranscribe,
					})}
					{menuAction({
						icon: "RotateCcw",
						label: "Reset transcribe",
						description: "Clear transcript and queue jobs",
						onPress: onResetTranscription,
					})}
					{menuAction({
						icon: "Image",
						label: "Add/Edit art",
						description: "Set a picture for this audio",
						onPress: onAddArt,
					})}
					{menuAction({
						icon: "Bookmark",
						label: "Save",
						description: "Keep this post in saved items",
						onPress: onComingSoon,
					})}
					{menuAction({
						icon: "Heart",
						label: "Like",
						description: "Add this post to liked items",
						onPress: onComingSoon,
					})}
					{menuAction({
						icon: "ListMusic",
						label: hasAlbum ? "Change album" : "Add to album",
						description: hasAlbum
							? "Move this audio to another album"
							: "Add this audio to an album",
						onPress: onAddToAlbum,
					})}
					{menuAction({
						icon: "ListMusic",
						label: "Add to playlist",
						description: "Save this audio in a playlist",
						onPress: onAddToPlaylist,
					})}

					{/* View album (only if already in one) */}
					{hasAlbum
						? menuAction({
								icon: "Disc3",
								label: "View album",
								description: "Open this album",
								onPress: onViewAlbum,
							})
						: null}
					{menuAction({
						icon: "Timer",
						label: "Sleep timer",
						description: "Stop playback automatically",
						onPress: onSleepTimer,
					})}

					<View style={{ height: 20 }} />
				</Pressable>
			</Pressable>
		</Modal>
	);
}

// ── Add-to-album picker ───────────────────────────────────────────────────────

function AddToAlbumPicker({
	visible,
	mediaId,
	onClose,
	onNewAlbum,
	isAdding,
	addingAlbumId,
	onPick,
}: {
	visible: boolean;
	mediaId?: number | null;
	onClose: () => void;
	onNewAlbum: () => void;
	isAdding: boolean;
	addingAlbumId: number | null;
	onPick: (albumId: number, albumName: string) => void;
}) {
	const colors = useColors();
	const { data: albums, isLoading } = useQuery({
		..._trpc.album.getAlbums.queryOptions(),
		enabled: visible,
	});

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
		>
			<Pressable
				style={{
					flex: 1,
					backgroundColor: "rgba(0,0,0,0.6)",
					justifyContent: "flex-end",
				}}
				onPress={onClose}
			>
				<Pressable
					onPress={() => {}}
					style={{
						backgroundColor: colors.card,
						borderTopLeftRadius: 20,
						borderTopRightRadius: 20,
						maxHeight: "70%",
					}}
				>
					{/* Handle + header */}
					<View
						style={{
							padding: 20,
							paddingBottom: 12,
							borderBottomWidth: 1,
							borderBottomColor: colors.border,
						}}
					>
						<View
							style={{
								width: 36,
								height: 4,
								backgroundColor: colors.input,
								borderRadius: 2,
								alignSelf: "center",
								marginBottom: 12,
							}}
						/>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
							}}
						>
							<Pressable onPress={onClose}>
								<Icon name="X" size={20} className="text-muted-foreground" />
							</Pressable>
							<Text
								style={{
									fontSize: 15,
									fontWeight: "700",
									color: colors.foreground,
								}}
							>
								Add to album
							</Text>
							<View style={{ width: 20 }} />
						</View>
					</View>

					{/* Album list */}
					{isLoading ? (
						<View style={{ alignItems: "center", paddingVertical: 40 }}>
							<ActivityIndicator color={colors.primary} />
						</View>
					) : !albums?.length ? (
						<View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
							<Icon name="Disc3" size={36} className="text-muted-foreground" />
							<Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
								No albums yet
							</Text>
						</View>
					) : (
						<FlatList
							data={albums}
							keyExtractor={(item) => String(item.id)}
							contentContainerStyle={{
								paddingHorizontal: 16,
								paddingVertical: 8,
							}}
							renderItem={({ item }) => {
								const color = albumColor(item.id);
								const isThisAdding = isAdding && addingAlbumId === item.id;
								return (
									<Pressable
										onPress={() => onPick(item.id, item.name)}
										disabled={isAdding}
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 14,
											paddingVertical: 12,
											opacity: isAdding && !isThisAdding ? 0.4 : 1,
										}}
									>
										{/* Album art — intentional brand color background, keep white text */}
										<View
											style={{
												width: 44,
												height: 44,
												borderRadius: 8,
												backgroundColor: color,
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											{isThisAdding ? (
												<ActivityIndicator size="small" color="#fff" />
											) : (
												<Text
													style={{
														fontSize: 16,
														fontWeight: "800",
														color: "#fff",
													}}
												>
													{getInitials(item.name)}
												</Text>
											)}
										</View>

										{/* Info */}
										<View style={{ flex: 1 }}>
											<Text
												style={{
													fontSize: 14,
													fontWeight: "600",
													color: colors.foreground,
													textAlign: "right",
												}}
												numberOfLines={1}
											>
												{item.name}
											</Text>
											<Text
												style={{
													fontSize: 12,
													color: colors.mutedForeground,
													textAlign: "right",
												}}
											>
												{item._count?.medias ?? 0} tracks
											</Text>
										</View>

										<Icon
											name="ChevronLeft"
											size={16}
											className="text-muted-foreground"
										/>
									</Pressable>
								);
							}}
						/>
					)}

					{/* New album shortcut */}
					<Pressable
						onPress={() => {
							onClose();
							setTimeout(onNewAlbum, 250);
						}}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 10,
							paddingHorizontal: 16,
							paddingVertical: 16,
							borderTopWidth: 1,
							borderTopColor: colors.border,
							marginBottom: 8,
						}}
					>
						<View
							style={{
								width: 44,
								height: 44,
								borderRadius: 8,
								backgroundColor: colors.muted,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Icon name="Plus" size={20} className="text-muted-foreground" />
						</View>
						<Text
							style={{
								fontSize: 14,
								fontWeight: "600",
								color: colors.mutedForeground,
							}}
						>
							Create new album
						</Text>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AudioBlogScreen() {
	const router = useRouter();
	const qc = useQueryClient();
	const colors = useColors();
	const { height: windowHeight } = useWindowDimensions();
	const mainScroll = useScrollChrome<FlatList<any>>();
	const {
		blogId,
		openComments: openCommentsParam,
		seekSec: seekSecParam,
	} = useLocalSearchParams<{
		blogId: string;
		openComments?: string;
		seekSec?: string;
	}>();
	const id = Number(blogId);
	const seekTargetSec = Number(seekSecParam);
	const hasSeekTarget = Number.isFinite(seekTargetSec) && seekTargetSec >= 0;

	const [activeTab, setActiveTab] = useState<Tab>("info");
	const [showComments, setShowComments] = useState(openCommentsParam === "1");
	const [moreMenuVisible, setMoreMenuVisible] = useState(false);
	const [sleepTimerVisible, setSleepTimerVisible] = useState(false);
	const [albumPickerVisible, setAlbumPickerVisible] = useState(false);
	const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);
	const [transcriptionRequestVisible, setTranscriptionRequestVisible] =
		useState(false);
	const [isQueueingTranscription, setIsQueueingTranscription] = useState(false);
	const [addingAlbumId, setAddingAlbumId] = useState<number | null>(null);
	const [dismissedRelatedAlbumMediaId, setDismissedRelatedAlbumMediaId] =
		useState<number | null>(null);
	const [controlsLayout, setControlsLayout] = useState({ y: 0, height: 0 });
	const [showFloatingControls, setShowFloatingControls] = useState(false);
	const [transcriptModalVisible, setTranscriptModalVisible] = useState(false);
	const [audioArtSheetVisible, setAudioArtSheetVisible] = useState(false);
	const [channelPicturePickerVisible, setChannelPicturePickerVisible] =
		useState(false);
	const [channelPictureSearch, setChannelPictureSearch] = useState("");
	const [hiddenChannelPictureIds, setHiddenChannelPictureIds] = useState<
		Set<number>
	>(new Set());
	const [isUploadingAudioArt, setIsUploadingAudioArt] = useState(false);
	const [isSelectingAudioArt, setIsSelectingAudioArt] = useState(false);
	const [transcriptHighlightPaused, setTranscriptHighlightPaused] =
		useState(false);
	const [frozenTranscriptPositionSec, setFrozenTranscriptPositionSec] =
		useState(0);
	const [markedTranscriptSelection, setMarkedTranscriptSelection] =
		useState<TranscriptTextSelection | null>(null);
	const [transcriptChunks, setTranscriptChunks] = useState<
		Record<number, { segments: RawTranscriptSegment[] }>
	>({});
	const [transcriptWindows, setTranscriptWindows] = useState<
		Record<number, SavedTranscriptWindow>
	>({});
	const [pendingTranscriptChunks, setPendingTranscriptChunks] = useState<
		number[]
	>([]);
	const [pendingTranscriptWindows, setPendingTranscriptWindows] = useState<
		number[]
	>([]);
	const [transcriptWindowChecked, setTranscriptWindowChecked] =
		useState(false);
	const [transcriptError, setTranscriptError] = useState<string | null>(null);
	const pendingTranscriptChunksRef = useRef<number[]>([]);
	const pendingTranscriptWindowsRef = useRef<number[]>([]);
	const transcriptWindowsRef = useRef<Record<number, SavedTranscriptWindow>>({});
	const failedTranscriptChunksRef = useRef<Set<number>>(new Set());
	const failedTranscriptWindowsRef = useRef<Set<number>>(new Set());
	const lastTranscriptTapRef = useRef(0);
	const localTranscriberBaseUrl = useAppSettingsStore(
		(s) => s.localTranscriberBaseUrl,
	);
	const localServicesIp = useAppSettingsStore((s) => s.localServicesIp);
	const localApiLastIp = useAppSettingsStore((s) => s.localApiLastIp);
	const transcriberUrl = getDefaultTranscriberUrl(
		localTranscriberBaseUrl,
		localServicesIp ?? localApiLastIp,
	);
	const canCheckTranscriber = isHttpTranscriberUrl(transcriberUrl);
	const lastCompletedTranscriptJobRef = useRef<number | null>(null);

	const loadAudio = useAudioStore((s) => s.loadAudio);
	const seekAudio = useAudioStore((s) => s.seek);
	const syncPlaybackSnapshot = useAudioStore((s) => s.syncPlaybackSnapshot);
	const positionMs = useAudioStore((s) => s.position);
	const activeDurationMs = useAudioStore((s) => s.duration);
	const activeIsPlaying = useAudioStore((s) => s.isPlaying);
	const activeIsLoading = useAudioStore((s) => s.isLoading);
	const activeIsDownloading = useAudioStore((s) => s.isDownloading);
	const activeDownloadProgress = useAudioStore((s) => s.downloadProgress);
	const sound = useAudioStore((s) => s.sound);
	const commentsState = useCommentsState(id);
	const loadedBlog = useAudioStore((s) => s.blog);
	const audioError = useAudioStore((s) => s.error);
	const seekAppliedRef = useRef(false);
	const [viewedPlaybackError, setViewedPlaybackError] = useState<string | null>(
		null,
	);

	const { data: blog } = useQuery(_trpc.blog.getBlog.queryOptions({ id }));

	useFocusEffect(
		useCallback(() => {
			syncPlaybackSnapshot().catch(() => undefined);
		}, [syncPlaybackSnapshot]),
	);

	const media = blog?.medias?.[0];
	const mediaId = media?.id;
	const audioChannelId = blog?.channelId ?? blog?.channel?.id;
	const audioArtUrl = getMediaFileUrl((blog as any)?.thumbnail?.file);
	const telegramFileId =
		media?.file?.source === "vercel_blob" ? undefined : media?.file?.fileId;
	const mediaUrl = getMediaFileUrl(media?.file as any);
	const duration = media?.file?.duration;
	const viewedDurationMs =
		typeof duration === "number" ? Math.max(0, duration * 1000) : 0;
	const isViewedAudioActive = Boolean(blog && loadedBlog?.id === blog.id);
	const playerPositionMs = isViewedAudioActive ? positionMs : 0;
	const playerPositionSec = playerPositionMs / 1000;
	const transcriptAnchorSec =
		isViewedAudioActive ? playerPositionSec : hasSeekTarget ? seekTargetSec : 0;
	const activeTranscriptChunkStart =
		getTranscriptChunkStart(transcriptAnchorSec);
	const activeTranscriptWindowStart =
		getSavedTranscriptWindowStart(transcriptAnchorSec);
	const shouldPrefetchNextTranscriptChunk =
		transcriptAnchorSec - activeTranscriptChunkStart >=
		TRANSCRIPT_PREFETCH_AT_SEC;
	const shouldPrefetchNextTranscriptWindow =
		transcriptAnchorSec - activeTranscriptWindowStart >=
		SAVED_TRANSCRIPT_PREFETCH_AT_SEC;
	const playerDurationMs = isViewedAudioActive
		? activeDurationMs || viewedDurationMs
		: viewedDurationMs;
	const playerIsPlaying = isViewedAudioActive && activeIsPlaying;
	const playerIsLoading = isViewedAudioActive && activeIsLoading;
	const playerIsDownloading = isViewedAudioActive && activeIsDownloading;
	const playerDownloadProgress = isViewedAudioActive
		? activeDownloadProgress
		: 0;
	const visibleAudioError = isViewedAudioActive
		? audioError
		: viewedPlaybackError;
	const viewedAudioItem = useMemo(() => {
		if (!blog || blog.type !== "audio") return null;
		const media = blog.medias?.[0];
		const file = media?.file;
		if (!media?.id || !file?.fileName) return null;

		return {
			id: blog.id,
			type: "audio",
			caption: blog.content ?? file.fileName ?? media.title ?? null,
			content: null,
			date: blog.blogDate,
			audio: {
				mediaId: media.id,
				telegramFileId: file.fileId,
				url: mediaUrl,
				fileName: file.fileName,
				title: media.title,
				duration: file.duration,
				artwork: audioArtUrl ?? undefined,
				imageUrl: audioArtUrl ?? undefined,
			},
		} as any;
	}, [audioArtUrl, blog, mediaUrl]);
	const audioTitle = getAudioDisplayTitle(
		{ content: blog?.content, media: media as any },
		"Untitled Audio",
	);
	const { data: relatedAlbumSuggestion } = useQuery({
		..._trpc.album.getRelatedAlbumForMedia.queryOptions({
			mediaId: mediaId ?? 0,
		}),
		enabled: Boolean(mediaId && !media?.albumId),
	});
	const showRelatedAlbumSuggestion = Boolean(
		relatedAlbumSuggestion &&
		mediaId &&
		!media?.albumId &&
		dismissedRelatedAlbumMediaId !== mediaId &&
		!albumPickerVisible &&
		!playlistPickerVisible &&
		!moreMenuVisible &&
		!sleepTimerVisible &&
		!transcriptModalVisible &&
		!audioArtSheetVisible &&
		!channelPicturePickerVisible &&
		!showFloatingControls &&
		!showComments,
	);

	const {
		data: channelPicturesData,
		isFetching: isFetchingChannelPictures,
		refetch: refetchChannelPictures,
	} = useQuery({
		..._trpc.blog.posts.queryOptions({
			category: "picture",
			channelId: audioChannelId,
			q: channelPictureSearch.trim() || undefined,
			size: 60,
		}),
		enabled:
			channelPicturePickerVisible && typeof audioChannelId === "number",
	});
	const channelPicturePosts = useMemo(
		() =>
			(((channelPicturesData as any)?.data ?? []) as BlogItem[]).filter(
				(post) => !hiddenChannelPictureIds.has(post.id),
			),
		[channelPicturesData, hiddenChannelPictureIds],
	);

	const transcriptWindowValues = useMemo(
		() =>
			Object.values(transcriptWindows).sort(
				(a, b) => a.windowStartSec - b.windowStartSec,
			),
		[transcriptWindows],
	);
	const transcriptSummary = useMemo(() => {
		if (transcriptWindowValues.length === 0) return null;
		return transcriptWindowValues.reduce(
			(summary, window) => ({
				status: summary.status ?? window.status,
				segmentCount: Math.max(summary.segmentCount, window.segmentCount ?? 0),
				maxEndSec: Math.max(summary.maxEndSec, window.maxEndSec ?? 0),
			}),
			{ status: null as string | null, segmentCount: 0, maxEndSec: 0 },
		);
	}, [transcriptWindowValues]);
	const hasSavedTranscript =
		(transcriptSummary?.segmentCount ?? 0) > 0 ||
		(transcriptSummary?.maxEndSec ?? 0) > 0;
	const {
		enqueue: enqueueTranscription,
		deleteJob: deleteTranscriptionJob,
		jobs: transcriptionJobs,
		reload: reloadTranscriptionJobs,
	} = useTranscriptionQueue(mediaId, {
		autoLoad: !!mediaId,
		reloadOnEnqueue: false,
	});
	const mediaTranscriptionJobs = useMemo(
		() => transcriptionJobs.filter((job) => job.mediaId === mediaId),
		[mediaId, transcriptionJobs],
	);
	const latestTranscriptionJob = mediaTranscriptionJobs[0];
	const queuedTranscriptionJob = mediaTranscriptionJobs.find(
		(job) => job.status === "queued",
	);
	const runningTranscriptionJob = mediaTranscriptionJobs.find(
		(job) => job.status === "running",
	);
	const latestTranscriptionStatus =
		latestTranscriptionJob?.status === "completed"
			? "done"
			: latestTranscriptionJob?.status;
	const transcriptBadge = getTranscriptionBadgeState({
		...(media as any),
		transcript: transcriptSummary
			? {
					status: transcriptSummary.status,
					segments: [{ endSec: transcriptSummary.maxEndSec }],
				}
			: (media as any)?.transcript,
		transcriptStatus:
			transcriptSummary?.status ??
			(media as any)?.transcriptStatus ??
			latestTranscriptionStatus,
		transcriptionJobStatus:
			latestTranscriptionJob?.status ?? (media as any)?.transcriptionJobStatus,
		transcriptionJobs: mediaTranscriptionJobs,
		duration: duration ?? (media as any)?.duration ?? null,
	});
	const isCurrentAudioAlreadyTranscribed = transcriptBadge.isFullyTranscribed;
	const transcriptBadgeColor =
		transcriptBadge.tone === "success"
			? colors.success
			: transcriptBadge.tone === "warn"
				? colors.warn
				: transcriptBadge.tone === "muted"
					? colors.warn
					: colors.primary;
	const transcriptionActionLabel = queuedTranscriptionJob
		? "Queued"
		: runningTranscriptionJob
			? "Running"
			: isCurrentAudioAlreadyTranscribed
				? "Transcript"
				: "Transcribe";
	const transcriptionActionDescription = queuedTranscriptionJob
		? "Tap to remove this audio from the queue"
		: runningTranscriptionJob
			? "Transcription is currently running"
			: isCurrentAudioAlreadyTranscribed
				? "Clear transcript or transcribe again"
				: "Queue this audio for local Whisper";
	const { data: localTranscriberHealth } = useQuery({
		..._trpc.blog.checkLocalTranscriber.queryOptions({
			baseUrl: canCheckTranscriber ? (transcriberUrl ?? undefined) : undefined,
		}),
		enabled: canCheckTranscriber,
		retry: false,
	});
	const whisperAvailable = Boolean(localTranscriberHealth?.ok);
	const { mutate: getTranscriptChunk } = useMutation(
		_trpc.blog.getTranscriptChunk.mutationOptions({
			onSuccess(data) {
				failedTranscriptChunksRef.current.delete(data.chunkStartSec);
				setTranscriptChunks((prev) => ({
					...prev,
					[data.chunkStartSec]: {
						segments: data.segments as RawTranscriptSegment[],
					},
				}));
				setTranscriptError(null);
			},
			onError(error, variables) {
				const chunkStart = variables?.chunkStartSec ?? 0;
				failedTranscriptChunksRef.current.add(chunkStart);
				setTranscriptError(error.message || "Could not load transcript.");
			},
			onSettled(_data, _error, variables) {
				const chunkStart = variables?.chunkStartSec;
				if (typeof chunkStart !== "number") return;
				pendingTranscriptChunksRef.current =
					pendingTranscriptChunksRef.current.filter(
						(value) => value !== chunkStart,
					);
				setPendingTranscriptChunks(pendingTranscriptChunksRef.current);
			},
		}),
	);
	const getTranscriptChunkRef = useRef(getTranscriptChunk);

	useEffect(() => {
		getTranscriptChunkRef.current = getTranscriptChunk;
	}, [getTranscriptChunk]);

	useEffect(() => {
		transcriptWindowsRef.current = transcriptWindows;
	}, [transcriptWindows]);

	useEffect(() => {
		pendingTranscriptWindowsRef.current = pendingTranscriptWindows;
	}, [pendingTranscriptWindows]);

	const requestTranscriptWindow = useCallback(
		async (windowStartSec: number, options?: { force?: boolean }) => {
			if (!mediaId) return;
			const normalizedStart = getSavedTranscriptWindowStart(windowStartSec);
			if (
				!options?.force &&
				transcriptWindowsRef.current[normalizedStart]
			) {
				setTranscriptWindowChecked(true);
				return;
			}
			if (pendingTranscriptWindowsRef.current.includes(normalizedStart)) return;
			if (
				!options?.force &&
				failedTranscriptWindowsRef.current.has(normalizedStart)
			) {
				setTranscriptWindowChecked(true);
				return;
			}

			pendingTranscriptWindowsRef.current = [
				...pendingTranscriptWindowsRef.current,
				normalizedStart,
			];
			setPendingTranscriptWindows(pendingTranscriptWindowsRef.current);
			try {
				const windowData = await qc.fetchQuery(
					_trpc.blog.getTranscriptWindow.queryOptions({
						mediaId,
						windowStartSec: normalizedStart,
						windowDurationSec: SAVED_TRANSCRIPT_WINDOW_SEC,
					}),
				);
				const typedWindow = windowData as SavedTranscriptWindow;
				failedTranscriptWindowsRef.current.delete(normalizedStart);
				setTranscriptWindows((current) => {
					const next = {
						...current,
						[typedWindow.windowStartSec]: typedWindow,
					};
					transcriptWindowsRef.current = next;
					return next;
				});
				setTranscriptError(null);
			} catch (error) {
				failedTranscriptWindowsRef.current.add(normalizedStart);
				setTranscriptError(
					error instanceof Error
						? error.message
						: "Could not load transcript window.",
				);
			} finally {
				setTranscriptWindowChecked(true);
				pendingTranscriptWindowsRef.current =
					pendingTranscriptWindowsRef.current.filter(
						(value) => value !== normalizedStart,
					);
				setPendingTranscriptWindows(pendingTranscriptWindowsRef.current);
			}
		},
		[mediaId, qc],
	);

	useEffect(() => {
		setTranscriptChunks({});
		setTranscriptWindows({});
		setPendingTranscriptChunks([]);
		setPendingTranscriptWindows([]);
		setTranscriptWindowChecked(false);
		setTranscriptError(null);
		setMarkedTranscriptSelection(null);
		setViewedPlaybackError(null);
		setTranscriptModalVisible(false);
		setTranscriptHighlightPaused(false);
		pendingTranscriptChunksRef.current = [];
		pendingTranscriptWindowsRef.current = [];
		transcriptWindowsRef.current = {};
		failedTranscriptChunksRef.current = new Set<number>();
		failedTranscriptWindowsRef.current = new Set<number>();
	}, [mediaId]);

	const requestTranscriptChunk = useCallback(
		(chunkStartSec: number) => {
			if (!mediaId || !telegramFileId) return;
			if (!whisperAvailable) return;
			if (pendingTranscriptChunksRef.current.includes(chunkStartSec)) return;
			if (transcriptChunks[chunkStartSec]) return;
			if (failedTranscriptChunksRef.current.has(chunkStartSec)) return;

			pendingTranscriptChunksRef.current = [
				...pendingTranscriptChunksRef.current,
				chunkStartSec,
			];
			setPendingTranscriptChunks(pendingTranscriptChunksRef.current);
			getTranscriptChunkRef.current({
				mediaId,
				fileId: telegramFileId,
				chunkStartSec,
				chunkDurationSec: TRANSCRIPT_CHUNK_SEC,
				model: "whisper-local",
				localTranscriberBaseUrl: canCheckTranscriber
					? (transcriberUrl ?? undefined)
					: undefined,
			});
		},
		[
			canCheckTranscriber,
			mediaId,
			telegramFileId,
			transcriptChunks,
			transcriberUrl,
			whisperAvailable,
		],
	);

	useEffect(() => {
		if (!mediaId) return;
		void requestTranscriptWindow(activeTranscriptWindowStart);
		if (shouldPrefetchNextTranscriptWindow) {
			void requestTranscriptWindow(
				activeTranscriptWindowStart + SAVED_TRANSCRIPT_WINDOW_SEC,
			);
		}
	}, [
		activeTranscriptWindowStart,
		mediaId,
		requestTranscriptWindow,
		shouldPrefetchNextTranscriptWindow,
	]);

	useEffect(() => {
		if (!mediaId || !telegramFileId || !transcriptWindowChecked) return;
		if (hasSavedTranscript) return;
		requestTranscriptChunk(activeTranscriptChunkStart);
		if (shouldPrefetchNextTranscriptChunk) {
			requestTranscriptChunk(activeTranscriptChunkStart + TRANSCRIPT_CHUNK_SEC);
		}
	}, [
		activeTranscriptChunkStart,
		hasSavedTranscript,
		mediaId,
		requestTranscriptChunk,
		shouldPrefetchNextTranscriptChunk,
		telegramFileId,
		transcriptWindowChecked,
	]);

	useEffect(() => {
		if (!mediaId) return;
		const completedJob = mediaTranscriptionJobs.find(
			(job) => job.status === "completed",
		);
		if (!completedJob) return;
		if (lastCompletedTranscriptJobRef.current === completedJob.id) return;
		lastCompletedTranscriptJobRef.current = completedJob.id;
		setTranscriptWindows({});
		transcriptWindowsRef.current = {};
		setTranscriptWindowChecked(false);
		void Promise.all([
			qc.invalidateQueries({ queryKey: _trpc.blog.getBlog.queryKey({ id }) }),
		]);
	}, [id, mediaId, mediaTranscriptionJobs, qc]);

	const transcriptSegments = useMemo(() => {
		const segmentsByKey = new Map<
			string,
			ReturnType<typeof normalizeTranscriptSegment>
		>();

		transcriptWindowValues
			.flatMap((window) => window.segments)
			.forEach((segment, index) => {
				const normalized = normalizeTranscriptSegment(segment, index);
				segmentsByKey.set(
					`${normalized.startSec}:${normalized.endSec}:${normalized.text}`,
					normalized,
				);
			});

		Object.values(transcriptChunks)
			.flatMap((chunk) => chunk.segments)
			.forEach((segment, index) => {
				const normalized = normalizeTranscriptSegment(segment, index);
				segmentsByKey.set(
					`${normalized.startSec}:${normalized.endSec}:${normalized.text}`,
					normalized,
				);
			});

		return [...segmentsByKey.values()].sort((a, b) => a.startSec - b.startSec);
	}, [transcriptChunks, transcriptWindowValues]);
	const transcriptDocument = useMemo(
		() => buildTranscriptDocument(transcriptSegments),
		[transcriptSegments],
	);
	const requestPreviousTranscriptWindow = useCallback(() => {
		const firstWindow = transcriptWindowValues[0];
		const target =
			firstWindow?.previousWindowStartSec ??
			Math.max(0, activeTranscriptWindowStart - SAVED_TRANSCRIPT_WINDOW_SEC);
		void requestTranscriptWindow(target);
	}, [activeTranscriptWindowStart, requestTranscriptWindow, transcriptWindowValues]);
	const requestNextTranscriptWindow = useCallback(() => {
		const lastWindow = transcriptWindowValues.at(-1);
		if (lastWindow && lastWindow.nextWindowStartSec == null) return;
		const target =
			lastWindow?.nextWindowStartSec ??
			(lastWindow
				? lastWindow.windowEndSec
				: activeTranscriptWindowStart + SAVED_TRANSCRIPT_WINDOW_SEC);
		if (target == null) return;
		void requestTranscriptWindow(target);
	}, [activeTranscriptWindowStart, requestTranscriptWindow, transcriptWindowValues]);

	const channelName =
		blog?.channel?.title || blog?.channel?.username || "Unknown channel";
	const dominantColor = media?.album
		? albumColor(media.albumId)
		: colors.primary;
	const audioGradientColors = useMemo(
		() => [dominantColor, dominantColor, "#5a2b0d", "#15100c"] as const,
		[dominantColor],
	);

	useEffect(() => {
		void SystemUI.setBackgroundColorAsync(
			showComments ? colors.background : dominantColor,
		);
		return () => {
			void SystemUI.setBackgroundColorAsync(colors.background);
		};
	}, [colors.background, dominantColor, showComments]);

	usePlayHistorySync(mediaId);

	const markViewed = useRecentlyViewedStore((s) => s.markViewed);
	useEffect(() => {
		if (blog) {
			const blogRecord = blog as any;
			markViewed({
				id: blog.id,
				title: audioTitle,
				type: blog.type ?? "audio",
				date: blogRecord.date ?? blog.blogDate ?? null,
			});
		}
	}, [audioTitle, blog, markViewed]);

	useEffect(() => {
		if (isViewedAudioActive) {
			syncPlaybackSnapshot().catch(() => undefined);
		}
	}, [isViewedAudioActive, syncPlaybackSnapshot]);

	useEffect(() => {
		seekAppliedRef.current = false;
	}, [id, seekSecParam]);

	useEffect(() => {
		if (
			!hasSeekTarget ||
			!blog ||
			!isViewedAudioActive ||
			!sound ||
			seekAppliedRef.current
		) {
			return;
		}
		seekAudio(Math.floor(seekTargetSec * 1000))
			.then(() => {
				seekAppliedRef.current = true;
			})
			.catch(() => undefined);
	}, [
		blog,
		hasSeekTarget,
		isViewedAudioActive,
		seekAudio,
		seekTargetSec,
		sound,
	]);

	const handleViewedPlayPause = useCallback(async () => {
		if (!viewedAudioItem) return;
		setViewedPlaybackError(null);

		if (isViewedAudioActive) {
			await useAudioStore.getState().togglePlayPause();
			const error = useAudioStore.getState().error;
			if (error) setViewedPlaybackError(error);
			return;
		}

		await loadAudio(viewedAudioItem);
		const loadError = useAudioStore.getState().error;
		if (loadError) {
			setViewedPlaybackError(loadError);
			return;
		}

		await useAudioStore.getState().play();
		const playError = useAudioStore.getState().error;
		if (playError) setViewedPlaybackError(playError);
	}, [isViewedAudioActive, loadAudio, viewedAudioItem]);

	const { mutate: addToAlbum, isPending: isAdding } = useMutation(
		_trpc.album.addMediaToAlbum.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: _trpc.blog.getBlog.queryKey({ id }) });
				if (mediaId) {
					setDismissedRelatedAlbumMediaId(mediaId);
				}
				setAlbumPickerVisible(false);
				setAddingAlbumId(null);
				Toast.show("Added to album", {
					type: "success",
					position: "bottom",
				});
			},
			onError: (e) => {
				setAddingAlbumId(null);
				Alert.alert("Error", e.message);
			},
		}),
	);

	const { mutateAsync: updateAudioArtAsync, isPending: isUpdatingAudioArt } =
		useMutation(
			_trpc.blog.updateBlogThumbnail.mutationOptions({
				onSuccess: async () => {
					await Promise.all([
						qc.invalidateQueries({
							queryKey: _trpc.blog.getBlog.queryKey({ id }),
						}),
						qc.invalidateQueries({
							queryKey: _trpc.blog.posts.queryKey(),
						}),
					]);
				},
				onError: (e) => Alert.alert("Could not update art", e.message),
			}),
		);
	const {
		mutateAsync: deleteChannelPicturePost,
		isPending: isDeletingChannelPicture,
	} = useMutation(_trpc.blog.deleteBlog.mutationOptions());

	const {
		mutate: resetCurrentTranscript,
		mutateAsync: resetCurrentTranscriptAsync,
	} = useMutation(
		_trpc.blog.resetTranscript.mutationOptions({
			onSuccess: async () => {
				setTranscriptChunks({});
				setTranscriptWindows({});
				setPendingTranscriptChunks([]);
				setPendingTranscriptWindows([]);
				setTranscriptWindowChecked(false);
				setTranscriptError(null);
				setMarkedTranscriptSelection(null);
				pendingTranscriptChunksRef.current = [];
				pendingTranscriptWindowsRef.current = [];
				transcriptWindowsRef.current = {};
				failedTranscriptChunksRef.current = new Set<number>();
				failedTranscriptWindowsRef.current = new Set<number>();
				await Promise.all([
					qc.invalidateQueries({
						queryKey: _trpc.blog.getTranscriptWindow.queryKey(),
					}),
					qc.invalidateQueries({
						queryKey: _trpc.blog.getBlog.queryKey({ id }),
					}),
				]);
				await reloadTranscriptionJobs();
			},
			onError: (e) => Alert.alert("Could not reset transcription", e.message),
		}),
	);

	const { mutate: addTranscriptComment, isPending: isAddingTranscriptComment } =
		useMutation(
			_trpc.blog.addComment.mutationOptions({
				onSuccess: async () => {
					await Promise.all([
						qc.invalidateQueries({
							queryKey: _trpc.blog.getComments.queryKey({ blogId: id }),
						}),
						qc.invalidateQueries({
							queryKey: _trpc.blog.getBlog.queryKey({ id }),
						}),
					]);
					commentsState.refetch();
					Alert.alert(
						"Comment added",
						"Highlighted transcript text was commented.",
					);
				},
				onError: (e) => Alert.alert("Could not add comment", e.message),
			}),
		);

	function handlePickAlbum(albumId: number, albumName: string) {
		if (!mediaId) return;
		setAddingAlbumId(albumId);
		addToAlbum({ albumId, mediaIds: [mediaId] });
	}

	async function applyAudioArtFromUpload(upload: BlobMediaUpload) {
		await updateAudioArtAsync({ id, thumbnailUpload: upload });
		Toast.show("Audio art updated", { type: "success", position: "bottom" });
		setAudioArtSheetVisible(false);
		setChannelPicturePickerVisible(false);
	}

	async function browseAudioArtPictures() {
		try {
			const result = await DocumentPicker.getDocumentAsync({
				type: "image/*",
				multiple: false,
				copyToCacheDirectory: true,
			});
			if (result.canceled || !result.assets[0]) return;

			setIsUploadingAudioArt(true);
			const asset = result.assets[0];
			const upload = await uploadBlogMediaAsset({
				uri: asset.uri,
				name: asset.name,
				mimeType: asset.mimeType,
				size: asset.size,
			});
			await applyAudioArtFromUpload(upload);
		} catch (error) {
			Alert.alert(
				"Could not update art",
				error instanceof Error ? error.message : "Please try another image.",
			);
		} finally {
			setIsUploadingAudioArt(false);
		}
	}

	function openChannelPicturePicker() {
		if (typeof audioChannelId !== "number") return;
		setAudioArtSheetVisible(false);
		setChannelPicturePickerVisible(true);
		setHiddenChannelPictureIds(new Set());
	}

	async function selectChannelPicture(post: BlogItem) {
		if (isSelectingAudioArt) return;
		try {
			setIsSelectingAudioArt(true);
			await updateAudioArtAsync({ id, thumbnailBlogId: post.id });
			Toast.show("Audio art updated", { type: "success", position: "bottom" });
			setChannelPicturePickerVisible(false);
		} catch (error) {
			Alert.alert(
				"Could not update art",
				error instanceof Error ? error.message : "Please try another picture.",
			);
		} finally {
			setIsSelectingAudioArt(false);
		}
	}

	async function deleteChannelPicture(post: BlogItem) {
		setHiddenChannelPictureIds((prev) => new Set(prev).add(post.id));
		try {
			await deleteChannelPicturePost({ id: post.id });
			await refetchChannelPictures();
			Toast.show("Picture deleted", { type: "success", position: "bottom" });
		} catch (error) {
			setHiddenChannelPictureIds((prev) => {
				const next = new Set(prev);
				next.delete(post.id);
				return next;
			});
			Alert.alert(
				"Could not delete picture",
				error instanceof Error ? error.message : "Please try again.",
			);
		}
	}

	function handleAddRelatedAlbumSuggestion() {
		if (!relatedAlbumSuggestion) return;
		handlePickAlbum(relatedAlbumSuggestion.id, relatedAlbumSuggestion.name);
	}

	function dismissRelatedAlbumSuggestion() {
		if (!mediaId) return;
		setDismissedRelatedAlbumMediaId(mediaId);
	}

	async function shareAudioPost() {
		const webUrl = getBlogShareUrl(id);
		await Share.share({
			message: `Check out this post: ${webUrl}`,
			url: webUrl,
		});
	}

	async function queueCurrentTranscription() {
		if (!mediaId) return false;
		let reachableAudioUrl =
			mediaUrl?.startsWith("http://") || mediaUrl?.startsWith("https://")
				? mediaUrl
				: null;

		if (!telegramFileId && !reachableAudioUrl) {
			Alert.alert(
				"Cannot transcribe yet",
				"This audio does not have a reachable file source to queue.",
			);
			return false;
		}

		try {
			setIsQueueingTranscription(true);
			if (!reachableAudioUrl && telegramFileId) {
				const resolved = await getTelegramFileUrl(telegramFileId);
				reachableAudioUrl =
					resolved?.url?.startsWith("http://") ||
					resolved?.url?.startsWith("https://")
						? resolved.url
						: null;
			}

			if (!reachableAudioUrl) {
				throw new Error(
					"Could not resolve a reachable audio URL for this job.",
				);
			}

			await enqueueTranscription({
				mediaId,
				telegramFileId: telegramFileId ?? null,
				audioUrl: reachableAudioUrl,
				language: "ar",
				transcriberUrl,
			});
			await reloadTranscriptionJobs();
			Alert.alert("Queued", "Added to transcription queue.");
			return true;
		} catch (error) {
			Alert.alert(
				"Could not queue transcription",
				error instanceof Error
					? error.message
					: "This audio could not be added to the transcription queue.",
			);
			return false;
		} finally {
			setIsQueueingTranscription(false);
		}
	}

	function confirmRemoveQueuedTranscription(jobId: number) {
		Alert.alert(
			"Remove from queue?",
			"This audio is already queued for transcription.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Remove",
					style: "destructive",
					onPress: () => {
						void deleteTranscriptionJob(jobId)
							.then(reloadTranscriptionJobs)
							.catch((error) =>
								Alert.alert(
									"Could not remove queue item",
									error instanceof Error
										? error.message
										: "This queued transcription could not be removed.",
								),
							);
					},
				},
			],
		);
	}

	function confirmCompletedTranscriptionAction() {
		if (!mediaId) return;
		Alert.alert(
			"Transcript available",
			"Clear the saved transcript or clear it and queue a new transcription.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Clear",
					style: "destructive",
					onPress: () => resetCurrentTranscript({ mediaId }),
				},
				{
					text: "Re-transcribe",
					onPress: () => {
						void resetCurrentTranscriptAsync({ mediaId }).then(() => {
							void queueCurrentTranscription();
						});
					},
				},
			],
		);
	}

	function handleQueueCurrentTranscriptionPress() {
		if (queuedTranscriptionJob) {
			confirmRemoveQueuedTranscription(queuedTranscriptionJob.id);
			return;
		}
		if (runningTranscriptionJob) {
			Alert.alert(
				"Transcription running",
				"This audio is already being transcribed.",
			);
			return;
		}
		if (isCurrentAudioAlreadyTranscribed) {
			confirmCompletedTranscriptionAction();
			return;
		}
		setTranscriptionRequestVisible(true);
	}

	async function startCurrentTranscriptionFromModal() {
		const queued = await queueCurrentTranscription();
		if (queued) setTranscriptionRequestVisible(false);
	}

	function resetCurrentTranscription() {
		if (!mediaId) return;
		Alert.alert(
			"Reset transcription?",
			"Clear the saved transcript and queued jobs for this audio.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Reset",
					style: "destructive",
					onPress: () => resetCurrentTranscript({ mediaId }),
				},
			],
		);
	}

	function openTranscriptModal() {
		setFrozenTranscriptPositionSec(transcriptAnchorSec);
		setTranscriptHighlightPaused(false);
		setTranscriptModalVisible(true);
		syncPlaybackSnapshot().catch(() => undefined);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
	}

	function handleTranscriptAreaPress() {
		const now = Date.now();
		if (now - lastTranscriptTapRef.current < 300) {
			openTranscriptModal();
		}
		lastTranscriptTapRef.current = now;
	}

	function toggleTranscriptHighlightPause() {
		if (!transcriptHighlightPaused) {
			setFrozenTranscriptPositionSec(transcriptAnchorSec);
		}
		setTranscriptHighlightPaused((value) => !value);
	}

	function gotoCurrentTranscriptPosition() {
		setFrozenTranscriptPositionSec(transcriptAnchorSec);
		setTranscriptHighlightPaused(false);
		setMarkedTranscriptSelection(null);
		syncPlaybackSnapshot().catch(() => undefined);
	}

	function handleReadModeSegmentPress(
		segment: TranscriptSegmentData,
		_index: number,
		shouldPlay: boolean,
	) {
		if (!isViewedAudioActive) return;
		seekAudio(segment.startSec * 1000)
			.then(() => {
				if (shouldPlay) return useAudioStore.getState().play();
			})
			.catch(() => undefined);
	}

	function markTranscriptSegment(segment: TranscriptSegmentData) {
		setMarkedTranscriptSelection(
			selectTranscriptSegment(transcriptDocument, segment),
		);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
	}

	function copyMarkedTranscriptText() {
		const text = markedTranscriptSelection?.text;
		if (!text) return;
		Clipboard.setString(text);
		Alert.alert("Copied", "Highlighted transcript text copied.");
	}

	function commentMarkedTranscriptText() {
		const selection = markedTranscriptSelection;
		const text = selection?.text;
		if (!selection || !text?.trim() || isAddingTranscriptComment) return;
		Clipboard.setString(text);
		addTranscriptComment({
			blogId: id,
			content: text,
			timestampSeconds: Math.max(0, Math.floor(selection.timestampSec)),
		});
	}

	function updateFloatingControls(scrollY: number) {
		if (!controlsLayout.height) return;
		setShowFloatingControls(
			scrollY > controlsLayout.y + controlsLayout.height + 12,
		);
	}

	return (
		<View
			className="flex-1 bg-background"
			style={{ backgroundColor: colors.background }}
		>
			{!showComments && (
				<StatusBar
					style="light"
					backgroundColor={dominantColor}
					translucent={false}
				/>
			)}
			<SafeArea
				style={{
					flex: 1,
					backgroundColor: showComments ? colors.background : dominantColor,
				}}
			>
				{/* ── Comments inline view (YouTube-style) ───────────────── */}
				{showComments ? (
					<KeyboardAvoidingView
						style={{ flex: 1 }}
						behavior={Platform.OS === "ios" ? "padding" : "height"}
					>
						<CommentsHeader
							state={commentsState}
							onClose={() => setShowComments(false)}
						/>
						<CommentsAudioContext />
						<View style={{ flex: 1 }}>
							<CommentsList state={commentsState} />
						</View>
						<CommentInput
							blogId={id}
							autoFocus={openCommentsParam === "1"}
							noKeyboardAvoid
							timestampMode
							onCommentAdded={commentsState.refetch}
						/>
					</KeyboardAvoidingView>
				) : (
					<FlatList
						ref={mainScroll.ref}
						data={[]}
						renderItem={() => null}
						keyExtractor={(_, index) => String(index)}
						showsVerticalScrollIndicator={false}
						scrollEventThrottle={mainScroll.scrollEventThrottle}
						contentContainerStyle={{
							paddingBottom: 120,
							backgroundColor: colors.background,
						}}
						onScroll={(event) => {
							mainScroll.onScroll(event);
							updateFloatingControls(event.nativeEvent.contentOffset.y);
						}}
						ListHeaderComponent={
							<>
								<LinearGradient
									colors={audioGradientColors}
									locations={[0, 0.46, 0.78, 1]}
									style={{
										height: Math.max(
											0,
											windowHeight - NEXT_CONTENT_PEEK_HEIGHT,
										),
										paddingTop: 12,
										paddingBottom: Math.max(
											18,
											Math.min(windowHeight * 0.04, 34),
										),
									}}
								>
									{/* Header */}
									<View className="flex-row items-center justify-between px-4 py-3">
										<Pressable
											onPress={() => router.back()}
											className="size-10 items-center justify-center rounded-full active:bg-black/20"
										>
											<Icon name="ChevronDown" size={28} color="#ffffff" />
										</Pressable>
										<Pressable
											disabled={!media?.albumId}
											onPress={() =>
												router.push(`/albums/${media?.albumId}` as any)
											}
											style={{ alignItems: "center", flex: 1 }}
										>
											<Text
												style={{
													fontSize: 11,
													fontWeight: "700",
													color: "rgba(255,255,255,0.7)",
													textTransform: "uppercase",
													letterSpacing: 1,
												}}
											>
												Playing from {media?.album ? "Album" : "Channel"}
											</Text>
											<Text
												style={{
													fontSize: 13,
													fontWeight: "700",
													color: "#ffffff",
												}}
											>
												{media?.album?.name || channelName}
											</Text>
										</Pressable>
										<View className="flex-row items-center gap-1">
											{transcriptBadge.show ? (
												<View
													accessibilityLabel={transcriptBadge.label}
													style={{
														maxWidth: 168,
														minHeight: 32,
														flexDirection: "row",
														alignItems: "center",
														gap: 6,
														borderRadius: 999,
														paddingHorizontal: 10,
														backgroundColor: withAlpha(
															transcriptBadgeColor,
															0.18,
														),
													}}
												>
													<Icon
														name="FileText"
														size={14}
														color={transcriptBadgeColor}
													/>
													<Text
														numberOfLines={1}
														style={{
															color: transcriptBadgeColor,
															fontSize: 11,
															fontWeight: "800",
														}}
													>
														{transcriptBadge.label}
													</Text>
												</View>
											) : null}
											<Pressable
												onPress={handleQueueCurrentTranscriptionPress}
												className="size-10 items-center justify-center rounded-full active:bg-black/20"
											>
												<Icon
													name="Captions"
													size={22}
													color={transcriptBadgeColor}
												/>
											</Pressable>
											<Pressable
												onPress={() => setMoreMenuVisible(true)}
												className="size-10 items-center justify-center rounded-full active:bg-black/20"
											>
												<Icon name="MoreHorizontal" color="#ffffff" />
											</Pressable>
										</View>
									</View>

									{/* Transcript area */}
									<Pressable
										onPress={handleTranscriptAreaPress}
										style={{
											flex: 1,
											minHeight: 0,
											marginHorizontal: 16,
											marginTop: 12,
											marginBottom: 12,
											overflow: "hidden",
										}}
									>
										{transcriptSegments.length > 0 ? (
											<KaraokeTranscript
												segments={transcriptSegments}
												positionSecOverride={
													isViewedAudioActive ? undefined : transcriptAnchorSec
												}
												autoScroll={isViewedAudioActive}
												playbackEnabled={isViewedAudioActive}
												contentPaddingVertical={34}
												onSegmentLongPress={(segment) => {
													markTranscriptSegment(segment);
													openTranscriptModal();
												}}
											/>
										) : (
											<View
												style={{
													flex: 1,
													alignItems: "center",
													justifyContent: "center",
													paddingHorizontal: 18,
													gap: 12,
												}}
											>
												{pendingTranscriptChunks.length > 0 ||
												pendingTranscriptWindows.length > 0 ? (
													<ActivityIndicator color="#ffffff" />
												) : (
													<Icon
														name={telegramFileId ? "Captions" : "AudioWaveform"}
														size={34}
														color="rgba(255,255,255,0.62)"
													/>
												)}
												<Text
													style={{
														color: "rgba(255,255,255,0.72)",
														fontSize: 24,
														lineHeight: 32,
														fontWeight: "800",
														textAlign: "center",
													}}
												>
													{transcriptError
														? "Transcript could not load"
														: pendingTranscriptChunks.length > 0 ||
															  pendingTranscriptWindows.length > 0
															? "Loading transcript..."
															: !telegramFileId &&
																  transcriptWindowChecked &&
																  !hasSavedTranscript
															? "Transcript unavailable for this audio"
															: "Transcript will appear here"}
												</Text>
												{transcriptError ? (
													<Text
														style={{
															color: "rgba(255,255,255,0.48)",
															fontSize: 13,
															textAlign: "center",
														}}
														numberOfLines={2}
													>
														{transcriptError}
													</Text>
												) : null}
											</View>
										)}
									</Pressable>

									<View
										style={{
											marginTop: "auto",
											paddingBottom: Math.max(
												8,
												Math.min(windowHeight * 0.02, 18),
											),
										}}
									>
										{/* Title & Small Album Art Marquee */}
										<View className="flex-row items-center px-6 gap-4">
											<Pressable
												onPress={() => setAudioArtSheetVisible(true)}
												accessibilityLabel="Add or edit audio art"
												style={{
													width: 56,
													height: 56,
													borderRadius: 8,
													backgroundColor: media?.album
														? albumColor(media.albumId)
														: "rgba(255,255,255,0.2)",
													alignItems: "center",
													justifyContent: "center",
													overflow: "hidden",
												}}
											>
												{audioArtUrl ? (
													<Image
														source={{ uri: audioArtUrl }}
														style={{ width: "100%", height: "100%" }}
														contentFit="cover"
													/>
												) : (
													<Text
														style={{
															color: "#fff",
															fontWeight: "800",
															fontSize: 20,
														}}
													>
														{getInitials(media?.album?.name ?? audioTitle)}
													</Text>
												)}
												<View
													style={{
														position: "absolute",
														right: 4,
														bottom: 4,
														width: 18,
														height: 18,
														borderRadius: 999,
														alignItems: "center",
														justifyContent: "center",
														backgroundColor: "rgba(0,0,0,0.48)",
													}}
												>
													<Icon name="Pencil" size={10} color="#fff" />
												</View>
											</Pressable>
											<View
												style={{
													flex: 1,
													overflow: "hidden",
													justifyContent: "center",
												}}
											>
												<AnimatedMarquee
													text={audioTitle}
													style={{
														fontSize: 24,
														fontWeight: "800",
														color: "#fff",
													}}
												/>
												<Text
													style={{
														fontSize: 16,
														color: "rgba(255,255,255,0.7)",
														textAlign: "right",
														marginTop: 2,
													}}
												>
													{channelName}
												</Text>
											</View>
											{media?.album ? (
												<Pressable
													className="p-2 active:opacity-50"
													onPress={() =>
														router.push(`/albums/${media.albumId}` as any)
													}
													accessibilityLabel="Open album"
												>
													<Icon name="Disc3" size={26} color="#fff" />
												</Pressable>
											) : (
												<Pressable
													className="p-2 active:opacity-50"
													onPress={() => setAlbumPickerVisible(true)}
													accessibilityLabel="Add to album"
												>
													<Icon name="Plus" size={28} color="#fff" />
												</Pressable>
											)}
										</View>

										{/* Player controls */}
										<View
											className="px-6 pt-5"
											onLayout={(event) => {
												const { y, height } = event.nativeEvent.layout;
												setControlsLayout({ y, height });
											}}
										>
											<PlayerSection
												theme="dark"
												isActiveAudio={isViewedAudioActive}
												isPlaying={playerIsPlaying}
												position={playerPositionMs}
												duration={playerDurationMs}
												isLoading={playerIsLoading}
												isDownloading={playerIsDownloading}
												downloadProgress={playerDownloadProgress}
												onPlayPause={handleViewedPlayPause}
												onSeek={isViewedAudioActive ? seekAudio : undefined}
												onPlusPress={
													media?.album
														? undefined
														: () => setAlbumPickerVisible(true)
												}
												onReadPress={openTranscriptModal}
											/>
											{visibleAudioError ? (
												<Text className="pt-3 text-center text-xs text-destructive">
													{visibleAudioError}
												</Text>
											) : null}
										</View>
									</View>
								</LinearGradient>

								{/* Album strip below controls */}
								{media?.album && (
									<Pressable
										onPress={() =>
											router.push(`/albums/${media.albumId}` as any)
										}
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 10,
											marginHorizontal: 24,
											marginTop: 16,
											paddingHorizontal: 14,
											paddingVertical: 10,
											backgroundColor: colors.card,
											borderRadius: 12,
											borderWidth: 1,
											borderColor: colors.border,
										}}
									>
										<Icon name="Disc3" size={16} className="text-primary" />
										<View style={{ flex: 1 }}>
											<Text
												style={{
													fontSize: 13,
													fontWeight: "700",
													color: colors.primary,
												}}
												numberOfLines={1}
											>
												{media.album.name}
											</Text>
											{media.albumAudioIndex?.index && (
												<Text
													style={{
														fontSize: 11,
														color: colors.mutedForeground,
													}}
												>
													Track {media.albumAudioIndex.index}
												</Text>
											)}
										</View>
										<Icon
											name="ChevronRight"
											size={14}
											className="text-muted-foreground"
										/>
									</Pressable>
								)}

								{/* Tabs */}
								<View className="mx-6 mt-4">
									<View className="flex-row rounded-xl bg-muted p-1">
										{(["info", "books"] as Tab[]).map((tab) => (
											<Pressable
												key={tab}
												onPress={() => setActiveTab(tab)}
												className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? "bg-card shadow-sm" : ""}`}
											>
												<Text
													className={`text-sm font-bold capitalize ${activeTab === tab ? "text-foreground" : "text-muted-foreground"}`}
												>
													{tab === "info" ? "Info" : "Books"}
												</Text>
											</Pressable>
										))}
									</View>
								</View>

								{/* Tab content */}
								<View className="mt-3 px-6">
									{activeTab === "info" ? (
										<InfoTab
											blog={blog ?? {}}
											commentsState={commentsState}
											onCommentsPress={() => setShowComments(true)}
										/>
									) : activeTab === "books" && mediaId ? (
										<AudioBookReferences
											mediaId={mediaId}
											albumId={media?.albumId}
										/>
									) : (
										<View className="items-center justify-center py-12">
											<Text className="text-sm text-muted-foreground">
												No media attached
											</Text>
										</View>
									)}
								</View>
							</>
						}
					/>
				)}
			</SafeArea>

			{!showComments && (
				<ScrollToTopButton
					visible={mainScroll.showScrollTop}
					onPress={mainScroll.scrollToTop}
					bottom={showFloatingControls ? 108 : 24}
				/>
			)}

			{!showComments && (
				<FloatingPlayerWidget
					visible={showFloatingControls}
					isActiveAudio={isViewedAudioActive}
					isPlaying={playerIsPlaying}
					position={playerPositionMs}
					duration={playerDurationMs}
					isLoading={playerIsLoading}
					isDownloading={playerIsDownloading}
					downloadProgress={playerDownloadProgress}
					onPlayPause={handleViewedPlayPause}
					onSeek={isViewedAudioActive ? seekAudio : undefined}
					onPlusPress={
						media?.album ? undefined : () => setAlbumPickerVisible(true)
					}
				/>
			)}

			{showRelatedAlbumSuggestion && relatedAlbumSuggestion ? (
				<RelatedAlbumSuggestionSheet
					album={relatedAlbumSuggestion as RelatedAlbumSuggestion}
					isAdding={isAdding && addingAlbumId === relatedAlbumSuggestion.id}
					onAdd={handleAddRelatedAlbumSuggestion}
					onDismiss={dismissRelatedAlbumSuggestion}
				/>
			) : null}

			{/* More menu */}
			<MoreMenu
				visible={moreMenuVisible}
				hasAlbum={!!media?.album}
				albumId={media?.albumId}
				onClose={() => setMoreMenuVisible(false)}
				onComment={() => setShowComments(true)}
				onShare={() => {
					void shareAudioPost();
				}}
				onTranscribe={handleQueueCurrentTranscriptionPress}
				transcriptionActionLabel={transcriptionActionLabel}
				transcriptionActionDescription={transcriptionActionDescription}
				onResetTranscription={resetCurrentTranscription}
				onAddArt={() => setAudioArtSheetVisible(true)}
				onAddToAlbum={() => setAlbumPickerVisible(true)}
				onAddToPlaylist={() => {
					if (mediaId) setPlaylistPickerVisible(true);
				}}
				onViewAlbum={() => router.push(`/albums/${media?.albumId}` as any)}
				onSleepTimer={() => setSleepTimerVisible(true)}
			/>

			<TranscriptionRequestModal
				visible={transcriptionRequestVisible}
				mediaKind="audio"
				title={audioTitle}
				statusLabel={
					isCurrentAudioAlreadyTranscribed
						? "This audio already has a transcript. Starting again will queue a new transcription job."
						: transcriptBadge.show
							? transcriptBadge.label
							: null
				}
				isStarting={isQueueingTranscription}
				canStart={Boolean(mediaId)}
				onClose={() => setTranscriptionRequestVisible(false)}
				onStart={() => {
					void startCurrentTranscriptionFromModal();
				}}
			/>

			<Modal
				visible={transcriptModalVisible}
				animationType="slide"
				onRequestClose={() => setTranscriptModalVisible(false)}
			>
				<View style={{ flex: 1, backgroundColor: "#080807" }}>
					<SafeArea style={{ flex: 1, backgroundColor: "#080807" }}>
						<View className="flex-row items-center justify-between px-4 py-3">
							<Pressable
								onPress={() => setTranscriptModalVisible(false)}
								className="size-11 items-center justify-center rounded-full active:bg-white/10"
							>
								<Icon name="ChevronDown" size={26} color="#ffffff" />
							</Pressable>
							<Text
								className="min-w-0 flex-1 px-3 text-center text-sm font-bold"
								numberOfLines={1}
								style={{ color: "rgba(255,255,255,0.82)" }}
							>
								{audioTitle}
							</Text>
							<View className="flex-row items-center gap-2">
								<Pressable
									onPress={toggleTranscriptHighlightPause}
									className="size-11 items-center justify-center rounded-full active:bg-white/10"
									accessibilityLabel={
										transcriptHighlightPaused
											? "Continue read highlight"
											: "Pause read highlight"
									}
								>
									<Icon
										name={transcriptHighlightPaused ? "Play" : "Pause"}
										size={20}
										color="#ffffff"
									/>
								</Pressable>
								<Pressable
									onPress={gotoCurrentTranscriptPosition}
									className="size-11 items-center justify-center rounded-full active:bg-white/10"
									accessibilityLabel="Go to current position"
								>
									<Icon name="Compass" size={20} color="#ffffff" />
								</Pressable>
							</View>
						</View>
						<View style={{ flex: 1 }}>
							<TranscriptReadMode
								document={transcriptDocument}
								autoScroll={
									!transcriptHighlightPaused && !markedTranscriptSelection
								}
								selection={markedTranscriptSelection}
								onSelectionChange={setMarkedTranscriptSelection}
								onStartReached={requestPreviousTranscriptWindow}
								onEndReached={requestNextTranscriptWindow}
								onPressSegment={handleReadModeSegmentPress}
								positionSecOverride={
									!isViewedAudioActive
										? transcriptAnchorSec
										: transcriptHighlightPaused
										? frozenTranscriptPositionSec
										: undefined
								}
							/>
						</View>
						<View
							style={{
								borderTopWidth: 1,
								borderTopColor: "rgba(255,255,255,0.12)",
								paddingHorizontal: 16,
								paddingTop: 10,
								paddingBottom: 18,
								backgroundColor: "rgba(0,0,0,0.72)",
							}}
						>
							{markedTranscriptSelection ? (
								<>
									<Text
										style={{
											color: "rgba(255,255,255,0.54)",
											fontSize: 11,
											fontWeight: "700",
											marginBottom: 5,
											textAlign: "right",
										}}
									>
										Starts at{" "}
										{formatMs(markedTranscriptSelection.timestampSec * 1000)}
									</Text>
									<Text
										selectable
										numberOfLines={2}
										style={{
											color: "rgba(255,255,255,0.82)",
											fontSize: 14,
											lineHeight: 20,
											textAlign: "right",
											writingDirection: "rtl",
										}}
									>
										{markedTranscriptSelection.text}
									</Text>
									<View className="mt-3 flex-row items-center gap-2">
										<Pressable
											onPress={copyMarkedTranscriptText}
											className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-white/10 active:opacity-75"
										>
											<Icon name="Copy" size={16} color="#ffffff" />
											<Text className="text-sm font-bold text-white">Copy</Text>
										</Pressable>
										<Pressable
											onPress={commentMarkedTranscriptText}
											disabled={isAddingTranscriptComment}
											className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-white active:opacity-75"
											style={{ opacity: isAddingTranscriptComment ? 0.55 : 1 }}
										>
											<Icon name="MessageSquare" size={16} color="#111111" />
											<Text
												style={{
													fontSize: 14,
													fontWeight: "800",
													color: "#111111",
												}}
											>
												Comment
											</Text>
										</Pressable>
									</View>
								</>
							) : (
								<Text
									style={{
										color: "rgba(255,255,255,0.54)",
										fontSize: 12,
										textAlign: "center",
									}}
								>
									No highlighted text
								</Text>
							)}
						</View>
					</SafeArea>
				</View>
			</Modal>

			<SleepTimerModal
				visible={sleepTimerVisible}
				onClose={() => setSleepTimerVisible(false)}
			/>

			<AudioArtSourceSheet
				visible={audioArtSheetVisible}
				hasChannelPictures={typeof audioChannelId === "number"}
				isBusy={isUploadingAudioArt || isUpdatingAudioArt}
				onClose={() => setAudioArtSheetVisible(false)}
				onBrowsePictures={() => {
					void browseAudioArtPictures();
				}}
				onChannelPictures={openChannelPicturePicker}
			/>

			<ChannelPicturePickerSheet
				visible={channelPicturePickerVisible}
				posts={channelPicturePosts}
				query={channelPictureSearch}
				isLoading={isFetchingChannelPictures}
				isSelecting={isSelectingAudioArt || isDeletingChannelPicture}
				onQueryChange={setChannelPictureSearch}
				onClose={() => setChannelPicturePickerVisible(false)}
				onSelect={(post) => {
					void selectChannelPicture(post);
				}}
				onDelete={deleteChannelPicture}
			/>

			{/* Album picker */}
			<AddToAlbumPicker
				visible={albumPickerVisible}
				mediaId={mediaId}
				onClose={() => setAlbumPickerVisible(false)}
				onNewAlbum={() => router.push("/albums" as any)}
				isAdding={isAdding}
				addingAlbumId={addingAlbumId}
				onPick={handlePickAlbum}
			/>

			<AddToPlaylistModal
				visible={playlistPickerVisible}
				mediaIds={mediaId ? [mediaId] : []}
				onClose={() => setPlaylistPickerVisible(false)}
			/>
		</View>
	);
}
