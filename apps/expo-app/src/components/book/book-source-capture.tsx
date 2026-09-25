import { Pressable } from "@/components/ui/pressable";
import { useAuthContext } from "@/hooks/use-auth";
import { readCachedReaderPage } from "@/lib/book-cache-reader";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { pageTargetKey } from "@/lib/book-page-loader";
import {
	isBookServiceUnavailable,
	isSourceRateLimit,
	nextUncapturedSourcePage,
} from "@/lib/book-source-capture";
import { useTranslation } from "@/lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState, Text, View } from "react-native";
import { useBookPageLoader } from "./book-page-loader-provider";

type SourcePage = { id: number; shamelaPageNo: number; status: string };

export function BookSourceCapture({
	bookId,
	firstPageNo,
	lastPageNo,
	pages,
}: {
	bookId: number;
	firstPageNo: number | null;
	lastPageNo: number | null;
	pages: SourcePage[];
}) {
	const { isRtl } = useTranslation();
	const { profile } = useAuthContext();
	const scope = bookCacheScopeForUser(profile?.user?.id);
	const loader = useBookPageLoader();
	const snapshot = useSyncExternalStore(
		loader.subscribe,
		loader.getSnapshot,
		loader.getSnapshot,
	);
	const first = firstPageNo ?? 1;
	const last = lastPageNo ?? 0;
	const validRange = first > 0 && last >= first && last - first < 50_000;
	const checkpointKey = `book-source-capture:${scope}:${bookId}`;
	const retryKey = `${checkpointKey}:retry-at`;
	const fetchedPages = pages.filter((page) => page.status === "fetched");
	const fetchedPagesRef = useRef(fetchedPages);
	fetchedPagesRef.current = fetchedPages;
	const captured = useRef(new Set<number>());
	const [cursor, setCursor] = useState(first);
	const [loaded, setLoaded] = useState(false);
	const [running, setRunning] = useState(false);
	const [current, setCurrent] = useState<{
		key: string;
		pageNo: number;
	} | null>(null);
	const [failedPage, setFailedPage] = useState<number | null>(null);
	const [retryAt, setRetryAt] = useState<number | null>(null);
	const currentRef = useRef(current);
	currentRef.current = current;
	const [cooling, setCooling] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		let alive = true;
		setLoaded(false);
		setRunning(false);
		setFailedPage(null);
		captured.current.clear();
		void Promise.all([
			AsyncStorage.getItem(checkpointKey),
			AsyncStorage.getItem(retryKey),
			Promise.all(
				fetchedPagesRef.current.map(async (page) => ({
					pageNo: page.shamelaPageNo,
					local: Boolean(
						await readCachedReaderPage(scope, bookId, page.id).catch(
							() => null,
						),
					),
				})),
			),
		])
			.then(([saved, savedRetry, localPages]) => {
				if (!alive) return;
				for (const page of localPages)
					if (page.local) captured.current.add(page.pageNo);
				const value = Number(saved);
				const checkpoint =
					Number.isSafeInteger(value) && value >= first && value <= last + 1
						? value
						: first;
				// A checkpoint is only a hint: pages captured on the server may still be
				// missing locally after an interrupted download or an app reinstall.
				const firstMissingBeforeCheckpoint = nextUncapturedSourcePage(
					first,
					checkpoint - 1,
					new Set<number>(),
					captured.current,
				);
				setCursor(Math.min(firstMissingBeforeCheckpoint, checkpoint));
				const nextRetry = Number(savedRetry);
				setRetryAt(
					Number.isSafeInteger(nextRetry) && nextRetry > 0 ? nextRetry : null,
				);
				if (nextRetry > 0)
					setMessage(
						isRtl
							? "تم بلوغ حد المصدر. سيستأنف الالتقاط تلقائياً بعد فترة انتظار."
							: "Source rate limit reached. Capture will resume after a cooldown.",
					);
				setLoaded(true);
			})
			.catch(() => {
				if (alive) {
					setCursor(first);
					setRetryAt(null);
					setLoaded(true);
				}
			});
		return () => {
			alive = false;
		};
	}, [bookId, checkpointKey, first, isRtl, last, retryKey, scope]);
	useEffect(() => {
		if (loaded && validRange)
			void AsyncStorage.setItem(checkpointKey, String(cursor));
	}, [checkpointKey, cursor, loaded, validRange]);
	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
			if (currentRef.current) loader.cancel(currentRef.current.key, true);
		},
		[loader],
	);
	useEffect(() => {
		if (!loaded || retryAt === null || running || !validRange) return;
		const timeout = setTimeout(
			() => {
				void NetInfo.fetch()
					.then((network) => {
						if (
							AppState.currentState !== "active" ||
							network.isConnected === false ||
							network.isInternetReachable === false
						) {
							const nextRetry = Date.now() + 60_000;
							setRetryAt(nextRetry);
							void AsyncStorage.setItem(retryKey, String(nextRetry));
							return;
						}
						setRetryAt(null);
						void AsyncStorage.removeItem(retryKey);
						setMessage(null);
						setRunning(true);
					})
					.catch(() => setRetryAt(Date.now() + 60_000));
			},
			Math.max(0, retryAt - Date.now()),
		);
		return () => clearTimeout(timeout);
	}, [loaded, retryAt, retryKey, running, validRange]);
	useEffect(() => {
		if (!running) return;
		const app = AppState.addEventListener("change", (state) => {
			if (state !== "active") {
				if (currentRef.current) loader.cancel(currentRef.current.key, true);
				setCurrent(null);
				setRunning(false);
				setMessage(
					isRtl
						? "توقف الالتقاط عند مغادرة التطبيق."
						: "Capture paused while the app is away.",
				);
			}
		});
		const network = NetInfo.addEventListener((state) => {
			if (state.isConnected === false || state.isInternetReachable === false) {
				if (currentRef.current) loader.cancel(currentRef.current.key, true);
				setCurrent(null);
				setRunning(false);
				setMessage(
					isRtl
						? "توقف الالتقاط لانقطاع الاتصال."
						: "Capture paused until the connection returns.",
				);
			}
		});
		return () => {
			app.remove();
			network();
		};
	}, [isRtl, loader, running]);
	useEffect(() => {
		if (!loaded || !running || current || cooling || !validRange) return;
		const next = nextUncapturedSourcePage(
			cursor,
			last,
			new Set<number>(),
			captured.current,
		);
		if (next > last) {
			setCursor(last + 1);
			setRunning(false);
			setMessage(
				isRtl
					? "اكتمل التقاط الصفحات المعروفة. الصفحات محفوظة للقراءة دون اتصال."
					: "Known source pages captured and saved for offline reading.",
			);
			return;
		}
		if (next !== cursor) {
			setCursor(next);
			return;
		}
		// Keep the reader's adjacent-page prefetch ahead of bulk capture.
		if (
			Object.values(snapshot.jobs).some(
				(job) =>
					job.priority === "prefetch" &&
					["queued", "resolving", "loading", "saving"].includes(job.status),
			)
		)
			return;
		const target = { bookId, sourcePageNo: next };
		const key = pageTargetKey(target);
		const existing = snapshot.jobs[key];
		if (existing?.status === "error") loader.retry(key);
		else loader.request(target, "prefetch");
		if (loader.getSnapshot().jobs[key]) setCurrent({ key, pageNo: next });
	}, [
		bookId,
		cooling,
		current,
		cursor,
		isRtl,
		last,
		loaded,
		loader,
		running,
		snapshot,
		validRange,
	]);
	useEffect(() => {
		if (!current || !running) return;
		const job = snapshot.jobs[current.key];
		if (!job) return;
		if (job.status === "ready") {
			captured.current.add(current.pageNo);
			setFailedPage(null);
			setCursor(current.pageNo + 1);
			setCurrent(null);
			setCooling(true);
			timer.current = setTimeout(() => {
				timer.current = null;
				setCooling(false);
			}, 1_800);
		} else if (["error", "paused", "verification"].includes(job.status)) {
			setRunning(false);
			setCurrent(null);
			setFailedPage(current.pageNo);
			const error = job.error ?? "Source verification is needed.";
			if (isSourceRateLimit(error)) {
				const nextRetry = Date.now() + 5 * 60_000;
				setRetryAt(nextRetry);
				void AsyncStorage.setItem(retryKey, String(nextRetry));
				setMessage(
					isRtl
						? "تم بلوغ حد المصدر. سيستأنف الالتقاط تلقائياً بعد فترة انتظار."
						: "Source rate limit reached. Capture will resume after a cooldown.",
				);
			} else
				setMessage(
					isBookServiceUnavailable(error)
						? isRtl
							? "خادم الكتب غير متاح حالياً. توقف الالتقاط، ويمكنك المحاولة لاحقاً."
							: "The book service is unavailable. Capture paused; try again later."
						: error,
				);
		}
	}, [current, isRtl, retryKey, running, snapshot]);
	const pause = () => {
		if (current) loader.cancel(current.key, true);
		setCurrent(null);
		setRunning(false);
		setMessage(
			isRtl
				? "توقف الالتقاط. التقدم محفوظ."
				: "Capture paused. Progress is saved.",
		);
	};
	const start = () => {
		if (!validRange || (retryAt != null && retryAt > Date.now())) return;
		setRetryAt(null);
		void AsyncStorage.removeItem(retryKey);
		if (cursor > last) setCursor(first);
		setMessage(null);
		if (failedPage != null) {
			const target = { bookId, sourcePageNo: failedPage };
			const key = pageTargetKey(target);
			loader.request(target, "reader");
			loader.showSource(key);
			setCurrent({ key, pageNo: failedPage });
			setFailedPage(null);
		}
		setRunning(true);
	};
	if (!validRange)
		return (
			<Text style={{ fontSize: 12, opacity: 0.7 }}>
				{isRtl
					? "افتح صفحة من المصدر لتحديد آخر صفحة قبل التقاط الكتاب بالكامل."
					: "Open a source page to discover the last page before capturing the entire book."}
			</Text>
		);
	const done = [...captured.current].filter(
		(pageNo) => pageNo >= first && pageNo <= last,
	).length;
	const total = last - first + 1;
	const rateLimitCoolingDown = retryAt != null && retryAt > Date.now();
	return (
		<View style={{ gap: 7 }}>
			<Pressable
				onPress={running ? pause : start}
				disabled={rateLimitCoolingDown}
				accessibilityRole="button"
				style={{
					alignItems: "center",
					borderRadius: 12,
					backgroundColor: rateLimitCoolingDown ? "#668078" : "#214C3C",
					padding: 12,
				}}
			>
				<Text style={{ color: "white", fontWeight: "700" }}>
					{rateLimitCoolingDown
						? isRtl
							? "انتظار انتهاء حد المصدر"
							: "Waiting for source cooldown"
						: running
							? isRtl
								? "إيقاف التقاط الصفحات"
								: "Pause source capture"
							: failedPage != null
								? isRtl
									? "فتح المصدر وإعادة المحاولة"
									: "Open source and retry"
								: isRtl
									? "التقاط الصفحات الناقصة"
									: "Capture missing source pages"}
				</Text>
			</Pressable>
			<Text
				accessibilityLiveRegion="polite"
				style={{ fontSize: 12, opacity: 0.7 }}
			>
				{isRtl
					? `${Math.min(done, total)} من ${total} صفحة محفوظة على الجهاز`
					: `${Math.min(done, total)} of ${total} pages saved on this device`}
				{running ? ` · #${current?.pageNo ?? cursor}` : ""}
			</Text>
			{message ? (
				<Text
					accessibilityRole="alert"
					style={{
						fontSize: 12,
						color: isSourceRateLimit(message) ? "#B45309" : undefined,
					}}
				>
					{failedPage != null ? `#${failedPage} · ` : ""}
					{message}
				</Text>
			) : null}
		</View>
	);
}
