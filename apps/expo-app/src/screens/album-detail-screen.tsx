import { Pressable } from "@/components/ui/pressable";
import {
	getSwipeDeleteThreshold,
	SwipeDeleteAction,
} from "@/components/ui/swipe-delete-action";
import { formatDate } from "@acme/utils/dayjs";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Modal,
	RefreshControl,
	ScrollView,
	Text,
	TextInput,
	useWindowDimensions,
	View,
} from "react-native";
import ReanimatedSwipeable, {
	SwipeDirection,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
	Easing,
	Extrapolation,
	interpolate,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	type SharedValue,
} from "react-native-reanimated";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useColors } from "@/hooks/use-color";
import { minuteToString } from "@/lib/utils";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";

// ── Constants ─────────────────────────────────────────────────────────────────

const ALBUM_COLORS = [
	"#1e40af",
	"#0f766e",
	"#b45309",
	"#4f46e5",
	"#be123c",
	"#0369a1",
];
const SUGGESTION_DISPLAY_LIMIT = 25;
const SUGGESTION_POOL_LIMIT = 500;

function getInitials(name?: string | null) {
	if (!name) return "AL";
	return name
		.split(" ")
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("");
}

function albumColor(id: number) {
	return ALBUM_COLORS[id % ALBUM_COLORS.length];
}

function formatMediaSizeMb(size?: number | null) {
	if (!size || !Number.isFinite(size) || size <= 0) return null;
	const mb = size / (1024 * 1024);
	return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

function getMediaTelegramTime(media: any) {
	const value = media?.blog?.blogDate ?? media?.blogDate ?? media?.date;
	const time = value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
	return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function sortMediaByTelegramDate(items: any[]) {
	return [...items].sort(
		(a, b) => getMediaTelegramTime(a) - getMediaTelegramTime(b),
	);
}

function AlbumDetailSkeleton() {
	return (
		<ScrollView
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ paddingBottom: 40 }}
		>
			<View
				style={{
					alignItems: "center",
					paddingHorizontal: 24,
					paddingTop: 16,
					paddingBottom: 24,
					gap: 12,
				}}
			>
				<Skeleton className="h-40 w-40 rounded-[20px]" />
				<Skeleton className="h-6 w-3/5 rounded-md" />
				<Skeleton className="h-4 w-1/3 rounded-md" />
				<View style={{ width: "100%", alignItems: "center", gap: 7 }}>
					<Skeleton className="h-3.5 w-5/6 rounded-md" />
					<Skeleton className="h-3.5 w-2/3 rounded-md" />
				</View>
				<View style={{ flexDirection: "row", gap: 10 }}>
					<Skeleton className="h-7 w-20 rounded-full" />
					<Skeleton className="h-7 w-24 rounded-full" />
				</View>
				<View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
					<Skeleton className="h-12 flex-1 rounded-xl" />
					<Skeleton className="h-12 flex-1 rounded-xl" />
				</View>
			</View>

			<View style={{ paddingHorizontal: 16, gap: 12 }}>
				{[0, 1, 2, 3, 4].map((item) => (
					<View
						key={item}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 12,
						}}
					>
						<Skeleton className="h-12 w-12 rounded-xl" />
						<View style={{ flex: 1, gap: 8 }}>
							<Skeleton className="h-4 w-4/5 rounded-md" />
							<Skeleton className="h-3 w-2/5 rounded-md" />
						</View>
						<Skeleton className="h-8 w-8 rounded-full" />
					</View>
				))}
			</View>
		</ScrollView>
	);
}

// ── Edit-album modal ──────────────────────────────────────────────────────────

