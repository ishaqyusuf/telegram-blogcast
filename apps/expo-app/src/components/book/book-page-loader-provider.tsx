import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
	type ReactNode,
} from "react";
import { AppState, BackHandler, StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTRPC } from "@/trpc/client";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";
import {
	canonicalPageUrl,
	createBookPageLoader,
	type BookPageLoader,
} from "@/lib/book-page-loader";
import { buildShamelaCaptureScript } from "@/lib/shamela-capture-scripts";
import { Pressable } from "@/components/ui/pressable";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";
import { readCachedReaderPage, resolveCachedPageTarget, saveCachedReaderPage } from "@/lib/book-cache-reader";
import { getBookCacheScope } from "@/lib/book-cache-session";
import { notifyBookCacheChanged } from "@/lib/book-cache-events";
import type { ReaderPage } from "@/lib/book-cache-page";

const LoaderContext = createContext<BookPageLoader | null>(null);
export function useBookPageLoader() {
	const loader = useContext(LoaderContext);
	if (!loader) throw new Error("BookPageLoaderProvider is missing.");
	return loader;
}

export function BookPageLoaderProvider({ children }: { children: ReactNode }) {
	const trpc = useTRPC();
	const qc = useQueryClient();
	const colors = useColors();
	const insets = useSafeAreaInsets();
	const { isRtl } = useTranslation();
	const webview = useRef<WebView>(null);
	const [renderer, setRenderer] = useState(0);
	const freshlyImported = useRef(new Set<number>());
	const [loader] = useState(() =>
		createBookPageLoader({
			async resolve(target, signal) {
				const scope = getBookCacheScope();
				const local = await resolveCachedPageTarget(scope, target).catch((error) => {
					console.warn("[Book cache] local resolution failed", error);
					return null;
				});
				if (signal.aborted || scope !== getBookCacheScope()) throw new Error("Page request cancelled.");
				if (local) {
					qc.setQueryData([...trpc.book.getPage.queryKey({ pageId: local.id }), scope], local);
					return { result: { bookId: local.bookId, pageId: local.id } };
				}
				const connection = await NetInfo.fetch();
				if (connection.isConnected === false || connection.isInternetReachable === false)
					throw new Error("This page is not downloaded. Connect to the internet and retry.");
				const url = target.url ? canonicalPageUrl(target.url) : undefined;
				let bookId = target.bookId;
				if (url && !bookId) {
					const state = await vanillaTrpc.book.getShamelaCaptureState.query(
						{ shamelaUrl: url },
						{ signal },
					);
					bookId ??= state.bookId ?? undefined;
				}
				if (!bookId) return { url };
				const sourcePageNo =
					target.sourcePageNo ?? Number(url?.split("/").at(-1));
				// resolvePage validates book ownership of the source; use its URL as canonical.
				const resolved = await vanillaTrpc.bookChapter.resolvePage.query(
					{ bookId, sourcePageNo },
					{ signal },
				);
				if (
					url &&
					resolved.sourceUrl &&
					canonicalPageUrl(resolved.sourceUrl) !== url
				)
					throw new Error("Use a page link from this book.");
				if (resolved.pageId && url) {
					const page = await vanillaTrpc.book.getPage.query(
						{ pageId: resolved.pageId },
						{ signal },
					);
					if (page.shamelaUrl && canonicalPageUrl(page.shamelaUrl) !== url)
						throw new Error("Use a page link from this book.");
					qc.setQueryData(
						[...trpc.book.getPage.queryKey({ pageId: resolved.pageId }), scope],
						page,
					);
				}
				return resolved.pageId
					? { result: { bookId, pageId: resolved.pageId } }
					: { url: resolved.sourceUrl ?? url };
			},
			async stage(load, capture, signal) {
				const result = await vanillaTrpc.book.captureAndStageShamelaPage.mutate(
					{
						requestedUrl: load.url!,
						finalUrl: capture.href,
						title: capture.title,
						html: capture.html,
						source: "mobile-webview",
						bookId: load.target.bookId,
					},
					{ signal },
				);
				if (!result.stagedParseId)
					throw new Error("Could not save the page capture. Please retry.");
				return result.stagedParseId;
			},
			async promote(load, stagedParseId, signal) {
				const result =
					await vanillaTrpc.book.promoteStagedShamelaPageParse.mutate(
						{ stagedParseId, bookId: load.target.bookId },
						{ signal },
					);
				void qc.invalidateQueries({ queryKey: trpc.book.getBooks.queryKey() });
				void qc.invalidateQueries({
					queryKey: trpc.book.getBook.queryKey({ id: result.bookId }),
				});
				void qc.invalidateQueries({
					queryKey: trpc.bookChapter.tree.queryKey({ bookId: result.bookId }),
				});
				void qc.invalidateQueries({
					queryKey: trpc.bookChapter.bookState.queryKey({
						bookId: result.bookId,
					}),
				});
				void qc.invalidateQueries({
					queryKey: trpc.book.getReaderWindow.queryKey(),
				});
				void qc.invalidateQueries({
					queryKey: trpc.book.getPage.queryKey({ pageId: result.page.id }),
				});
				freshlyImported.current.add(result.page.id);
				notifyBookCacheChanged({ kind: "page", bookId: result.bookId, pageId: result.page.id });
				return { bookId: result.bookId, pageId: result.page.id };
			},
			async prepare(result, signal) {
				const observedAt = Date.now();
				const scope = getBookCacheScope();
				const key = [...trpc.book.getPage.queryKey({ pageId: result.pageId }), scope];
				if (!freshlyImported.current.has(result.pageId)) {
					const local = await readCachedReaderPage(scope, result.bookId, result.pageId).catch(() => null);
					if (local) { qc.setQueryData(key, local); return; }
				}
				let cached = qc.getQueryData<ReaderPage>(key);
				if (
					freshlyImported.current.has(result.pageId) || !cached ||
					cached.status !== "fetched" ||
					!cached.paragraphs.length
				) {
					const page = await vanillaTrpc.book.getPage.query(
						{ pageId: result.pageId },
						{ signal },
					);
					qc.setQueryData(key, page);
					cached = page;
				}
				if (cached && !signal.aborted && scope === getBookCacheScope()) {
					await saveCachedReaderPage(scope, cached, observedAt).catch((error) => console.warn("[Book cache] saved page is online but local caching failed", error));
					freshlyImported.current.delete(result.pageId);
				}
			},
		}),
	);
	const snapshot = useSyncExternalStore(
		loader.subscribe,
		loader.getSnapshot,
		loader.getSnapshot,
	);
	const active = snapshot.active;
	const visible =
		active?.priority === "reader" &&
		(active.status === "verification" ||
			(active.showSource && active.status === "loading"));
	useEffect(() => {
		if (!visible) return;
		useGlobalAudioBarStore.getState().setHidden(true);
		return () => useGlobalAudioBarStore.getState().setHidden(false);
	}, [visible]);
	// Keep this source mounted through CAPTCHA reveal. No reparenting or modal remount.
	const sourceUrl = active?.url;
	const lastUrl = useRef<string | null>(null);
	if (sourceUrl) lastUrl.current = sourceUrl;
	const sourceUri = lastUrl.current;
	const source = useMemo(
		() => (sourceUri ? { uri: sourceUri } : undefined),
		[sourceUri],
	);
	const isLoading =
		active?.status === "loading" || active?.status === "verification";
	const probe = () => {
		const current = loader.getSnapshot().active;
		if (current?.url && ["loading", "verification"].includes(current.status))
			webview.current?.injectJavaScript(
				buildShamelaCaptureScript(current.id, current.url),
			);
	};
	useEffect(() => {
		let appActive = AppState.currentState === "active";
		let online = true;
		const sync = () => loader.setForeground(appActive);
		sync();
		const subscription = AppState.addEventListener("change", (state) => {
			appActive = state === "active";
			sync();
		});
		const unsubscribe = NetInfo.addEventListener((state) => {
			online =
				state.isConnected !== false && state.isInternetReachable !== false;
			const current = loader.getSnapshot().active;
			if (!online && current && ["loading", "verification"].includes(current.status))
				loader.fail(current.id, "Connection lost. Your saved pages are available offline; reconnect and retry this page.");
			sync();
		});
		return () => {
			subscription.remove();
			unsubscribe();
			loader.setForeground(false);
		};
	}, [loader]);
	useEffect(() => {
		if (!visible || !active) return;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			loader.fail(
				active.id,
				"Verification cancelled. Retry when you are ready.",
			);
			return true;
		});
		return () => sub.remove();
	}, [visible, active, loader]);
	useEffect(() => {
		if (!isLoading) {
			webview.current?.injectJavaScript("window.__bookCapture?.stop(); true;");
			webview.current?.stopLoading();
		} else {
			// Reload on retry of the same URL; source identity alone would not navigate.
			webview.current?.reload();
		}
	}, [active?.id, isLoading]);
	const loadError = (message: string, transient = true) => {
		const current = loader.getSnapshot().active;
		if (current && ["loading", "verification"].includes(current.status))
			loader.fail(current.id, message, transient);
	};
	return (
		<LoaderContext.Provider value={loader}>
			<View style={{ flex: 1 }}>
				<View
					style={{ flex: 1 }}
					accessibilityElementsHidden={!!visible}
					importantForAccessibility={visible ? "no-hide-descendants" : "auto"}
					pointerEvents={visible ? "none" : "auto"}
				>
					{children}
				</View>
				{lastUrl.current ? (
					<View
						pointerEvents={visible ? "auto" : "none"}
						accessibilityElementsHidden={!visible}
						accessibilityViewIsModal={!!visible}
						importantForAccessibility={visible ? "yes" : "no-hide-descendants"}
						style={[
							StyleSheet.absoluteFillObject,
							{
								opacity: visible ? 1 : 0,
								zIndex: visible ? 100 : -1,
								backgroundColor: colors.background,
								paddingTop: insets.top,
								paddingBottom: insets.bottom,
							},
						]}
					>
						<View
							style={{
								padding: 16,
								gap: 8,
								backgroundColor: colors.background,
							}}
						>
							<Text
								accessibilityRole="header"
								style={{
									fontSize: 17,
									fontWeight: "700",
									color: colors.foreground,
								}}
							>
								{isRtl ? "التحقق من الموقع" : "Source verification"}
							</Text>
							<Text style={{ color: colors.mutedForeground }}>
								{isRtl
									? "أكمل التحقق، وستفتح الصفحة تلقائياً."
									: "Complete the check below. Your page will open automatically."}
							</Text>
							<Pressable
								onPress={() =>
									active &&
									loader.fail(
										active.id,
										"Verification cancelled. Retry when you are ready.",
									)
								}
								accessibilityRole="button"
							>
								<Text style={{ color: colors.primary, paddingVertical: 8 }}>
									{isRtl ? "إلغاء" : "Cancel"}
								</Text>
							</Pressable>
						</View>
						<WebView
							ref={webview}
							key={renderer}
							source={source}
							style={{ flex: 1 }}
							injectedJavaScript={
								active?.url
									? buildShamelaCaptureScript(active.id, active.url)
									: undefined
							}
							javaScriptEnabled
							domStorageEnabled
							sharedCookiesEnabled
							thirdPartyCookiesEnabled
							setSupportMultipleWindows={false}
							javaScriptCanOpenWindowsAutomatically={false}
							mediaPlaybackRequiresUserAction
							allowsInlineMediaPlayback={false}
							// All navigations reach the policy below instead of launching an external app.
							originWhitelist={["*"]}
							onShouldStartLoadWithRequest={(request) => {
								try {
									const url = new URL(request.url);
									const allowed =
										url.protocol === "https:" &&
										["shamela.ws", "challenges.cloudflare.com"].includes(
											url.hostname,
										) &&
										!url.username &&
										!url.password;
									if (!allowed && request.isTopFrame !== false)
										loadError(
											"The source tried to open an unsupported link.",
											false,
										);
									return allowed;
								} catch {
									return false;
								}
							}}
							onLoad={probe}
							onLoadEnd={probe}
							onMessage={({ nativeEvent }) => {
								if (nativeEvent.data.length > 4_100_000) {
									loadError("This page is too large to capture.", false);
									return;
								}
								try {
									const payload = JSON.parse(nativeEvent.data);
									if (typeof payload.requestId !== "number") return;
									if (payload.type === "verification")
										loader.verification(payload.requestId);
									if (
										payload.type === "capture" &&
										typeof payload.html === "string" &&
										typeof payload.href === "string"
									) {
										loader.capture(payload.requestId, {
											href: payload.href,
											html: payload.html,
											title:
												typeof payload.title === "string" ? payload.title : "",
										});
									}
									if (payload.type === "capture-error")
										loader.fail(
											payload.requestId,
											"This page could not be captured.",
										);
								} catch {
									/* Ignore non-protocol messages from source scripts. */
								}
							}}
							onError={({ nativeEvent }) => {
								const current = loader.getSnapshot().active;
								if (
									nativeEvent.code === -999 ||
									(nativeEvent.url && nativeEvent.url !== current?.url)
								)
									return;
								loadError(
									"The source could not load. Check your connection and retry.",
								);
							}}
							onHttpError={({ nativeEvent }) => {
								// Challenge responses commonly use 403/503; let the content probe reveal them.
								if (
									![403, 503].includes(nativeEvent.statusCode) &&
									nativeEvent.url === lastUrl.current
								)
									loadError(
										`The source returned an error (${nativeEvent.statusCode}).`,
									);
							}}
							onRenderProcessGone={() => {
								setRenderer((value) => value + 1);
								loadError("The browser restarted. Please retry.");
							}}
							onContentProcessDidTerminate={() => {
								setRenderer((value) => value + 1);
								loadError("The browser restarted. Please retry.");
							}}
						/>
					</View>
				) : null}
			</View>
		</LoaderContext.Provider>
	);
}
