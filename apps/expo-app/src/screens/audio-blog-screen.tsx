import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import * as SystemUI from "expo-system-ui";
import {
	ActivityIndicator,
	Animated,
	Alert,
	FlatList,
	KeyboardAvoidingView,
	Modal,
	PanResponder,
	Platform,
	ScrollView,
	Text,
	TextInput,
	View,
	useWindowDimensions,
} from "react-native";

import { useCommentsState } from "@/components/comments-sheet";
import { CommentsHeader } from "@/components/comments-sheet/comments-header";
import { CommentsAudioContext } from "@/components/comments-sheet/comments-audio-context";
import { CommentsList } from "@/components/comments-sheet/comments-list";
import { CommentInput } from "@/components/comments-sheet/comment-input";
import { AddToPlaylistModal } from "@/components/channel-chat/add-to-playlist-modal";
import { AnimatedMarquee } from "@/components/ui/animated-marquee";
import { KaraokeTranscript } from "@/components/audio-blog-view/karaoke-transcript";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { usePlayHistorySync } from "@/hooks/use-play-history-sync";
import { useAudioStore } from "@/store/audio-store";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useRecentlyViewedStore } from "@/store/recently-viewed-store";
import { getAudioDisplayTitle } from "@/lib/audio-title";
import { getMediaFileUrl } from "@/lib/media-source";
import {
	getDefaultTranscriberUrl,
	isHttpTranscriberUrl,
} from "@/lib/transcribe";
import { minuteToString } from "@/lib/utils";

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
const NEXT_CONTENT_PEEK_HEIGHT = 68;

type CenterTranscriptSegment = {
	id?: number | string;
	from?: number;
	to?: number;
	startSec?: number;
	endSec?: number;
	text: string;
	words?: Array<{ word: string; startSec: number; endSec: number }>;
};

function getTranscriptChunkStart(sec: number) {
	return (
		Math.floor(Math.max(0, sec) / TRANSCRIPT_CHUNK_SEC) * TRANSCRIPT_CHUNK_SEC
	);
}

