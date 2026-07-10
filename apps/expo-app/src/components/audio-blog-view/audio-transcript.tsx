import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery } from "@/lib/react-query";
import { Modal, PanResponder, Text, View } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useAudioStore } from "@/store/audio-store";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useColors } from "@/hooks/use-color";
import { TranscriptSegments } from "@/components/audio-blog-view/transcript-segments";
import {
	formatTranscriptionCost,
	getTranscriptionModelOption,
	TRANSCRIPTION_MODELS,
	type TranscriptionModel,
} from "@/lib/transcription-models";
import {
	getDefaultTranscriberUrl,
	isHttpTranscriberUrl,
} from "@/lib/transcribe";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSec(sec: number) {
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseMmSs(str: string): number {
	const [mm, ss] = str.split(":").map(Number);
	return (mm || 0) * 60 + (ss || 0);
}

const TRANSCRIPT_CHUNK_SEC = 30;
const TRANSCRIPT_PREFETCH_AT_SEC = 20;
const TRANSCRIPT_CHUNK_CACHE_ENABLED = false;

type TranscriptChunkSegment = {
	id?: string | number;
	from?: number;
	to?: number;
	startSec?: number;
	endSec?: number;
	text: string;
	words?: Array<{ word: string; startSec: number; endSec: number }>;
};

type TranscriptChunk = {
	chunkStartSec: number;
	chunkEndSec: number;
	status: "done";
	cached: boolean;
	segments: TranscriptChunkSegment[];
};

function getTranscriptChunkStart(sec: number) {
	return (
		Math.floor(Math.max(0, sec) / TRANSCRIPT_CHUNK_SEC) * TRANSCRIPT_CHUNK_SEC
	);
}

function normalizeSegment(segment: TranscriptChunkSegment) {
	const startSec = segment.startSec ?? segment.from ?? 0;
	const endSec = segment.endSec ?? segment.to ?? startSec;
	return {
		...segment,
		startSec,
		endSec,
	};
}

// ── Model picker sheet ────────────────────────────────────────────────────────

function ModelSheet({
	visible,
	selected,
	whisperAvailable,
	onSelect,
	onClose,
}: {
	visible: boolean;
	selected: TranscriptionModel;
	whisperAvailable: boolean;
	onSelect: (model: TranscriptionModel) => void;
	onClose: () => void;
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
							backgroundColor: colors.muted,
							borderRadius: 2,
							alignSelf: "center",
							marginBottom: 12,
						}}
					/>
					<Text
						style={{
							fontSize: 15,
							fontWeight: "700",
							color: colors.foreground,
							marginBottom: 8,
						}}
					>
						Switch Transcription Model
					</Text>
					{TRANSCRIPTION_MODELS.filter((p) => p.id === "whisper-local").map(
						(p) => {
							const isSelected = p.id === selected;
							const disabled = p.requiresLocalTranscriber && !whisperAvailable;
							return (
								<Pressable
									key={p.id}
									disabled={disabled}
									onPress={() => {
										onSelect(p.id);
										onClose();
									}}
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "space-between",
										paddingVertical: 14,
										paddingHorizontal: 12,
										borderRadius: 12,
										opacity: disabled ? 0.45 : 1,
										backgroundColor: isSelected
											? colors.primary + "22"
											: "transparent",
									}}
								>
									<View style={{ gap: 2 }}>
										<Text
											style={{
												fontSize: 14,
												fontWeight: "600",
												color: colors.foreground,
											}}
										>
											{p.label}
										</Text>
										<Text
											style={{ fontSize: 12, color: colors.mutedForeground }}
										>
											{disabled
												? "Local Whisper is not reachable"
												: p.description}
										</Text>
									</View>
									{isSelected && (
										<Icon
											name="CheckCircle2"
											size={20}
											className="text-primary"
										/>
									)}
								</Pressable>
							);
						},
					)}
					<View style={{ height: 12 }} />
				</Pressable>
			</Pressable>
		</Modal>
	);
}

// ── Dual seek bar ─────────────────────────────────────────────────────────────

