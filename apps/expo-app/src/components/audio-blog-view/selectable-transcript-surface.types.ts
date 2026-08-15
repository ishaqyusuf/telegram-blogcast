import type {
	TranscriptSurfacePresentation,
	TranscriptSurfaceSelection,
} from "@/components/audio-blog-view/selectable-transcript-protocol";
import type {
	TranscriptDocument,
	TranscriptSegmentData,
	TranscriptTextSelection,
} from "@/components/audio-blog-view/transcript-timing";

export type SelectableTranscriptSurfaceProps = {
	document: TranscriptDocument;
	presentation: TranscriptSurfacePresentation;
	selectionEnabled: boolean;
	contentPaddingVertical: number;
	activeSegmentIndex: number;
	activeWordIndex: number;
	follow: boolean;
	selection: TranscriptTextSelection | null;
	onSelectionChange?: (selection: TranscriptSurfaceSelection | null) => void;
	onManualScroll: () => void;
	onStartReached?: () => void;
	onEndReached?: () => void;
	onPressSegment?: (
		segment: TranscriptSegmentData,
		index: number,
		shouldPlay: boolean,
	) => void;
	onLongPressSegment?: (segment: TranscriptSegmentData, index: number) => void;
};