function EditAlbumModal({
	visible,
	album,
	onClose,
	onSave,
	isSaving,
}: {
	visible: boolean;
	album: { name: string; description?: string | null };
	onClose: () => void;
	onSave: (name: string, description: string) => void;
	isSaving: boolean;
}) {
	const colors = useColors();
	const [name, setName] = useState(album.name);
	const [description, setDescription] = useState(album.description ?? "");

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
					onPress={() => {}} // block tap-through
					style={{
						backgroundColor: colors.card,
						borderTopLeftRadius: 20,
						borderTopRightRadius: 20,
						padding: 24,
						gap: 16,
					}}
				>
					{/* Handle bar */}
					<View
						style={{
							width: 40,
							height: 4,
							backgroundColor: colors.input,
							borderRadius: 2,
							alignSelf: "center",
							marginBottom: 4,
						}}
					/>

					<Text
						style={{
							fontSize: 16,
							fontWeight: "700",
							color: colors.foreground,
							textAlign: "left",
						}}
					>
						Edit album
					</Text>

					{/* Name */}
					<View style={{ gap: 6 }}>
						<Text
							style={{
								fontSize: 12,
								color: colors.mutedForeground,
								textAlign: "right",
							}}
						>
							Album name
						</Text>
						<TextInput
							value={name}
							onChangeText={setName}
							placeholder="Enter a name..."
							placeholderTextColor={colors.input}
							style={{
								backgroundColor: colors.muted,
								borderRadius: 10,
								paddingHorizontal: 14,
								paddingVertical: 10,
								fontSize: 15,
								color: colors.foreground,
								textAlign: "left",
								borderWidth: 1,
								borderColor: colors.input,
							}}
						/>
					</View>

					{/* Description */}
					<View style={{ gap: 6 }}>
						<Text
							style={{
								fontSize: 12,
								color: colors.mutedForeground,
								textAlign: "right",
							}}
						>
							Description
						</Text>
						<TextInput
							value={description}
							onChangeText={setDescription}
							placeholder="Add an album description..."
							placeholderTextColor={colors.input}
							multiline
							numberOfLines={4}
							style={{
								backgroundColor: colors.muted,
								borderRadius: 10,
								paddingHorizontal: 14,
								paddingVertical: 10,
								fontSize: 14,
								color: colors.foreground,
								textAlign: "left",
								minHeight: 90,
								borderWidth: 1,
								borderColor: colors.input,
								textAlignVertical: "top",
							}}
						/>
					</View>

					{/* Actions */}
					<View style={{ flexDirection: "row", gap: 10, paddingBottom: 8 }}>
						<Pressable
							onPress={onClose}
							style={{
								flex: 1,
								paddingVertical: 12,
								borderRadius: 10,
								backgroundColor: colors.muted,
								alignItems: "center",
							}}
						>
							<Text
								style={{ color: colors.mutedForeground, fontWeight: "600" }}
							>
								Cancel
							</Text>
						</Pressable>
						<Pressable
							onPress={() => onSave(name.trim(), description.trim())}
							disabled={isSaving || !name.trim()}
							style={{
								flex: 2,
								paddingVertical: 12,
								borderRadius: 10,
								backgroundColor: colors.primary,
								alignItems: "center",
								opacity: isSaving || !name.trim() ? 0.6 : 1,
							}}
						>
							<Text
								style={{ color: colors.primaryForeground, fontWeight: "700" }}
							>
								{isSaving ? "Saving..." : "Save"}
							</Text>
						</Pressable>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

// ── Track row — normal view ───────────────────────────────────────────────────

function SwipeDeleteRow({
	children,
	onDelete,
	disabled = false,
}: {
	children: ReactNode;
	onDelete: () => void;
	disabled?: boolean;
}) {
	const { width } = useWindowDimensions();
	const swipeRef = useRef<any>(null);
	const isDeletingRef = useRef(false);
	const rowHeight = useSharedValue(0);
	const deleteProgress = useSharedValue(0);
	const fullSwipeThreshold = useMemo(
		() => getSwipeDeleteThreshold(width),
		[width],
	);

	const finishDelete = useCallback(() => {
		onDelete();
		isDeletingRef.current = false;
	}, [onDelete]);

	const handleSwipeWillOpen = useCallback(
		(direction: SwipeDirection) => {
			if (
				disabled ||
				direction !== SwipeDirection.LEFT ||
				isDeletingRef.current
			) {
				swipeRef.current?.close();
				return;
			}

			isDeletingRef.current = true;
			deleteProgress.value = withTiming(
				1,
				{ duration: 240, easing: Easing.out(Easing.cubic) },
				(finished) => {
					if (finished) {
						runOnJS(finishDelete)();
					}
				},
			);
		},
		[deleteProgress, disabled, finishDelete],
	);

	const containerStyle = useAnimatedStyle(() => {
		const measuredHeight = rowHeight.value;
		const height =
			measuredHeight > 0
				? interpolate(
						deleteProgress.value,
						[0, 1],
						[measuredHeight, 0],
						Extrapolation.CLAMP,
					)
				: undefined;

		return {
			height,
			opacity: interpolate(
				deleteProgress.value,
				[0, 0.7, 1],
				[1, 0.35, 0],
				Extrapolation.CLAMP,
			),
			overflow: "hidden",
			transform: [
				{
					translateX: interpolate(
						deleteProgress.value,
						[0, 1],
						[0, -Math.min(width * 0.18, 72)],
						Extrapolation.CLAMP,
					),
				},
			],
		};
	});

	const renderRightActions = useCallback(
		(progress: SharedValue<number>, translation: SharedValue<number>) => (
			<SwipeDeleteAction
				progress={progress}
				translation={translation}
				actionWidth={width}
				fullSwipeThreshold={fullSwipeThreshold}
			/>
		),
		[fullSwipeThreshold, width],
	);

	return (
		<Animated.View
			onLayout={(event) => {
				if (!isDeletingRef.current) {
					rowHeight.value = event.nativeEvent.layout.height;
				}
			}}
			style={containerStyle}
		>
			<ReanimatedSwipeable
				ref={swipeRef}
				enabled={!disabled}
				friction={1.15}
				overshootFriction={8}
				overshootRight={false}
				rightThreshold={fullSwipeThreshold}
				onSwipeableWillOpen={handleSwipeWillOpen}
				renderRightActions={renderRightActions}
			>
				{children}
			</ReanimatedSwipeable>
		</Animated.View>
	);
}

function TrackRow({
	media,
	displayIndex,
	onPress,
	onActions,
	isRemoving,
}: {
	media: any;
	displayIndex: number;
	onPress: () => void;
	onActions: () => void;
	isRemoving?: boolean;
}) {
	const colors = useColors();
	const duration = media.file?.duration ?? media.duration;
	const trackDate = media.blog?.blogDate ?? media.blogDate ?? media.date;
	const metadata = [
		duration != null ? minuteToString(duration) : null,
		trackDate ? formatDate(trackDate, "MMM D, YYYY") : null,
	].filter(Boolean);
	return (
		<Pressable
			onPress={onPress}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 12,
				paddingVertical: 12,
				borderBottomWidth: 1,
				borderBottomColor: colors.border,
			}}
		>
			<Text
				style={{
					fontSize: 13,
					fontWeight: "700",
					color: colors.mutedForeground,
					width: 24,
					textAlign: "center",
				}}
			>
				{displayIndex}
			</Text>
			<View style={{ flex: 1, gap: 2 }}>
				<Text
					style={{
						fontSize: 14,
						fontWeight: "600",
						color: colors.foreground,
						textAlign: "right",
					}}
					numberOfLines={1}
				>
					{media.title || media.file?.name || "Untitled"}
				</Text>
				{metadata.length > 0 && (
					<Text
						style={{
							fontSize: 12,
							color: colors.mutedForeground,
							textAlign: "right",
						}}
					>
						{metadata.join(" · ")}
					</Text>
				)}
			</View>
			<Pressable
				disabled={isRemoving}
				onPress={(event) => {
					event.stopPropagation();
					onActions();
				}}
				hitSlop={8}
				style={{ padding: 6, opacity: isRemoving ? 0.45 : 1 }}
			>
				<Icon name="MoreHorizontal" size={20} className="text-muted-foreground" />
			</Pressable>
		</Pressable>
	);
}