function DualSeekBar({
	fromSec,
	toSec,
	maxSec,
	onFromChange,
	onToChange,
}: {
	fromSec: number;
	toSec: number;
	maxSec: number;
	onFromChange: (sec: number) => void;
	onToChange: (sec: number) => void;
}) {
	const colors = useColors();
	const [trackWidth, setTrackWidth] = useState(0);
	const THUMB = 20;

	// Refs to avoid stale closures in PanResponder
	const trackWidthRef = useRef(0);
	const fromSecRef = useRef(fromSec);
	const toSecRef = useRef(toSec);
	const maxSecRef = useRef(maxSec);
	const onFromRef = useRef(onFromChange);
	const onToRef = useRef(onToChange);
	const activeThumb = useRef<"from" | "to" | null>(null);

	useEffect(() => {
		fromSecRef.current = fromSec;
	}, [fromSec]);
	useEffect(() => {
		toSecRef.current = toSec;
	}, [toSec]);
	useEffect(() => {
		maxSecRef.current = maxSec;
	}, [maxSec]);
	useEffect(() => {
		onFromRef.current = onFromChange;
	}, [onFromChange]);
	useEffect(() => {
		onToRef.current = onToChange;
	}, [onToChange]);

	const panResponder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			onPanResponderGrant: (evt) => {
				const x = evt.nativeEvent.locationX;
				const w = trackWidthRef.current;
				const max = maxSecRef.current;
				if (!w || !max) return;
				const fromX = (fromSecRef.current / max) * w;
				const toX = (toSecRef.current / max) * w;
				activeThumb.current =
					Math.abs(x - fromX) <= Math.abs(x - toX) ? "from" : "to";
				const sec = Math.round((x / w) * max);
				if (activeThumb.current === "from") {
					const newFrom = Math.max(0, Math.min(sec, toSecRef.current - 1));
					fromSecRef.current = newFrom;
					onFromRef.current(newFrom);
				} else {
					const newTo = Math.max(fromSecRef.current + 1, Math.min(sec, max));
					toSecRef.current = newTo;
					onToRef.current(newTo);
				}
			},
			onPanResponderMove: (evt) => {
				const x = evt.nativeEvent.locationX;
				const w = trackWidthRef.current;
				const max = maxSecRef.current;
				if (!w || !max || !activeThumb.current) return;
				const sec = Math.round((x / w) * max);
				if (activeThumb.current === "from") {
					const newFrom = Math.max(0, Math.min(sec, toSecRef.current - 1));
					fromSecRef.current = newFrom;
					onFromRef.current(newFrom);
				} else {
					const newTo = Math.max(fromSecRef.current + 1, Math.min(sec, max));
					toSecRef.current = newTo;
					onToRef.current(newTo);
				}
			},
			onPanResponderRelease: () => {
				activeThumb.current = null;
			},
		}),
	).current;

	const fromX =
		maxSec > 0 && trackWidth > 0 ? (fromSec / maxSec) * trackWidth : 0;
	const toX =
		maxSec > 0 && trackWidth > 0 ? (toSec / maxSec) * trackWidth : trackWidth;

	return (
		<View style={{ gap: 6 }}>
			<View
				style={{ height: 44, justifyContent: "center" }}
				onLayout={(e) => {
					trackWidthRef.current = e.nativeEvent.layout.width;
					setTrackWidth(e.nativeEvent.layout.width);
				}}
				{...panResponder.panHandlers}
			>
				{/* Track background */}
				<View
					style={{ height: 4, backgroundColor: colors.muted, borderRadius: 2 }}
				/>
				{/* Active range highlight */}
				<View
					style={{
						position: "absolute",
						left: fromX,
						width: Math.max(0, toX - fromX),
						height: 4,
						backgroundColor: colors.primary,
						borderRadius: 2,
					}}
				/>
				{trackWidth > 0 && (
					<>
						{/* From thumb */}
						<View
							style={{
								position: "absolute",
								left: Math.max(0, fromX - THUMB / 2),
								width: THUMB,
								height: THUMB,
								borderRadius: THUMB / 2,
								backgroundColor: colors.background,
								borderWidth: 2.5,
								borderColor: colors.primary,
							}}
						/>
						{/* To thumb */}
						<View
							style={{
								position: "absolute",
								left: Math.min(trackWidth - THUMB, toX - THUMB / 2),
								width: THUMB,
								height: THUMB,
								borderRadius: THUMB / 2,
								backgroundColor: colors.primary,
							}}
						/>
					</>
				)}
			</View>
			{/* Time labels */}
			<View style={{ flexDirection: "row", justifyContent: "space-between" }}>
				<Text
					style={{ fontSize: 11, fontWeight: "600", color: colors.primary }}
				>
					{formatSec(fromSec)}
				</Text>
				<Text
					style={{ fontSize: 11, fontWeight: "600", color: colors.primary }}
				>
					{formatSec(toSec)}
				</Text>
			</View>
		</View>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

interface AudioTranscriptProps {
	mediaId: number;
	telegramFileId?: string;
}

export function AudioTranscript({
	mediaId,
	telegramFileId,
}: AudioTranscriptProps) {
	const colors = useColors();
	const durationMs = useAudioStore((s) => s.duration);
	const positionMs = useAudioStore((s) => s.position);
	const transcriptionModel = useAppSettingsStore((s) => s.transcriptionModel);
	const setTranscriptionModel = useAppSettingsStore(
		(s) => s.setTranscriptionModel,
	);
	const localTranscriberBaseUrl = useAppSettingsStore(
		(s) => s.localTranscriberBaseUrl,
	);
	const localServicesIp = useAppSettingsStore((s) => s.localServicesIp);
	const localApiLastIp = useAppSettingsStore((s) => s.localApiLastIp);

	const durationSec = Math.floor(durationMs / 1000);
	const positionSec = positionMs / 1000;
	const activeChunkStart = getTranscriptChunkStart(positionSec);
	const transcriberUrl = getDefaultTranscriberUrl(
		localTranscriberBaseUrl,
		localServicesIp ?? localApiLastIp,
	);
	const canCheckTranscriber = isHttpTranscriberUrl(transcriberUrl);

	const [modelSheetVisible, setModelSheetVisible] = useState(false);
	const [chunks, setChunks] = useState<Record<number, TranscriptChunk>>({});
	const [pendingChunks, setPendingChunks] = useState<number[]>([]);
	const [error, setError] = useState<string | null>(null);
	const chunkCacheRef = useRef(chunks);
	const pendingChunksRef = useRef(pendingChunks);
	const failedChunksRef = useRef<Set<number>>(new Set());
	const rangeSec = TRANSCRIPT_CHUNK_SEC;
	const modelConfig = getTranscriptionModelOption("whisper-local");

	const { data: transcript, refetch } = useQuery(
		_trpc.blog.getTranscript.queryOptions({ mediaId }),
	);
	const { data: localTranscriberHealth } = useQuery({
		..._trpc.blog.checkLocalTranscriber.queryOptions({
			baseUrl: canCheckTranscriber ? (transcriberUrl ?? undefined) : undefined,
		}),
		enabled: canCheckTranscriber,
		retry: false,
	});
	const whisperAvailable = Boolean(localTranscriberHealth?.ok);

	useEffect(() => {
		chunkCacheRef.current = chunks;
	}, [chunks]);

	useEffect(() => {
		pendingChunksRef.current = pendingChunks;
	}, [pendingChunks]);

	const { mutate: getTranscriptChunk } = useMutation(
		_trpc.blog.getTranscriptChunk.mutationOptions({
			onSuccess(data) {
				failedChunksRef.current.delete(data.chunkStartSec);
				setChunks((prev) => {
					const next = {
						...prev,
						[data.chunkStartSec]: data as TranscriptChunk,
					};
					chunkCacheRef.current = next;
					return next;
				});
				setError(null);
				refetch();
			},
			onError(err, variables) {
				const chunkStart = variables?.chunkStartSec ?? activeChunkStart;
				failedChunksRef.current.add(chunkStart);
				setError(
					`${formatSec(chunkStart)} chunk failed: ${
						err.message || "Transcription failed"
					}`,
				);
			},
			onSettled(_data, _err, variables) {
				const chunkStart = variables?.chunkStartSec;
				if (typeof chunkStart !== "number") return;
				pendingChunksRef.current = pendingChunksRef.current.filter(
					(value) => value !== chunkStart,
				);
				setPendingChunks(pendingChunksRef.current);
			},
		}),
	);
	const getTranscriptChunkRef = useRef(getTranscriptChunk);

	useEffect(() => {
		getTranscriptChunkRef.current = getTranscriptChunk;
	}, [getTranscriptChunk]);

	useEffect(() => {
		if (transcriptionModel !== "whisper-local") {
			setTranscriptionModel("whisper-local");
		}
	}, [setTranscriptionModel, transcriptionModel]);

	const requestChunk = useCallback(
		(chunkStartSec: number, options?: { force?: boolean }) => {
			if (!telegramFileId) return;
			if (
				TRANSCRIPT_CHUNK_CACHE_ENABLED &&
				chunkCacheRef.current[chunkStartSec]
			) {
				return;
			}
			if (pendingChunksRef.current.includes(chunkStartSec)) return;
			if (!options?.force && failedChunksRef.current.has(chunkStartSec)) return;
			if (!whisperAvailable) return;
			failedChunksRef.current.delete(chunkStartSec);

			pendingChunksRef.current = [...pendingChunksRef.current, chunkStartSec];
			setPendingChunks(pendingChunksRef.current);
			getTranscriptChunkRef.current({
				mediaId,
				fileId: telegramFileId,
				chunkStartSec,
				chunkDurationSec: TRANSCRIPT_CHUNK_SEC,
				model: "whisper-local",
				force: options?.force || !TRANSCRIPT_CHUNK_CACHE_ENABLED,
				localTranscriberBaseUrl: canCheckTranscriber
					? (transcriberUrl ?? undefined)
					: undefined,
			});
		},
		[
			canCheckTranscriber,
			mediaId,
			telegramFileId,
			transcriberUrl,
			whisperAvailable,
		],
	);

	useEffect(() => {
		requestChunk(0);
	}, [requestChunk]);

	useEffect(() => {
		requestChunk(activeChunkStart);
		if (positionSec - activeChunkStart >= TRANSCRIPT_PREFETCH_AT_SEC) {
			requestChunk(activeChunkStart + TRANSCRIPT_CHUNK_SEC);
		}
	}, [activeChunkStart, positionSec, requestChunk]);

	const segments = useMemo(() => {
		const chunkSegments = Object.values(chunks)
			.sort((a, b) => a.chunkStartSec - b.chunkStartSec)
			.flatMap((chunk) => chunk.segments)
			.map(normalizeSegment)
			.sort((a, b) => a.startSec - b.startSec);

		if (chunkSegments.length > 0) return chunkSegments;
		return (transcript?.segments ?? []).map((segment) =>
			normalizeSegment(segment as unknown as TranscriptChunkSegment),
		);
	}, [chunks, transcript?.segments]);

	const activeChunkPending = pendingChunks.includes(activeChunkStart);
	const currentChunk = chunks[activeChunkStart];
	const localWhisperBlocked = !whisperAvailable;

	return (
		<View style={{ flex: 1, gap: 12, paddingTop: 10 }}>
			<View
				style={{
					marginHorizontal: 16,
					borderRadius: 16,
					borderWidth: 1,
					borderColor: colors.border,
					backgroundColor: colors.card,
					padding: 14,
					gap: 12,
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 12,
					}}
				>
					<View style={{ flex: 1, gap: 3 }}>
						<Text
							style={{
								fontSize: 11,
								fontWeight: "800",
								color: colors.primary,
								letterSpacing: 0,
								textTransform: "uppercase",
							}}
						>
							Live transcript
						</Text>
						<Text style={{ fontSize: 12, color: colors.mutedForeground }}>
							{formatSec(positionSec)} · {formatSec(activeChunkStart)}-
							{formatSec(activeChunkStart + TRANSCRIPT_CHUNK_SEC)}
						</Text>
					</View>

					<Pressable
						onPress={() => setModelSheetVisible(true)}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 6,
							borderRadius: 999,
							backgroundColor: colors.muted,
							paddingHorizontal: 10,
							paddingVertical: 7,
						}}
					>
						<Icon name="Sparkles" size={14} className="text-primary" />
						<Text
							style={{
								fontSize: 12,
								fontWeight: "700",
								color: colors.foreground,
							}}
							numberOfLines={1}
						>
							{modelConfig.label}
						</Text>
					</Pressable>
				</View>

				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 10,
					}}
				>
					<Text
						style={{ flex: 1, fontSize: 12, color: colors.mutedForeground }}
					>
						{localWhisperBlocked
							? "Local Whisper is not reachable"
							: activeChunkPending
								? "Transcribing current chunk..."
								: currentChunk?.cached
									? "Current chunk loaded from DB"
									: `Chunk cost ${formatTranscriptionCost(
											rangeSec,
											modelConfig.costPerMin,
										)}`}
					</Text>
					<Pressable
						disabled={
							activeChunkPending || localWhisperBlocked || !telegramFileId
						}
						onPress={() => requestChunk(activeChunkStart, { force: true })}
						style={{
							borderRadius: 999,
							backgroundColor: colors.primary,
							opacity:
								activeChunkPending || localWhisperBlocked || !telegramFileId
									? 0.45
									: 1,
							paddingHorizontal: 13,
							paddingVertical: 8,
						}}
					>
						<Text
							style={{
								color: colors.primaryForeground,
								fontSize: 12,
								fontWeight: "800",
							}}
						>
							{activeChunkPending ? "Loading" : "Load chunk"}
						</Text>
					</Pressable>
				</View>

				{pendingChunks.length > 0 && (
					<Text style={{ fontSize: 11, color: colors.mutedForeground }}>
						Pending:{" "}
						{[...pendingChunks]
							.sort((a, b) => a - b)
							.map(formatSec)
							.join(", ")}
					</Text>
				)}
				{error && (
					<Text style={{ fontSize: 12, color: "#ef4444" }}>{error}</Text>
				)}
			</View>

			{segments.length === 0 &&
			(transcript?.status === "processing" ||
				transcript?.status === "pending") ? (
				<View
					style={{
						alignItems: "center",
						justifyContent: "center",
						gap: 10,
						paddingVertical: 36,
					}}
				>
					<Icon name="Loader" size={26} className="text-primary" />
					<Text style={{ fontSize: 14, color: colors.mutedForeground }}>
						Transcribing...
					</Text>
				</View>
			) : (
				<TranscriptSegments segments={segments} />
			)}

			<ModelSheet
				visible={modelSheetVisible}
				selected={transcriptionModel}
				whisperAvailable={whisperAvailable}
				onSelect={setTranscriptionModel}
				onClose={() => setModelSheetVisible(false)}
			/>
		</View>
	);
}
