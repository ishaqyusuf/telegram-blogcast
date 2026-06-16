import { Pressable } from "@/components/ui/pressable";
import { formatDate } from "@acme/utils/dayjs";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Modal,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
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
const SUGGESTION_LIMIT = 20;

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
							textAlign: "right",
						}}
					>
						تعديل الألبوم
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
							اسم الألبوم
						</Text>
						<TextInput
							value={name}
							onChangeText={setName}
							placeholder="أدخل الاسم..."
							placeholderTextColor={colors.input}
							style={{
								backgroundColor: colors.muted,
								borderRadius: 10,
								paddingHorizontal: 14,
								paddingVertical: 10,
								fontSize: 15,
								color: colors.foreground,
								textAlign: "right",
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
							الوصف
						</Text>
						<TextInput
							value={description}
							onChangeText={setDescription}
							placeholder="أضف وصفاً للألبوم..."
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
								textAlign: "right",
								writingDirection: "rtl",
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
								إلغاء
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
								{isSaving ? "جاري الحفظ..." : "حفظ"}
							</Text>
						</Pressable>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

// ── Track row — normal view ───────────────────────────────────────────────────

function TrackRow({
	media,
	displayIndex,
	onPress,
}: {
	media: any;
	displayIndex: number;
	onPress: () => void;
}) {
	const colors = useColors();
	const duration = media.file?.duration ?? media.duration;
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
				{duration != null && (
					<Text
						style={{
							fontSize: 12,
							color: colors.mutedForeground,
							textAlign: "right",
						}}
					>
						{minuteToString(duration)}
					</Text>
				)}
			</View>
			<Pressable onPress={() => {}} hitSlop={8} style={{ padding: 6 }}>
				<Icon
					name="MoreHorizontal"
					size={18}
					className="text-muted-foreground"
				/>
			</Pressable>
		</Pressable>
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
				{duration != null && (
					<Text
						style={{
							fontSize: 12,
							color: colors.mutedForeground,
							textAlign: "right",
						}}
					>
						{minuteToString(duration)}
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
}: {
	media: any;
	selected: boolean;
	onPress: () => void;
}) {
	const colors = useColors();
	const duration = media.file?.duration;
	const title =
		media.title || media.file?.fileName || media.blog?.content || "Untitled";
	const tags = media.matchingTags ?? [];

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
					{media.blog?.blogDate && (
						<Text style={{ fontSize: 11, color: colors.mutedForeground }}>
							{formatDate(media.blog.blogDate, "MMM D, YYYY")}
						</Text>
					)}
					{tags.slice(0, 3).map((tag: { id: number; title: string }) => (
						<Text key={tag.id} style={{ fontSize: 11, color: colors.primary }}>
							#{tag.title}
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
		</Pressable>
	);
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AlbumDetailScreen() {
	const router = useRouter();
	const qc = useQueryClient();
	const colors = useColors();
	const { albumId } = useLocalSearchParams<{ albumId: string }>();
	const id = Number(albumId);

	const { data: album, isLoading } = useQuery(
		_trpc.album.getAlbum.queryOptions({ id }),
	);
	const { data: booksData } = useQuery(
		_trpc.book.getBooks.queryOptions({ limit: 20 }),
	);

	// Local track order state (mirrors server, mutated on reorder actions)
	const [localTracks, setLocalTracks] = useState<any[] | null>(null);
	const [reorderMode, setReorderMode] = useState(false);
	const [editModalVisible, setEditModalVisible] = useState(false);
	const [descExpanded, setDescExpanded] = useState(false);
	const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<
		Set<number>
	>(new Set());

	const tracks: any[] = localTracks ?? album?.medias ?? [];
	const bgColor = albumColor(id);
	const selectedSuggestionCount = selectedSuggestionIds.size;
	const libraryBooks = Array.isArray((booksData as any)?.data)
		? ((booksData as any).data as any[])
		: [];
	const attachedBookReferences = Array.isArray((album as any)?.bookReferences)
		? ((album as any).bookReferences as any[])
		: [];
	const attachedBookIds = new Set(
		attachedBookReferences.map((reference) => reference.bookId),
	);
	const attachableBooks = libraryBooks.filter((book) => !attachedBookIds.has(book.id));

	const { data: suggestedMedia = [], isFetching: isFetchingSuggestions } =
		useQuery({
			..._trpc.album.getSuggestedMedia.queryOptions({
				albumId: id,
				limit: SUGGESTION_LIMIT,
			}),
			enabled: Number.isFinite(id) && id > 0,
		});

	const { mutate: saveOrder, isPending: isSavingOrder } = useMutation(
		_trpc.album.reorderTracks.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: _trpc.album.getAlbum.queryKey({ id }),
				});
				setLocalTracks(null);
				setReorderMode(false);
			},
			onError: (e) => Alert.alert("خطأ", e.message),
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
			onError: (e) => Alert.alert("خطأ", e.message),
		}),
	);

	const { mutate: addSuggestedMedia, isPending: isAddingSuggestions } =
		useMutation(
			_trpc.album.addMediaToAlbum.mutationOptions({
				onSuccess: (result) => {
					qc.invalidateQueries({
						queryKey: _trpc.album.getAlbum.queryKey({ id }),
					});
					qc.invalidateQueries({ queryKey: _trpc.album.getAlbums.queryKey() });
					qc.invalidateQueries({
						queryKey: _trpc.album.getSuggestedMedia.queryKey({
							albumId: id,
							limit: SUGGESTION_LIMIT,
						}),
					});
					setSelectedSuggestionIds(new Set());
					Alert.alert(
						"Added to album",
						`${result.added} audio item${result.added === 1 ? "" : "s"} added.`,
					);
				},
				onError: (e) => Alert.alert("خطأ", e.message),
			}),
		);

	const { mutate: attachBook, isPending: isAttachingBook } = useMutation(
		_trpc.album.attachBook.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: _trpc.album.getAlbum.queryKey({ id }),
				});
			},
			onError: (e) => Alert.alert("خطأ", e.message),
		}),
	);

	const { mutate: detachBook, isPending: isDetachingBook } = useMutation(
		_trpc.album.detachBook.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: _trpc.album.getAlbum.queryKey({ id }),
				});
			},
			onError: (e) => Alert.alert("خطأ", e.message),
		}),
	);

	// When entering reorder mode, snapshot current server tracks into local state
	function enterReorderMode() {
		setLocalTracks([...(album?.medias ?? [])]);
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
				const arr = [...(prev ?? album?.medias ?? [])];
				const [item] = arr.splice(fromIdx, 1);
				arr.splice(toIdx, 0, item);
				return arr;
			});
		},
		[album?.medias],
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
			new Set(suggestedMedia.map((media: any) => media.id)),
		);
	}

	function clearSuggestionSelection() {
		setSelectedSuggestionIds(new Set());
	}

	function addSelectedSuggestions() {
		const mediaIds = Array.from(selectedSuggestionIds);
		if (mediaIds.length === 0) return;
		addSuggestedMedia({ albumId: id, mediaIds });
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
					<View
						style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
					>
						<Text style={{ color: colors.mutedForeground }}>
							جاري التحميل...
						</Text>
					</View>
				) : !album ? (
					<View
						style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
					>
						<Text style={{ color: colors.mutedForeground }}>
							الألبوم غير موجود
						</Text>
					</View>
				) : (
					<ScrollView showsVerticalScrollIndicator={false}>
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
											{descExpanded ? "أقل" : "المزيد"}
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
										أضف وصفاً للألبوم...
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
										{album.medias?.length ?? 0} مقطع
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
										تشغيل الكل
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
								<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
									<Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
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
													onPress={() => router.push(`/books/${reference.bookId}` as any)}
													style={{
														flex: 1,
														flexDirection: "row-reverse",
														alignItems: "center",
														gap: 8,
													}}
												>
													<Icon name="BookOpen" size={16} className="text-primary" />
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
														{reference.book?.nameAr ?? reference.book?.nameEn ?? "Book"}
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
													<Icon name="Trash2" size={14} className="text-muted-foreground" />
												</Pressable>
											</View>
										))}
									</View>
								)}

								{attachableBooks.length > 0 && (
									<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
										{attachableBooks.slice(0, 8).map((book) => (
											<Pressable
												key={book.id}
												disabled={isAttachingBook}
												onPress={() => attachBook({ albumId: id, bookId: book.id })}
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
									المقاطع
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
											ترتيب
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
												إلغاء
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
												{isSavingOrder ? "..." : "حفظ الترتيب"}
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
										لا توجد مقاطع بعد
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
											Suggested from this channel
										</Text>
										<Text
											style={{
												fontSize: 11,
												color: colors.mutedForeground,
												marginTop: 2,
											}}
										>
											Matching tags from existing tracks
										</Text>
									</View>

									{suggestedMedia.length > 0 && (
										<Pressable
											onPress={
												selectedSuggestionCount === suggestedMedia.length
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
												style={{ fontSize: 12, color: colors.mutedForeground }}
											>
												{selectedSuggestionCount === suggestedMedia.length
													? "Clear"
													: "Select all"}
											</Text>
										</Pressable>
									)}
								</View>

								{isFetchingSuggestions ? (
									<View style={{ alignItems: "center", paddingVertical: 28 }}>
										<ActivityIndicator color={colors.primary} />
									</View>
								) : suggestedMedia.length === 0 ? (
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
											Add tagged audio from one channel to unlock suggestions.
										</Text>
									</View>
								) : (
									<>
										<FlatList
											data={suggestedMedia}
											keyExtractor={(item) => String(item.id)}
											scrollEnabled={false}
											renderItem={({ item }) => (
												<SuggestedMediaRow
													media={item}
													selected={selectedSuggestionIds.has(item.id)}
													onPress={() => toggleSuggestion(item.id)}
												/>
											)}
										/>

										<View
											style={{ flexDirection: "row", gap: 10, paddingTop: 14 }}
										>
											<Pressable
												onPress={addSelectedSuggestions}
												disabled={
													selectedSuggestionCount === 0 || isAddingSuggestions
												}
												style={{
													flex: 1,
													flexDirection: "row",
													alignItems: "center",
													justifyContent: "center",
													gap: 8,
													paddingVertical: 12,
													borderRadius: 12,
													backgroundColor: colors.primary,
													opacity:
														selectedSuggestionCount === 0 || isAddingSuggestions
															? 0.55
															: 1,
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
														fontSize: 13,
														fontWeight: "700",
														color: colors.primaryForeground,
													}}
												>
													Add selected{" "}
													{selectedSuggestionCount > 0
														? `(${selectedSuggestionCount})`
														: ""}
												</Text>
											</Pressable>
											{selectedSuggestionCount > 0 && (
												<Pressable
													onPress={clearSuggestionSelection}
													disabled={isAddingSuggestions}
													style={{
														paddingHorizontal: 14,
														borderRadius: 12,
														backgroundColor: colors.muted,
														alignItems: "center",
														justifyContent: "center",
														opacity: isAddingSuggestions ? 0.5 : 1,
													}}
												>
													<Text
														style={{
															fontSize: 13,
															fontWeight: "600",
															color: colors.foreground,
														}}
													>
														Cancel
													</Text>
												</Pressable>
											)}
										</View>
									</>
								)}
							</View>
						</View>
					</ScrollView>
				)}
			</SafeArea>

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
		</View>
	);
}
