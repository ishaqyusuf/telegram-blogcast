export type FacebookSavedItem = {
	title?: string;
	link?: string;
	url?: string;
	sourcePostUrl?: string;
	sourceTitle?: string;
	collection?: string;
	avatar?: string;
	caption?: string;
	blogId?: number;
};

export type FacebookSavedSnapshot = {
	rows: FacebookSavedItem[];
	scrollY?: number;
	viewportHeight?: number;
	height: number;
	title?: string;
	url?: string;
};

export type FacebookSavedStopReason =
	| "known_boundary"
	| "natural_end"
	| "safety_cap"
	| "no_known_overlap"
	| "authentication_required"
	| "unexpected_page"
	| "extraction_failed";

export type FacebookSavedCollector = {
	knownIdentities: Set<string>;
	observedIdentities: Set<string>;
	newRows: Map<string, FacebookSavedItem>;
	logs: FacebookSavedCollectorProgress[];
	passes: number;
	knownCount: number;
	newCount: number;
	consecutiveKnownCount: number;
	noGrowthPasses: number;
	lastHeight: number;
	boundaryThreshold: number;
	stopAfterNoGrowthPasses: number;
	maxPasses: number;
};

export type FacebookSavedCollectorProgress = {
	done: boolean;
	complete: boolean;
	stopReason: FacebookSavedStopReason | null;
	pass: number;
	visibleCount: number;
	scannedCount: number;
	knownCount: number;
	newCount: number;
	consecutiveKnownCount: number;
	noGrowthPasses: number;
	atEnd: boolean;
	height: number;
};

export type FacebookSavedCapture = {
	exportedAt: string;
	source: {
		type: "facebook-saved";
		url: string;
		title: string | null;
	};
	items: FacebookSavedItem[];
	capture: {
		complete: boolean;
		stopReason: FacebookSavedStopReason;
		scannedCount: number;
		knownCount: number;
		newCount: number;
		consecutiveKnownCount: number;
		noGrowthPasses: number;
		atEnd: boolean;
		passes: number;
		boundaryThreshold: 20;
	};
	validation: { errors: string[] };
};

export function normalizeFacebookSavedText(value: unknown): string;
export function canonicalizeFacebookSavedUrl(value: unknown): string;
export function getFacebookSavedIdentity(value: unknown): string;
export function normalizeFacebookSavedItem(
	item: FacebookSavedItem,
): FacebookSavedItem;
export function mergeFacebookSavedItems(
	current: FacebookSavedItem,
	incoming: FacebookSavedItem,
): FacebookSavedItem;
export function createFacebookSavedCollector(
	knownIdentities?: Iterable<string>,
	options?: {
		boundaryThreshold?: number;
		stopAfterNoGrowthPasses?: number;
		maxPasses?: number;
	},
): FacebookSavedCollector;
export function processFacebookSavedSnapshot(
	collector: FacebookSavedCollector,
	snapshot: FacebookSavedSnapshot,
	options?: {
		boundaryThreshold?: number;
		stopAfterNoGrowthPasses?: number;
		maxPasses?: number;
	},
): FacebookSavedCollectorProgress;
export function getFacebookSavedNewItems(
	collector: FacebookSavedCollector,
): FacebookSavedItem[];
export function buildFacebookSavedCapture(
	collector: FacebookSavedCollector,
	snapshot: FacebookSavedSnapshot,
	progress?: FacebookSavedCollectorProgress,
): FacebookSavedCapture;
export function mergeFacebookSavedExports<
	T extends { items?: FacebookSavedItem[] },
>(
	payload: T,
	capturedItems: FacebookSavedItem[],
): {
	newItems: FacebookSavedItem[];
	existingCount: number;
	payload: T & {
		exportedAt: string;
		count: number;
		items: FacebookSavedItem[];
	};
};
export function facebookSavedPageSnapshot(): FacebookSavedSnapshot;
export function createFacebookSavedSnapshotScript(delayMs?: number): string;