function normalizeTranscriptSegment(
	segment: CenterTranscriptSegment,
	index: number,
) {
	const startSec = segment.startSec ?? segment.from ?? 0;
	const endSec = segment.endSec ?? segment.to ?? startSec;
	return {
		id: segment.id ?? index,
		startSec,
		endSec,
		text: segment.text,
		words: segment.words,
	};
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
								`/books/${reference.bookId}/reader/${reference.pageId}` as any,
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
	onPlusPress,
}: {
	theme?: "light" | "dark";
	onPlusPress?: () => void;
}) {
	const colors = useColors();
	const isPlaying = useAudioStore((s) => s.isPlaying);
	const position = useAudioStore((s) => s.position);
	const duration = useAudioStore((s) => s.duration);
	const isLoading = useAudioStore((s) => s.isLoading);
	const isDownloading = useAudioStore((s) => s.isDownloading);
	const downloadProgress = useAudioStore((s) => s.downloadProgress);
	const togglePlayPause = useAudioStore((s) => s.togglePlayPause);
	const seek = useAudioStore((s) => s.seek);
	const playbackRate = useAudioStore((s) => s.playbackRate);
	const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);

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
	const durationRef = useRef(duration);
	const seekRef = useRef(seek);
	useEffect(() => {
		durationRef.current = duration;
	}, [duration]);
	useEffect(() => {
		seekRef.current = seek;
	}, [seek]);

	// Sync store position → animated value when not dragging
	useEffect(() => {
		if (!isDragging.current) {
			const p = duration > 0 ? position / duration : 0;
			progressAnim.setValue(p);
			setLabelMs(position);
		}
	}, [position, duration]);

	// Listen to animated value changes → update time labels (only 2 Text nodes re-render)
	useEffect(() => {
		const id = progressAnim.addListener(({ value }) => {
			setLabelMs(value * durationRef.current);
		});
		return () => progressAnim.removeListener(id);
	}, []);

	// Interpolated pixel positions — recalculated only when trackWidth changes
	const KNOB = 22;
	const TICK_HEIGHTS = [3, 6, 5, 8, 4, 7, 3, 9, 5, 7, 4, 8, 5, 6, 4, 7];
	const fillWidth = useMemo(
		() =>
			progressAnim.interpolate({
				inputRange: [0, 1],
				outputRange: [0, trackWidth],
			}),
		[trackWidth],
	);
	const knobLeft = useMemo(
		() =>
			progressAnim.interpolate({
				inputRange: [0, 1],
				outputRange: [-(KNOB / 2), trackWidth - KNOB / 2],
			}),
		[trackWidth],
	);

	const seekPanResponder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			onPanResponderGrant: (evt) => {
				const x = evt.nativeEvent.locationX;
				const w = trackWidthRef.current;
				if (!w) return;
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
				isDragging.current = true;
				useAudioStore.setState({ isSeeking: true });
				const p = Math.max(0, Math.min(1, x / w));
				dragValueRef.current = p;
				progressAnim.setValue(p);
			},
			onPanResponderMove: (evt) => {
				const x = evt.nativeEvent.locationX;
				const w = trackWidthRef.current;
				if (!w) return;
				const p = Math.max(0, Math.min(1, x / w));
				dragValueRef.current = p;
				progressAnim.setValue(p);
			},
			onPanResponderRelease: () => {
				const d = durationRef.current;
				seekRef.current(dragValueRef.current * d);
				isDragging.current = false;
				// isSeeking cleared by seek() after setPositionAsync resolves
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
					onLayout={(e) => {
						trackWidthRef.current = e.nativeEvent.layout.width;
						setTrackWidth(e.nativeEvent.layout.width);
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
							height: 26,
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							paddingHorizontal: 2,
						}}
					>
						{TICK_HEIGHTS.map((h, i) => (
							<View
								key={`${h}-${i}`}
								style={{
									width: 4,
									height: h * 3,
									borderRadius: 9999,
									backgroundColor:
										theme === "dark"
											? "rgba(255,255,255,0.22)"
											: "rgba(0,0,0,0.16)",
								}}
							/>
						))}
					</View>

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
				<Pressable
					onPress={cycleSpeed}
					className="px-2 py-1 rounded-md active:opacity-70"
					style={{ backgroundColor: trackBgColor }}
				>
					<Text
						style={{ fontSize: 12, fontWeight: "700", color: mutedFgColor }}
					>
						{playbackRate}x
					</Text>
				</Pressable>
				<View className="flex-row items-center gap-6">
					<Pressable
						className="p-2 active:opacity-50"
						onPress={() => seek(Math.max(0, position - 5000))}
					>
						<Icon name="Backward5" size={32} color={fgColor} />
					</Pressable>
					<AnimatedPlayButton
						isPlaying={isPlaying}
						isLoading={isLoading}
						isDownloading={isDownloading}
						downloadProgress={downloadProgress}
						onPress={() => togglePlayPause()}
					/>
					<Pressable
						className="p-2 active:opacity-50"
						onPress={() => seek(Math.min(duration, position + 5000))}
					>
						<Icon name="Forward5" size={32} color={fgColor} />
					</Pressable>
				</View>
				<Pressable
					className="p-2 active:opacity-50"
					onPress={onPlusPress}
					disabled={!onPlusPress}
					style={{ opacity: onPlusPress ? 1 : 0.45 }}
				>
					<Icon name="Plus" size={22} color={mutedFgColor} />
				</Pressable>
			</View>
		</View>
	);
}

function FloatingPlayerWidget({
	visible,
	onPlusPress,
}: {
	visible: boolean;
	onPlusPress?: () => void;
}) {
	const colors = useColors();
	const isPlaying = useAudioStore((s) => s.isPlaying);
	const position = useAudioStore((s) => s.position);
	const duration = useAudioStore((s) => s.duration);
	const isLoading = useAudioStore((s) => s.isLoading);
	const isDownloading = useAudioStore((s) => s.isDownloading);
	const downloadProgress = useAudioStore((s) => s.downloadProgress);
	const togglePlayPause = useAudioStore((s) => s.togglePlayPause);
	const seek = useAudioStore((s) => s.seek);
	const playbackRate = useAudioStore((s) => s.playbackRate);
	const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);

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
						onPress={() => seek(Math.max(0, position - 5000))}
					>
						<Icon name="Backward5" size={24} color={colors.mutedForeground} />
					</Pressable>
					<AnimatedPlayButton
						isPlaying={isPlaying}
						isLoading={isLoading}
						isDownloading={isDownloading}
						downloadProgress={downloadProgress}
						onPress={() => togglePlayPause()}
						size={48}
					/>
					<Pressable
						className="p-2 active:opacity-50"
						onPress={() => seek(Math.min(duration, position + 5000))}
					>
						<Icon name="Forward5" size={24} color={colors.mutedForeground} />
					</Pressable>
					<Pressable
						className="p-2 active:opacity-50"
						onPress={onPlusPress}
						disabled={!onPlusPress}
						style={{ opacity: onPlusPress ? 1 : 0.45 }}
					>
						<Icon name="Plus" size={22} color={colors.foreground} />
					</Pressable>
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