function TrackActionsSheet({
	visible,
	media,
	albums,
	currentAlbumId,
	isBusy,
	onClose,
	onRemove,
	onMove,
}: {
	visible: boolean;
	media: any | null;
	albums: any[];
	currentAlbumId: number;
	isBusy?: boolean;
	onClose: () => void;
	onRemove: () => void;
	onMove: (albumId: number) => void;
}) {
	const colors = useColors();
	const { height: windowHeight } = useWindowDimensions();
	const title =
		media?.title || media?.file?.fileName || media?.blog?.content || "Track";
	const targetAlbums = albums.filter((album) => album.id !== currentAlbumId);

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
		>
			<Pressable
				onPress={onClose}
				style={{
					flex: 1,
					justifyContent: "flex-end",
					backgroundColor: "rgba(0,0,0,0.6)",
				}}
			>
				<Pressable
					onPress={() => {}}
					style={{
						width: "100%",
						maxHeight: Math.min(Math.max(360, windowHeight * 0.72), windowHeight - 24),
						borderTopLeftRadius: 22,
						borderTopRightRadius: 22,
						backgroundColor: colors.card,
						paddingHorizontal: 18,
						paddingTop: 14,
						paddingBottom: 28,
					}}
				>
					<View
						style={{
							width: 42,
							height: 4,
							borderRadius: 999,
							backgroundColor: colors.input,
							alignSelf: "center",
							marginBottom: 14,
						}}
					/>
					<Text
						style={{
							fontSize: 15,
							fontWeight: "800",
							color: colors.foreground,
							textAlign: "right",
						}}
						numberOfLines={1}
					>
						{title}
					</Text>

					<Pressable
						disabled={isBusy}
						onPress={onRemove}
						style={{
							marginTop: 16,
							minHeight: 48,
							borderRadius: 14,
							backgroundColor: colors.muted,
							flexDirection: "row-reverse",
							alignItems: "center",
							gap: 10,
							paddingHorizontal: 14,
							opacity: isBusy ? 0.5 : 1,
						}}
					>
						<Icon name="X" size={18} className="text-destructive" />
						<Text
							style={{
								flex: 1,
								fontSize: 14,
								fontWeight: "700",
								color: colors.destructive,
								textAlign: "right",
							}}
						>
							Remove from album
						</Text>
					</Pressable>

					<Text
						style={{
							marginTop: 18,
							marginBottom: 8,
							fontSize: 12,
							fontWeight: "800",
							letterSpacing: 0.5,
							color: colors.mutedForeground,
							textAlign: "right",
							textTransform: "uppercase",
						}}
					>
						Move to album
					</Text>

					{targetAlbums.length === 0 ? (
						<Text
							style={{
								paddingVertical: 16,
								fontSize: 13,
								color: colors.mutedForeground,
								textAlign: "center",
							}}
						>
							No other albums available
						</Text>
					) : (
						<FlatList
							data={targetAlbums}
							keyExtractor={(album) => String(album.id)}
							style={{ flexGrow: 0 }}
							showsVerticalScrollIndicator={false}
							renderItem={({ item, index }) => (
								<Pressable
									disabled={isBusy}
									onPress={() => onMove(item.id)}
									style={{
										minHeight: 52,
										flexDirection: "row-reverse",
										alignItems: "center",
										gap: 12,
										borderBottomWidth: 1,
										borderBottomColor: colors.border,
										opacity: isBusy ? 0.5 : 1,
									}}
								>
									<View
										style={{
											width: 36,
											height: 36,
											borderRadius: 8,
											alignItems: "center",
											justifyContent: "center",
											backgroundColor:
												ALBUM_COLORS[index % ALBUM_COLORS.length],
										}}
									>
										<Text
											style={{
												fontSize: 12,
												fontWeight: "800",
												color: "#fff",
											}}
										>
											{getInitials(item.name)}
										</Text>
									</View>
									<View style={{ flex: 1 }}>
										<Text
											style={{
												fontSize: 14,
												fontWeight: "700",
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
							)}
						/>
					)}
				</Pressable>
			</Pressable>
		</Modal>
	);
}

// ── Track row — reorder view ──────────────────────────────────────────────────

function ReorderRow({
	media,
	displayIndex,
	isFirst,
	isLast,
	onMoveUp,
	onMoveDown,
}: {
	media: any;
	displayIndex: number;
	isFirst: boolean;
	isLast: boolean;
	onMoveUp: () => void;
	onMoveDown: () => void;
}) {
	const colors = useColors();
	const duration = media.file?.duration ?? media.duration;
	const trackDate = media.blog?.blogDate ?? media.blogDate ?? media.date;
	const metadata = [
		duration != null ? minuteToString(duration) : null,
		trackDate ? formatDate(trackDate, "MMM D, YYYY") : null,
	].filter(Boolean);
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 10,
				paddingVertical: 10,
				borderBottomWidth: 1,
				borderBottomColor: colors.border,
				backgroundColor: colors.background,
			}}
		>
			{/* Up/Down controls */}
			<View style={{ alignItems: "center", gap: 2 }}>
				<Pressable
					onPress={onMoveUp}
					disabled={isFirst}
					style={{ padding: 4, opacity: isFirst ? 0.2 : 1 }}
				>
					<Icon name="ChevronUp" size={18} className="text-muted-foreground" />
				</Pressable>
				<Pressable
					onPress={onMoveDown}
					disabled={isLast}
					style={{ padding: 4, opacity: isLast ? 0.2 : 1 }}
				>
					<Icon
						name="ChevronDown"
						size={18}
						className="text-muted-foreground"
					/>
				</Pressable>
			</View>

			{/* Index badge */}
			<View
				style={{
					width: 28,
					height: 28,
					borderRadius: 6,
					backgroundColor: colors.muted,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Text
					style={{
						fontSize: 12,
						fontWeight: "700",
						color: colors.mutedForeground,
					}}
				>
					{displayIndex}
				</Text>
			</View>

			{/* Info */}
			<View style={{ flex: 1, gap: 1 }}>
				<Text
					style={{
						fontSize: 14,
						fontWeight: "600",
						color: colors.foreground,
						textAlign: "right",
					}}
					numberOfLines={1}
				>
					{media.title || media.file?.name || "Untitled"}
				</Text>
				{metadata.length > 0 && (
					<Text
						style={{
							fontSize: 12,
							color: colors.mutedForeground,
							textAlign: "right",
						}}
					>
						{metadata.join(" · ")}
					</Text>
				)}
			</View>

			{/* Drag handle indicator */}
			<Icon
				name="GripVertical"
				size={18}
				className="text-muted-foreground"
				style={{ opacity: 0.4 }}
			/>
		</View>
	);
}

// ── Suggested media row ──────────────────────────────────────────────────────