// ── More menu sheet ───────────────────────────────────────────────────────────

function MoreMenu({
	visible,
	hasAlbum,
	albumId,
	onClose,
	onAddToAlbum,
	onAddToPlaylist,
	onViewAlbum,
	onSleepTimer,
}: {
	visible: boolean;
	hasAlbum: boolean;
	albumId?: number | null;
	onClose: () => void;
	onAddToAlbum: () => void;
	onAddToPlaylist: () => void;
	onViewAlbum: () => void;
	onSleepTimer: () => void;
}) {
	const colors = useColors();
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

					{/* Add / Change Album */}
					<Pressable
						onPress={() => {
							onClose();
							setTimeout(onAddToAlbum, 250);
						}}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 14,
							paddingVertical: 14,
							paddingHorizontal: 8,
						}}
					>
						<Icon name="ListMusic" size={22} className="text-foreground" />
						<Text
							style={{
								fontSize: 15,
								color: colors.foreground,
								fontWeight: "500",
							}}
						>
							{hasAlbum ? "Change album" : "Add to album"}
						</Text>
					</Pressable>

					<Pressable
						onPress={() => {
							onClose();
							setTimeout(onAddToPlaylist, 250);
						}}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 14,
							paddingVertical: 14,
							paddingHorizontal: 8,
						}}
					>
						<Icon name="ListMusic" size={22} className="text-foreground" />
						<Text
							style={{
								fontSize: 15,
								color: colors.foreground,
								fontWeight: "500",
							}}
						>
							Add to playlist
						</Text>
					</Pressable>

					{/* View album (only if already in one) */}
					{hasAlbum && (
						<Pressable
							onPress={() => {
								onClose();
								setTimeout(onViewAlbum, 250);
							}}
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 14,
								paddingVertical: 14,
								paddingHorizontal: 8,
							}}
						>
							<Icon name="Disc3" size={22} className="text-foreground" />
							<Text
								style={{
									fontSize: 15,
									color: colors.foreground,
									fontWeight: "500",
								}}
							>
								View album
							</Text>
						</Pressable>
					)}

					{/* Sleep timer */}
					<Pressable
						onPress={() => {
							onClose();
							setTimeout(onSleepTimer, 250);
						}}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 14,
							paddingVertical: 14,
							paddingHorizontal: 8,
						}}
					>
						<Icon name="Timer" size={22} className="text-foreground" />
						<Text
							style={{
								fontSize: 15,
								color: colors.foreground,
								fontWeight: "500",
							}}
						>
							Sleep timer
						</Text>
					</Pressable>

					{/* Share */}
					<Pressable
						onPress={onClose}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 14,
							paddingVertical: 14,
							paddingHorizontal: 8,
						}}
					>
						<Icon name="Share" size={22} className="text-foreground" />
						<Text
							style={{
								fontSize: 15,
								color: colors.foreground,
								fontWeight: "500",
							}}
						>
							Share
						</Text>
					</Pressable>

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
	onAdded,
	onNewAlbum,
	isAdding,
	addingAlbumId,
	onPick,
}: {
	visible: boolean;
	mediaId?: number | null;
	onClose: () => void;
	onAdded: (albumName: string) => void;
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
	const [addingAlbumId, setAddingAlbumId] = useState<number | null>(null);
	const [addedToAlbumName, setAddedToAlbumName] = useState<string | null>(null);
	const [controlsLayout, setControlsLayout] = useState({ y: 0, height: 0 });
	const [showFloatingControls, setShowFloatingControls] = useState(false);
	const [transcriptChunks, setTranscriptChunks] = useState<
		Record<number, { segments: CenterTranscriptSegment[] }>
	>({});
	const [pendingTranscriptChunks, setPendingTranscriptChunks] = useState<
		number[]
	>([]);
	const [transcriptError, setTranscriptError] = useState<string | null>(null);
	const pendingTranscriptChunksRef = useRef<number[]>([]);
	const failedTranscriptChunksRef = useRef<Set<number>>(new Set());
	const localTranscriberBaseUrl = useAppSettingsStore(
		(s) => s.localTranscriberBaseUrl,
	);
	const transcriberUrl = getDefaultTranscriberUrl(localTranscriberBaseUrl);
	const canCheckTranscriber = isHttpTranscriberUrl(transcriberUrl);

	const loadAudio = useAudioStore((s) => s.loadAudio);
	const seekAudio = useAudioStore((s) => s.seek);
	const positionMs = useAudioStore((s) => s.position);
	const sound = useAudioStore((s) => s.sound);
	const commentsState = useCommentsState(id);
	const loadedBlog = useAudioStore((s) => s.blog);
	const audioError = useAudioStore((s) => s.error);
	const seekAppliedRef = useRef(false);

	const { data: blog } = useQuery(_trpc.blog.getBlog.queryOptions({ id }));

	const media = blog?.medias?.[0];
	const mediaId = media?.id;
	const telegramFileId =
		media?.file?.source === "vercel_blob" ? undefined : media?.file?.fileId;
	const mediaUrl = getMediaFileUrl(media?.file as any);
	const duration = media?.file?.duration;
	const audioTitle = getAudioDisplayTitle(
		{ content: blog?.content, media: media as any },
		"Untitled Audio",
	);

	const { data: transcriptData } = useQuery({
		..._trpc.blog.getTranscript.queryOptions({ mediaId: mediaId ?? 0 }),
		enabled: !!mediaId,
	});
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
						segments: data.segments as CenterTranscriptSegment[],
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
		setTranscriptChunks({});
		setPendingTranscriptChunks([]);
		setTranscriptError(null);
		pendingTranscriptChunksRef.current = [];
		failedTranscriptChunksRef.current = new Set<number>();
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
				force: true,
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
		if (!mediaId || !telegramFileId) return;
		const positionSec = positionMs / 1000;
		const activeChunkStart = getTranscriptChunkStart(positionSec);
		requestTranscriptChunk(activeChunkStart);
		if (positionSec - activeChunkStart >= TRANSCRIPT_PREFETCH_AT_SEC) {
			requestTranscriptChunk(activeChunkStart + TRANSCRIPT_CHUNK_SEC);
		}
	}, [mediaId, positionMs, requestTranscriptChunk, telegramFileId]);

	const transcriptSegments = useMemo(() => {
		const segmentsByKey = new Map<
			string,
			ReturnType<typeof normalizeTranscriptSegment>
		>();

		(transcriptData?.segments ?? []).forEach((segment, index) => {
			const normalized = normalizeTranscriptSegment(
				segment as unknown as CenterTranscriptSegment,
				index,
			);
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
	}, [transcriptChunks, transcriptData?.segments]);

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
		if (!blog || blog.type !== "audio") return;

		const media = blog.medias?.[0];
		const file = media?.file;
		if (!media?.id || !file?.fileName) return;
		if (loadedBlog?.id === blog.id) return;

		loadAudio({
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
			},
		} as any).catch(() => undefined);
	}, [blog, loadedBlog?.id, loadAudio, mediaUrl]);

	useEffect(() => {
		seekAppliedRef.current = false;
	}, [id, seekSecParam]);

	useEffect(() => {
		if (
			!hasSeekTarget ||
			!blog ||
			loadedBlog?.id !== blog.id ||
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
	}, [blog, hasSeekTarget, loadedBlog?.id, seekAudio, seekTargetSec, sound]);

	const { mutate: addToAlbum, isPending: isAdding } = useMutation(
		_trpc.album.addMediaToAlbum.mutationOptions({
			onSuccess: (_, vars) => {
				qc.invalidateQueries({ queryKey: _trpc.blog.getBlog.queryKey({ id }) });
				setAlbumPickerVisible(false);
				setAddingAlbumId(null);
			},
			onError: (e) => {
				setAddingAlbumId(null);
				Alert.alert("Error", e.message);
			},
		}),
	);

	function handlePickAlbum(albumId: number, albumName: string) {
		if (!mediaId) return;
		setAddingAlbumId(albumId);
		setAddedToAlbumName(albumName);
		addToAlbum({ albumId, mediaIds: [mediaId] });
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
						data={[]}
						renderItem={() => null}
						keyExtractor={(_, index) => String(index)}
						showsVerticalScrollIndicator={false}
						scrollEventThrottle={16}
						contentContainerStyle={{
							paddingBottom: 120,
							backgroundColor: colors.background,
						}}
						onScroll={(event) =>
							updateFloatingControls(event.nativeEvent.contentOffset.y)
						}
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
											<Pressable
												onPress={() => setMoreMenuVisible(true)}
												className="size-10 items-center justify-center rounded-full active:bg-black/20"
											>
												<Icon name="MoreHorizontal" color="#ffffff" />
											</Pressable>
										</View>
									</View>

									{/* Transcript area */}
									<View
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
											<KaraokeTranscript segments={transcriptSegments} />
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
												{pendingTranscriptChunks.length > 0 ? (
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
														: !telegramFileId
															? "Transcript unavailable for this audio"
															: pendingTranscriptChunks.length > 0
																? "Loading transcript..."
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
									</View>

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
											<View
												style={{
													width: 56,
													height: 56,
													borderRadius: 8,
													backgroundColor: media?.album
														? albumColor(media.albumId)
														: "rgba(255,255,255,0.2)",
													alignItems: "center",
													justifyContent: "center",
												}}
											>
												<Text
													style={{
														color: "#fff",
														fontWeight: "800",
														fontSize: 20,
													}}
												>
													{getInitials(media?.album?.name ?? audioTitle)}
												</Text>
											</View>
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
											<Pressable
												className="p-2 active:opacity-50"
												onPress={() => setAlbumPickerVisible(true)}
											>
												<Icon name="Plus" size={28} color="#fff" />
											</Pressable>
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
												onPlusPress={() => setAlbumPickerVisible(true)}
											/>
											{audioError ? (
												<Text className="pt-3 text-center text-xs text-destructive">
													{audioError}
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

								{/* "Added to album" confirmation */}
								{addedToAlbumName && !isAdding && (
									<View
										style={{
											marginHorizontal: 24,
											marginTop: 8,
											paddingHorizontal: 14,
											paddingVertical: 8,
											backgroundColor: colors.success + "22",
											borderRadius: 8,
											flexDirection: "row",
											alignItems: "center",
											gap: 8,
										}}
									>
										<Icon
											name="CheckCircle2"
											size={16}
											className="text-success"
										/>
										<Text
											style={{ fontSize: 13, color: colors.success, flex: 1 }}
										>
											Added to {addedToAlbumName}
										</Text>
										<Pressable onPress={() => setAddedToAlbumName(null)}>
											<Icon name="X" size={14} className="text-success" />
										</Pressable>
									</View>
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
				<FloatingPlayerWidget
					visible={showFloatingControls}
					onPlusPress={() => setAlbumPickerVisible(true)}
				/>
			)}

			{/* More menu */}
			<MoreMenu
				visible={moreMenuVisible}
				hasAlbum={!!media?.album}
				albumId={media?.albumId}
				onClose={() => setMoreMenuVisible(false)}
				onAddToAlbum={() => setAlbumPickerVisible(true)}
				onAddToPlaylist={() => {
					if (mediaId) setPlaylistPickerVisible(true);
				}}
				onViewAlbum={() => router.push(`/albums/${media?.albumId}` as any)}
				onSleepTimer={() => setSleepTimerVisible(true)}
			/>

			<SleepTimerModal
				visible={sleepTimerVisible}
				onClose={() => setSleepTimerVisible(false)}
			/>

			{/* Album picker */}
			<AddToAlbumPicker
				visible={albumPickerVisible}
				mediaId={mediaId}
				onClose={() => setAlbumPickerVisible(false)}
				onAdded={(name) => setAddedToAlbumName(name)}
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