function SuggestedMediaRow({
	media,
	selected,
	onPress,
	onAdd,
	isAdding,
}: {
	media: any;
	selected: boolean;
	onPress: () => void;
	onAdd: () => void;
	isAdding?: boolean;
}) {
	const colors = useColors();
	const duration = media.file?.duration;
	const sizeLabel = formatMediaSizeMb(media.file?.fileSize ?? media.fileSize);
	const title =
		media.title || media.file?.fileName || media.blog?.content || "Untitled";
	const matchingTerms = media.matchingTerms ?? [];

	return (
		<Pressable
			onPress={onPress}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 10,
				paddingVertical: 11,
				borderBottomWidth: 1,
				borderBottomColor: colors.border,
			}}
		>
			<View
				style={{
					width: 22,
					height: 22,
					borderRadius: 9999,
					borderWidth: 2,
					borderColor: selected ? colors.primary : colors.mutedForeground,
					backgroundColor: selected ? colors.primary : "transparent",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{selected && <Icon name="Check" size={12} className="text-white" />}
			</View>

			<View style={{ flex: 1, gap: 4 }}>
				<Text
					style={{
						fontSize: 14,
						fontWeight: "600",
						color: colors.foreground,
						textAlign: "right",
					}}
					numberOfLines={1}
				>
					{title}
				</Text>

				<View
					style={{
						flexDirection: "row",
						flexWrap: "wrap",
						justifyContent: "flex-end",
						gap: 6,
					}}
				>
					{duration != null && (
						<Text style={{ fontSize: 11, color: colors.mutedForeground }}>
							{minuteToString(duration)}
						</Text>
					)}
					{sizeLabel && (
						<Text style={{ fontSize: 11, color: colors.mutedForeground }}>
							{sizeLabel}
						</Text>
					)}
					{media.blog?.blogDate && (
						<Text style={{ fontSize: 11, color: colors.mutedForeground }}>
							{formatDate(media.blog.blogDate, "MMM D, YYYY")}
						</Text>
					)}
					{matchingTerms.slice(0, 3).map((term: string) => (
						<Text key={term} style={{ fontSize: 11, color: colors.primary }}>
							{term}
						</Text>
					))}
				</View>
			</View>

			<View
				style={{
					minWidth: 28,
					height: 24,
					paddingHorizontal: 6,
					borderRadius: 8,
					backgroundColor: colors.muted,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Text
					style={{
						fontSize: 11,
						fontWeight: "700",
						color: colors.mutedForeground,
					}}
				>
					{media.matchScore}
				</Text>
			</View>

			<Pressable
				disabled={isAdding}
				onPress={(event) => {
					event.stopPropagation();
					onAdd();
				}}
				hitSlop={8}
				style={{
					width: 32,
					height: 32,
					borderRadius: 16,
					backgroundColor: colors.primary,
					alignItems: "center",
					justifyContent: "center",
					opacity: isAdding ? 0.55 : 1,
				}}
			>
				{isAdding ? (
					<ActivityIndicator size="small" color={colors.primaryForeground} />
				) : (
					<Icon name="Plus" size={16} className="text-primary-foreground" />
				)}
			</Pressable>
		</Pressable>
	);
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AlbumDetailScreen() {
	const router = useRouter();
	const qc = useQueryClient();
	const colors = useColors();
	const setGlobalAudioBarHidden = useGlobalAudioBarStore((s) => s.setHidden);
	const previousGlobalAudioHiddenRef = useRef<boolean | null>(null);
	const { albumId } = useLocalSearchParams<{ albumId: string }>();
	const id = Number(albumId);

	const {
		data: album,
		isFetching: isFetchingAlbum,
		isLoading,
		refetch: refetchAlbum,
	} = useQuery(
		_trpc.album.getAlbum.queryOptions({ id }),
	);
	const { data: albums = [], refetch: refetchAlbums } = useQuery(
		_trpc.album.getAlbums.queryOptions(),
	);
	const { data: booksData, refetch: refetchBooks } = useQuery(
		_trpc.book.getBooks.queryOptions({ limit: 20 }),
	);

	// Local track order state (mirrors server, mutated on reorder actions)
	const [localTracks, setLocalTracks] = useState<any[] | null>(null);
	const [reorderMode, setReorderMode] = useState(false);
	const [editModalVisible, setEditModalVisible] = useState(false);
	const [descExpanded, setDescExpanded] = useState(false);
	const [selectedTrackForActions, setSelectedTrackForActions] = useState<
		any | null
	>(null);
	const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<
		Set<number>
	>(new Set());
	const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<
		Set<number>
	>(new Set());
	const [suggestionsRequested, setSuggestionsRequested] = useState(false);
	const [suggestionKeyword, setSuggestionKeyword] = useState("");
	const [addingSuggestionIds, setAddingSuggestionIds] = useState<Set<number>>(
		new Set(),
	);
	const autoLoadedSuggestionAlbumRef = useRef<number | null>(null);

	const rawTracks: any[] = localTracks ?? album?.medias ?? [];
	const tracks = useMemo(
		() => (reorderMode ? rawTracks : sortMediaByTelegramDate(rawTracks)),
		[rawTracks, reorderMode],
	);
	const bgColor = albumColor(id);
	const selectedSuggestionCount = selectedSuggestionIds.size;
	const normalizedSuggestionKeyword = suggestionKeyword.trim();
	const libraryBooks = Array.isArray((booksData as any)?.data)
		? ((booksData as any).data as any[])
		: [];
	const attachedBookReferences = Array.isArray((album as any)?.bookReferences)
		? ((album as any).bookReferences as any[])
		: [];
	const attachedBookIds = new Set(
		attachedBookReferences.map((reference) => reference.bookId),
	);
	const attachableBooks = libraryBooks.filter(
		(book) => !attachedBookIds.has(book.id),
	);

	const {
		data: suggestedMedia = [],
		isFetching: isFetchingSuggestions,
		refetch: refetchSuggestedMedia,
	} = useQuery({
		..._trpc.album.getSuggestedMedia.queryOptions({
			albumId: id,
			limit: SUGGESTION_POOL_LIMIT,
			keyword: normalizedSuggestionKeyword || undefined,
		}),
		enabled: suggestionsRequested,
	});
	const visibleSuggestedMedia = suggestedMedia.filter(
		(media: any) => !dismissedSuggestionIds.has(media.id),
	);
	const displayedSuggestedMedia = visibleSuggestedMedia.slice(
		0,
		SUGGESTION_DISPLAY_LIMIT,
	);
	const hasNoMoreSuggestions =
		suggestionsRequested &&
		!isFetchingSuggestions &&
		suggestedMedia.length > 0 &&
		visibleSuggestedMedia.length <= SUGGESTION_DISPLAY_LIMIT;

	const { mutate: saveOrder, isPending: isSavingOrder } = useMutation(
		_trpc.album.reorderTracks.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: _trpc.album.getAlbum.queryKey({ id }),
				});
				setLocalTracks(null);
				setReorderMode(false);
			},
			onError: (e) => Alert.alert("Error", e.message),
		}),
	);

	const { mutate: updateAlbum, isPending: isUpdating } = useMutation(
		_trpc.album.updateAlbum.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: _trpc.album.getAlbum.queryKey({ id }),
				});
				setEditModalVisible(false);
			},
			onError: (e) => Alert.alert("Error", e.message),
		}),
	);

	const { mutate: addSuggestedMedia, isPending: isAddingSuggestions } =
		useMutation(
			_trpc.album.addMediaToAlbum.mutationOptions({
				onSuccess: (result, variables) => {
					qc.invalidateQueries({
						queryKey: _trpc.album.getAlbum.queryKey({ id }),
					});
					qc.invalidateQueries({ queryKey: _trpc.album.getAlbums.queryKey() });
					qc.invalidateQueries({
						queryKey: _trpc.album.getSuggestedMedia.queryKey({
							albumId: id,
							limit: SUGGESTION_POOL_LIMIT,
							keyword: normalizedSuggestionKeyword || undefined,
						}),
					});
					const addedIds = new Set(variables.mediaIds);
					setDismissedSuggestionIds((prev) => new Set([...prev, ...addedIds]));
					setSelectedSuggestionIds(new Set());
					if (result.added > 1) {
						Alert.alert("Added to album", `${result.added} audio items added.`);
					}
				},
				onError: (e) => Alert.alert("Error", e.message),
			}),
		);

	const { mutateAsync: addOneSuggestedMedia } = useMutation(
		_trpc.album.addMediaToAlbum.mutationOptions(),
	);

	const { mutate: removeMediaFromAlbum, isPending: isRemovingMedia } =
		useMutation(
			_trpc.album.removeMediaFromAlbum.mutationOptions({
				onSuccess: async () => {
					await Promise.all([
						qc.invalidateQueries({
							queryKey: _trpc.album.getAlbum.queryKey({ id }),
						}),
						qc.invalidateQueries({
							queryKey: _trpc.album.getAlbums.queryKey(),
						}),
					]);
					setLocalTracks(null);
				},
				onError: (e) => {
					Alert.alert("Error", e.message);
					setLocalTracks(null);
				},
			}),
		);

	const { mutate: moveMediaToAlbum, isPending: isMovingMedia } = useMutation(
		_trpc.album.addMediaToAlbum.mutationOptions({
			onSuccess: async (_result, variables) => {
				await Promise.all([
					qc.invalidateQueries({
						queryKey: _trpc.album.getAlbum.queryKey({ id }),
					}),
					qc.invalidateQueries({
						queryKey: _trpc.album.getAlbum.queryKey({ id: variables.albumId }),
					}),
					qc.invalidateQueries({ queryKey: _trpc.album.getAlbums.queryKey() }),
				]);
				setSelectedTrackForActions(null);
				setLocalTracks(null);
			},
			onError: (e) => {
				Alert.alert("Error", e.message);
				setLocalTracks(null);
			},
		}),
	);

	const { mutate: saveSuggestionKeywords } = useMutation(
		_trpc.album.updateSuggestionKeywords.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: _trpc.album.getAlbum.queryKey({ id }),
				});
			},
			onError: (e) => Alert.alert("Error", e.message),
		}),
	);

	useEffect(() => {
		if (selectedSuggestionCount > 0) {
			if (previousGlobalAudioHiddenRef.current == null) {
				previousGlobalAudioHiddenRef.current =
					useGlobalAudioBarStore.getState().hidden;
			}
			setGlobalAudioBarHidden(true);
			return;
		}

		if (previousGlobalAudioHiddenRef.current != null) {
			setGlobalAudioBarHidden(previousGlobalAudioHiddenRef.current);
			previousGlobalAudioHiddenRef.current = null;
		}
	}, [selectedSuggestionCount, setGlobalAudioBarHidden]);

	useEffect(() => {
		return () => {
			if (previousGlobalAudioHiddenRef.current != null) {
				setGlobalAudioBarHidden(previousGlobalAudioHiddenRef.current);
				previousGlobalAudioHiddenRef.current = null;
			}
		};
	}, [setGlobalAudioBarHidden]);

	useEffect(() => {
		if (!album?.id || autoLoadedSuggestionAlbumRef.current === album.id) return;

		const savedKeywords = ((album as any).suggestionKeywords ?? "").trim();
		autoLoadedSuggestionAlbumRef.current = album.id;
		setSuggestionKeyword(savedKeywords);
		setSuggestionsRequested(Boolean(savedKeywords));
		setSelectedSuggestionIds(new Set());
		setDismissedSuggestionIds(new Set());
	}, [album]);

	const { mutate: attachBook, isPending: isAttachingBook } = useMutation(
		_trpc.album.attachBook.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: _trpc.album.getAlbum.queryKey({ id }),
				});
			},
			onError: (e) => Alert.alert("Error", e.message),
		}),
	);

	const { mutate: detachBook, isPending: isDetachingBook } = useMutation(
		_trpc.album.detachBook.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: _trpc.album.getAlbum.queryKey({ id }),
				});
			},
			onError: (e) => Alert.alert("Error", e.message),
		}),
	);

	// When entering reorder mode, snapshot current server tracks into local state
	function enterReorderMode() {
		setLocalTracks([...tracks]);
		setReorderMode(true);
	}

	function cancelReorder() {
		setLocalTracks(null);
		setReorderMode(false);
	}

	function commitOrder() {
		const order = tracks.map((media, i) => ({
			mediaId: media.id,
			index: i + 1,
		}));
		saveOrder({ albumId: id, order });
	}

	const moveTrack = useCallback(
		(fromIdx: number, toIdx: number) => {
			setLocalTracks((prev) => {
				const arr = [...(prev ?? tracks)];
				const [item] = arr.splice(fromIdx, 1);
				arr.splice(toIdx, 0, item);
				return arr;
			});
		},
		[tracks],
	);

	function toggleSuggestion(mediaId: number) {
		setSelectedSuggestionIds((prev) => {
			const next = new Set(prev);
			if (next.has(mediaId)) next.delete(mediaId);
			else next.add(mediaId);
			return next;
		});
	}

	function selectAllSuggestions() {
		setSelectedSuggestionIds(
			new Set(displayedSuggestedMedia.map((media: any) => media.id)),
		);
	}

	function clearSuggestionSelection() {
		setSelectedSuggestionIds(new Set());
	}

	function deleteSelectedSuggestions() {
		if (selectedSuggestionCount === 0) return;
		setDismissedSuggestionIds(
			(prev) => new Set([...prev, ...selectedSuggestionIds]),
		);
		setSelectedSuggestionIds(new Set());
	}

	function addSelectedSuggestions() {
		const mediaIds = Array.from(selectedSuggestionIds);
		if (mediaIds.length === 0) return;
		addSuggestedMedia({ albumId: id, mediaIds });
	}

	function suggestMoreForAlbum() {
		setSuggestionsRequested(true);
		setSelectedSuggestionIds(new Set());
		setDismissedSuggestionIds(new Set());
		saveSuggestionKeywords({
			id,
			suggestionKeywords: normalizedSuggestionKeyword,
		});
		void refetchSuggestedMedia();
	}

	const refreshAlbumScreen = useCallback(() => {
		void Promise.all([
			refetchAlbum(),
			refetchAlbums(),
			refetchBooks(),
			suggestionsRequested ? refetchSuggestedMedia() : Promise.resolve(),
		]);
	}, [
		refetchAlbum,
		refetchAlbums,
		refetchBooks,
		refetchSuggestedMedia,
		suggestionsRequested,
	]);

	async function addOneSuggestion(media: any) {
		const mediaId = media.id;
		if (addingSuggestionIds.has(mediaId)) return;

		setAddingSuggestionIds((prev) => new Set(prev).add(mediaId));

		try {
			const result = await addOneSuggestedMedia({
				albumId: id,
				mediaIds: [mediaId],
			});

			if (result.added > 0) {
				setLocalTracks((prev) => {
					const base = prev ?? tracks;
					if (base.some((track) => track.id === mediaId)) return base;
					return sortMediaByTelegramDate([...base, media]);
				});
				qc.setQueryData(_trpc.album.getAlbums.queryKey(), (old: any) =>
					Array.isArray(old)
						? old.map((albumItem) =>
								albumItem.id === id
									? {
											...albumItem,
											_count: {
												...albumItem._count,
												medias: (albumItem._count?.medias ?? 0) + 1,
											},
										}
									: albumItem,
							)
						: old,
				);
			}

			setDismissedSuggestionIds((prev) => new Set(prev).add(mediaId));
			setSelectedSuggestionIds((prev) => {
				if (!prev.has(mediaId)) return prev;
				const next = new Set(prev);
				next.delete(mediaId);
				return next;
			});
		} catch (error) {
			Alert.alert(
				"Add failed",
				error instanceof Error
					? error.message
					: "Could not add this audio to the album.",
			);
		} finally {
			setAddingSuggestionIds((prev) => {
				const next = new Set(prev);
				next.delete(mediaId);
				return next;
			});
		}
	}

	function dismissSuggestion(mediaId: number) {
		setDismissedSuggestionIds((prev) => {
			const next = new Set(prev);
			next.add(mediaId);
			return next;
		});
		setSelectedSuggestionIds((prev) => {
			if (!prev.has(mediaId)) return prev;
			const next = new Set(prev);
			next.delete(mediaId);
			return next;
		});
	}

	function removeTrackFromAlbum(mediaId: number) {
		setLocalTracks((prev) =>
			(prev ?? tracks).filter((media) => media.id !== mediaId),
		);
		setSelectedTrackForActions(null);
		removeMediaFromAlbum({ albumId: id, mediaId });
	}

	function moveTrackToAlbum(targetAlbumId: number) {
		const mediaId = selectedTrackForActions?.id;
		if (!mediaId) return;
		setLocalTracks((prev) =>
			(prev ?? tracks).filter((media) => media.id !== mediaId),
		);
		moveMediaToAlbum({ albumId: targetAlbumId, mediaIds: [mediaId] });
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.background }}>
			<SafeArea>
				{/* Header */}
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						paddingHorizontal: 16,
						paddingVertical: 12,
					}}
				>
					<Pressable
						onPress={() => router.back()}
						style={{
							width: 36,
							height: 36,
							borderRadius: 18,
							backgroundColor: colors.muted,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Icon name="ChevronLeft" size={22} className="text-foreground" />
					</Pressable>

					<Text
						style={{
							fontSize: 15,
							fontWeight: "700",
							color: colors.foreground,
							flex: 1,
							textAlign: "center",
							marginHorizontal: 8,
						}}
						numberOfLines={1}
					>
						{album?.name ?? "Album"}
					</Text>

					<Pressable
						onPress={() => setEditModalVisible(true)}
						style={{
							width: 36,
							height: 36,
							borderRadius: 18,
							backgroundColor: colors.muted,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Icon name="Pencil" size={16} className="text-muted-foreground" />
					</Pressable>
				</View>

				{isLoading ? (
					<AlbumDetailSkeleton />
				) : !album ? (
					<View
						style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
					>
						<Text style={{ color: colors.mutedForeground }}>
							Album not found
						</Text>
					</View>
				) : (
					<ScrollView
						showsVerticalScrollIndicator={false}
						keyboardShouldPersistTaps="handled"
						removeClippedSubviews={false}
						refreshControl={
							<RefreshControl
								refreshing={isFetchingAlbum && !isLoading}
								onRefresh={refreshAlbumScreen}
								tintColor={colors.primary}
								colors={[colors.primary]}
							/>
						}
					>
						{/* Hero */}
						<View
							style={{
								alignItems: "center",
								paddingHorizontal: 24,
								paddingTop: 16,
								paddingBottom: 24,
								gap: 10,
							}}
						>
							{/* Art — white initials on brand color, intentional */}
							<View
								style={{
									width: 160,
									height: 160,
									borderRadius: 20,
									backgroundColor: bgColor,
									alignItems: "center",
									justifyContent: "center",
									shadowColor: bgColor,
									shadowOffset: { width: 0, height: 8 },
									shadowOpacity: 0.5,
									shadowRadius: 20,
									elevation: 12,
								}}
							>
								<Text
									style={{ fontSize: 52, fontWeight: "800", color: "#fff" }}
								>
									{getInitials(album.name)}
								</Text>
							</View>

							{/* Name */}
							<Text
								style={{
									fontSize: 22,
									fontWeight: "800",
									color: colors.foreground,
									textAlign: "center",
									marginTop: 4,
								}}
							>
								{album.name}
							</Text>

							{/* Author */}
							{album.author?.name && (
								<Text
									style={{
										fontSize: 14,
										color: colors.primary,
										fontWeight: "600",
									}}
								>
									{album.author.name}
								</Text>
							)}

							{/* Description */}
							{album.description ? (
								<Pressable
									onPress={() => setDescExpanded((v) => !v)}
									style={{ width: "100%" }}
								>
									<Text
										style={{
											fontSize: 14,
											color: colors.mutedForeground,
											textAlign: "center",
											lineHeight: 22,
											writingDirection: "rtl",
										}}
										numberOfLines={descExpanded ? undefined : 2}
									>
										{album.description}
									</Text>
									{album.description.length > 80 && (
										<Text
											style={{
												fontSize: 12,
												color: colors.primary,
												textAlign: "center",
												marginTop: 4,
											}}
										>
											{descExpanded ? "Less" : "More"}
										</Text>
									)}
								</Pressable>
							) : (
								<Pressable onPress={() => setEditModalVisible(true)}>
									<Text
										style={{
											fontSize: 13,
											color: colors.input,
											fontStyle: "italic",
										}}
									>
										Add an album description...
									</Text>
								</Pressable>
							)}

							{/* Meta pills */}
							<View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
								<View
									style={{
										paddingHorizontal: 10,
										paddingVertical: 4,
										backgroundColor: colors.card,
										borderRadius: 99,
									}}
								>
									<Text style={{ fontSize: 12, color: colors.mutedForeground }}>
										{album.medias?.length ?? 0} tracks
									</Text>
								</View>
								{album.albumType && (
									<View
										style={{
											paddingHorizontal: 10,
											paddingVertical: 4,
											backgroundColor: colors.card,
											borderRadius: 99,
										}}
									>
										<Text
											style={{ fontSize: 12, color: colors.mutedForeground }}
										>
											{album.albumType}
										</Text>
									</View>
								)}
							</View>

							{/* Action buttons */}
							<View
								style={{
									flexDirection: "row",
									gap: 12,
									marginTop: 8,
									width: "100%",
								}}
							>
								<Pressable
									onPress={() => {
										const first = tracks[0];
										if (first?.blog?.id) {
											router.push(`/blog-view-2/${first.blog.id}` as any);
										}
									}}
									style={{
										flex: 1,
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "center",
										gap: 8,
										paddingVertical: 13,
										borderRadius: 12,
										backgroundColor: colors.primary,
									}}
								>
									<Icon
										name="Play"
										size={18}
										className="text-primary-foreground"
									/>
									<Text
										style={{
											fontSize: 14,
											fontWeight: "700",
											color: colors.primaryForeground,
										}}
									>
										Play all
									</Text>
								</Pressable>
								<Pressable
									style={{
										width: 48,
										height: 48,
										borderRadius: 12,
										backgroundColor: colors.muted,
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Icon
										name="Shuffle"
										size={20}
										className="text-muted-foreground"
									/>
								</Pressable>
							</View>

							<View style={{ width: "100%", gap: 10, marginTop: 8 }}>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "space-between",
									}}
								>
									<Text
										style={{
											fontSize: 14,
											fontWeight: "700",
											color: colors.foreground,
										}}
									>
										Books
									</Text>
									<Text style={{ fontSize: 12, color: colors.mutedForeground }}>
										{attachedBookReferences.length} attached
									</Text>
								</View>

								{attachedBookReferences.length > 0 && (
									<View style={{ gap: 6 }}>
										{attachedBookReferences.map((reference) => (
											<View
												key={reference.id}
												style={{
													flexDirection: "row-reverse",
													alignItems: "center",
													gap: 8,
													borderRadius: 10,
													backgroundColor: colors.card,
													paddingHorizontal: 12,
													paddingVertical: 9,
												}}
											>
												<Pressable
													onPress={() =>
														router.push(`/books/${reference.bookId}` as any)
													}
													style={{
														flex: 1,
														flexDirection: "row-reverse",
														alignItems: "center",
														gap: 8,
													}}
												>
													<Icon
														name="BookOpen"
														size={16}
														className="text-primary"
													/>
													<Text
														style={{
															flex: 1,
															fontSize: 13,
															fontWeight: "600",
															color: colors.foreground,
															textAlign: "right",
															writingDirection: "rtl",
														}}
														numberOfLines={1}
													>
														{reference.book?.nameAr ??
															reference.book?.nameEn ??
															"Book"}
													</Text>
												</Pressable>
												<Pressable
													disabled={isDetachingBook}
													onPress={() => detachBook({ id: reference.id })}
													style={{
														width: 28,
														height: 28,
														borderRadius: 14,
														alignItems: "center",
														justifyContent: "center",
														opacity: isDetachingBook ? 0.45 : 1,
													}}
												>
													<Icon
														name="Trash2"
														size={14}
														className="text-muted-foreground"
													/>
												</Pressable>
											</View>
										))}
									</View>
								)}

								{attachableBooks.length > 0 && (
									<ScrollView
										horizontal
										showsHorizontalScrollIndicator={false}
										contentContainerStyle={{ gap: 8 }}
									>
										{attachableBooks.slice(0, 8).map((book) => (
											<Pressable
												key={book.id}
												disabled={isAttachingBook}
												onPress={() =>
													attachBook({ albumId: id, bookId: book.id })
												}
												style={{
													width: 150,
													borderRadius: 10,
													backgroundColor: colors.card,
													padding: 10,
													gap: 6,
													opacity: isAttachingBook ? 0.55 : 1,
												}}
											>
												<Icon name="Plus" size={15} className="text-primary" />
												<Text
													style={{
														fontSize: 12,
														fontWeight: "600",
														color: colors.foreground,
														textAlign: "right",
														writingDirection: "rtl",
													}}
													numberOfLines={2}
												>
													{book.nameAr ?? book.nameEn ?? "Book"}
												</Text>
											</Pressable>
										))}
									</ScrollView>
								)}
							</View>
						</View>

						{/* Tracks section */}
						<View style={{ paddingHorizontal: 16, paddingBottom: 60 }}>
							{/* Section header */}
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
									paddingBottom: 8,
									borderBottomWidth: 1,
									borderBottomColor: colors.border,
									marginBottom: 4,
								}}
							>
								<Text
									style={{
										fontSize: 14,
										fontWeight: "700",
										color: colors.foreground,
									}}
								>
									Tracks
								</Text>

								{tracks.length > 0 && !reorderMode && (
									<Pressable
										onPress={enterReorderMode}
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 4,
											paddingHorizontal: 10,
											paddingVertical: 5,
											backgroundColor: colors.muted,
											borderRadius: 8,
										}}
									>
										<Icon
											name="ListOrdered"
											size={14}
											className="text-muted-foreground"
										/>
										<Text
											style={{ fontSize: 12, color: colors.mutedForeground }}
										>
											Reorder
										</Text>
									</Pressable>
								)}

								{reorderMode && (
									<View style={{ flexDirection: "row", gap: 8 }}>
										<Pressable
											onPress={cancelReorder}
											style={{
												paddingHorizontal: 10,
												paddingVertical: 5,
												backgroundColor: colors.muted,
												borderRadius: 8,
											}}
										>
											<Text
												style={{ fontSize: 12, color: colors.mutedForeground }}
											>
												Cancel
											</Text>
										</Pressable>
										<Pressable
											onPress={commitOrder}
											disabled={isSavingOrder}
											style={{
												paddingHorizontal: 12,
												paddingVertical: 5,
												backgroundColor: colors.primary,
												borderRadius: 8,
												opacity: isSavingOrder ? 0.6 : 1,
											}}
										>
											<Text
												style={{
													fontSize: 12,
													fontWeight: "700",
													color: colors.primaryForeground,
												}}
											>
												{isSavingOrder ? "..." : "Save order"}
											</Text>
										</Pressable>
									</View>
								)}
							</View>

							{tracks.length === 0 ? (
								<View
									style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}
								>
									<Icon
										name="Music2"
										size={40}
										className="text-muted-foreground"
									/>
									<Text style={{ fontSize: 14, color: colors.mutedForeground }}>
										No tracks yet
									</Text>
								</View>
							) : reorderMode ? (
								tracks.map((media, idx) => (
									<ReorderRow
										key={media.id}
										media={media}
										displayIndex={idx + 1}
										isFirst={idx === 0}
										isLast={idx === tracks.length - 1}
										onMoveUp={() => moveTrack(idx, idx - 1)}
										onMoveDown={() => moveTrack(idx, idx + 1)}
									/>
								))
							) : (
								tracks.map((media, idx) => (
									<TrackRow
										key={media.id}
										media={media}
										displayIndex={idx + 1}
										isRemoving={isRemovingMedia || isMovingMedia}
										onActions={() => setSelectedTrackForActions(media)}
										onPress={() => {
											if (media.blog?.id) {
												router.push(`/blog-view-2/${media.blog.id}` as any);
											}
										}}
									/>
								))
							)}

							{/* Suggested media section */}
							<View style={{ paddingTop: 28 }}>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "space-between",
										paddingBottom: 8,
										borderBottomWidth: 1,
										borderBottomColor: colors.border,
									}}
								>
									<View style={{ alignItems: "flex-start" }}>
										<Text
											style={{
												fontSize: 14,
												fontWeight: "700",
												color: colors.foreground,
											}}
										>
											More for this album
										</Text>
										<Text
											style={{
												fontSize: 11,
												color: colors.mutedForeground,
												marginTop: 2,
											}}
										>
											Add a keyword to search this channel by that keyword.
										</Text>
									</View>

									<View style={{ flexDirection: "row", gap: 8 }}>
										<Pressable
											onPress={suggestMoreForAlbum}
											disabled={isFetchingSuggestions || isAddingSuggestions}
											style={{
												paddingHorizontal: 10,
												paddingVertical: 5,
												backgroundColor: colors.primary,
												borderRadius: 8,
												opacity:
													isFetchingSuggestions || isAddingSuggestions
														? 0.5
														: 1,
											}}
										>
											<Text
												style={{
													fontSize: 12,
													fontWeight: "700",
													color: colors.primaryForeground,
												}}
											>
												{suggestionsRequested ? "Refresh" : "Suggest more"}
											</Text>
										</Pressable>
										{suggestionsRequested &&
											displayedSuggestedMedia.length > 0 && (
												<Pressable
													onPress={
														selectedSuggestionCount ===
														displayedSuggestedMedia.length
															? clearSuggestionSelection
															: selectAllSuggestions
													}
													disabled={isAddingSuggestions}
													style={{
														paddingHorizontal: 10,
														paddingVertical: 5,
														backgroundColor: colors.muted,
														borderRadius: 8,
														opacity: isAddingSuggestions ? 0.5 : 1,
													}}
												>
													<Text
														style={{
															fontSize: 12,
															color: colors.mutedForeground,
														}}
													>
														{selectedSuggestionCount ===
														displayedSuggestedMedia.length
															? "Clear"
															: "Mark all"}
													</Text>
												</Pressable>
											)}
									</View>
								</View>

								<View style={{ paddingTop: 12, paddingBottom: 4 }}>
									<TextInput
										value={suggestionKeyword}
										onChangeText={(value) => {
											setSuggestionKeyword(value);
											setSelectedSuggestionIds(new Set());
											setDismissedSuggestionIds(new Set());
										}}
										placeholder="Keyword, keyword"
										placeholderTextColor={colors.mutedForeground}
										autoCapitalize="none"
										autoCorrect={false}
										style={{
											borderWidth: 1,
											borderColor: colors.border,
											backgroundColor: colors.card,
											color: colors.foreground,
											borderRadius: 12,
											paddingHorizontal: 12,
											paddingVertical: 10,
											fontSize: 14,
										}}
										onSubmitEditing={suggestMoreForAlbum}
										returnKeyType="search"
									/>
								</View>

								{!suggestionsRequested ? (
									<View
										style={{
											alignItems: "center",
											paddingVertical: 36,
											gap: 8,
										}}
									>
										<Icon
											name="Search"
											size={34}
											className="text-muted-foreground"
										/>
										<Text
											style={{
												fontSize: 13,
												color: colors.mutedForeground,
												textAlign: "center",
											}}
										>
											Enter a keyword or tap Suggest more to find related
											audios.
										</Text>
									</View>
								) : isFetchingSuggestions ? (
									<View style={{ alignItems: "center", paddingVertical: 28 }}>
										<ActivityIndicator color={colors.primary} />
									</View>
								) : displayedSuggestedMedia.length === 0 &&
									suggestedMedia.length > 0 ? (
									<View style={{ alignItems: "center", paddingVertical: 36 }}>
										<Text
											style={{
												fontSize: 13,
												color: colors.mutedForeground,
												textAlign: "center",
											}}
										>
											No more result
										</Text>
									</View>
								) : displayedSuggestedMedia.length === 0 ? (
									<View
										style={{
											alignItems: "center",
											paddingVertical: 36,
											gap: 8,
										}}
									>
										<Icon
											name="SearchX"
											size={34}
											className="text-muted-foreground"
										/>
										<Text
											style={{
												fontSize: 13,
												color: colors.mutedForeground,
												textAlign: "center",
											}}
										>
											No matching audio suggestions yet.
										</Text>
										<Text
											style={{
												fontSize: 11,
												color: colors.mutedForeground,
												textAlign: "center",
											}}
										>
											Try another keyword or refresh the album-based
											suggestions.
										</Text>
									</View>
								) : (
									<>
										<FlatList
											data={displayedSuggestedMedia}
											keyExtractor={(item) => String(item.id)}
											scrollEnabled={false}
											removeClippedSubviews={false}
											renderItem={({ item }) => (
												<SwipeDeleteRow
													onDelete={() => dismissSuggestion(item.id)}
													disabled={
														isAddingSuggestions || addingSuggestionIds.has(item.id)
													}
												>
													<SuggestedMediaRow
														media={item}
														selected={selectedSuggestionIds.has(item.id)}
														onPress={() => toggleSuggestion(item.id)}
														onAdd={() => void addOneSuggestion(item)}
														isAdding={addingSuggestionIds.has(item.id)}
													/>
												</SwipeDeleteRow>
											)}
										/>
										{hasNoMoreSuggestions && (
											<Text
												style={{
													textAlign: "center",
													fontSize: 12,
													color: colors.mutedForeground,
													paddingTop: 16,
													paddingBottom: 6,
												}}
											>
												No more result
											</Text>
										)}
									</>
								)}
							</View>
						</View>
					</ScrollView>
				)}
			</SafeArea>

			{selectedSuggestionCount > 0 && (
				<View
					pointerEvents="box-none"
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						bottom: 24,
						alignItems: "center",
						zIndex: 80,
						elevation: 80,
					}}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 8,
						}}
					>
						<Pressable
							onPress={addSelectedSuggestions}
							disabled={isAddingSuggestions}
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "center",
								gap: 8,
								paddingHorizontal: 18,
								paddingVertical: 13,
								borderRadius: 14,
								backgroundColor: colors.primary,
								opacity: isAddingSuggestions ? 0.65 : 1,
								shadowColor: "#000",
								shadowOffset: { width: 0, height: 8 },
								shadowOpacity: 0.3,
								shadowRadius: 12,
								elevation: 12,
							}}
						>
							{isAddingSuggestions ? (
								<ActivityIndicator
									size="small"
									color={colors.primaryForeground}
								/>
							) : (
								<Icon
									name="Plus"
									size={16}
									className="text-primary-foreground"
								/>
							)}
							<Text
								style={{
									fontSize: 14,
									fontWeight: "800",
									color: colors.primaryForeground,
								}}
							>
								Add ({selectedSuggestionCount})
							</Text>
						</Pressable>
						<Pressable
							onPress={deleteSelectedSuggestions}
							disabled={isAddingSuggestions}
							style={{
								width: 48,
								height: 48,
								borderRadius: 14,
								alignItems: "center",
								justifyContent: "center",
								backgroundColor: colors.card,
								borderWidth: 1,
								borderColor: colors.border,
								opacity: isAddingSuggestions ? 0.55 : 1,
								shadowColor: "#000",
								shadowOffset: { width: 0, height: 8 },
								shadowOpacity: 0.2,
								shadowRadius: 12,
								elevation: 12,
							}}
						>
							<Icon name="Trash2" size={18} className="text-destructive" />
						</Pressable>
					</View>
				</View>
			)}

			{/* Edit album modal */}
			{album && (
				<EditAlbumModal
					visible={editModalVisible}
					album={{ name: album.name, description: album.description }}
					onClose={() => setEditModalVisible(false)}
					onSave={(name, description) => updateAlbum({ id, name, description })}
					isSaving={isUpdating}
				/>
			)}
			<TrackActionsSheet
				visible={Boolean(selectedTrackForActions)}
				media={selectedTrackForActions}
				albums={albums}
				currentAlbumId={id}
				isBusy={isRemovingMedia || isMovingMedia}
				onClose={() => setSelectedTrackForActions(null)}
				onRemove={() => {
					if (selectedTrackForActions?.id) {
						removeTrackFromAlbum(selectedTrackForActions.id);
					}
				}}
				onMove={moveTrackToAlbum}
			/>
		</View>
	);
}
