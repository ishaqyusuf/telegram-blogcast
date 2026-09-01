import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import {
  BookFetchBrowserCapture,
  useBookFetchBrowserStore,
} from "@/store/book-fetch-browser-store";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

const DESKTOP_VIEWPORT_SCRIPT = `
  (function() {
    var viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=1280, initial-scale=0.35, maximum-scale=2, user-scalable=yes');
    document.documentElement.style.minWidth = '1180px';
    document.body && (document.body.style.minWidth = '1180px');
  })();
  true;
`;

const PROBE_SCRIPT = `
  (function() {
    var html = document.documentElement ? document.documentElement.outerHTML : "";
    var title = document.title || "";
    var href = window.location.href || "";
    var lower = (html + " " + title).toLowerCase();
    var isCloudflare = lower.includes("just a moment") || lower.includes("challenges.cloudflare.com") || lower.includes("cf-browser-verification");
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "page-state",
      href: href,
      title: title,
      isCloudflare: isCloudflare,
      htmlLength: html.length
    }));
  })();
  true;
`;

const CAPTURE_SCRIPT = `
  (function() {
    var html = document.documentElement ? document.documentElement.outerHTML : "";
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "capture",
      href: window.location.href || "",
      title: document.title || "",
      html: html
    }));
  })();
  true;
`;

const EXPAND_TOC_SCRIPT = `
  (function() {
    if (window.__alGhurobaaTocExpanding) return true;
    window.__alGhurobaaTocExpanding = true;

    var post = function(payload) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    };
    var hasDirectList = function(button) {
      var item = button && button.parentElement;
      if (!item) return false;
      return Array.prototype.some.call(item.children, function(child) {
        return child.tagName === "UL";
      });
    };
    var pendingButtons = function() {
      return Array.prototype.filter.call(
        document.querySelectorAll(".s-nav .exp_bu"),
        function(button) { return !hasDirectList(button); }
      );
    };
    var waitForList = function(button) {
      return new Promise(function(resolve, reject) {
        var started = Date.now();
        var timer = setInterval(function() {
          if (hasDirectList(button)) {
            clearInterval(timer);
            resolve();
          } else if (Date.now() - started > 12000) {
            clearInterval(timer);
            reject(new Error("Timed out while loading chapter branch " + (button.dataset.id || "unknown")));
          }
        }, 120);
      });
    };

    (async function() {
      var expanded = 0;
      while (expanded < 1200) {
        var pending = pendingButtons();
        if (!pending.length) {
          post({ type: "toc-complete", expanded: expanded, remaining: 0 });
          return;
        }
        var button = pending[0];
        button.click();
        await waitForList(button);
        expanded += 1;
        post({
          type: "toc-progress",
          expanded: expanded,
          remaining: pendingButtons().length
        });
      }
      throw new Error("Chapter expansion safety limit reached.");
    })().catch(function(error) {
      post({ type: "toc-error", message: error && error.message ? error.message : "Chapter expansion failed." });
    }).finally(function() {
      window.__alGhurobaaTocExpanding = false;
    });
  })();
  true;
`;

export default function BookFetchBrowserScreen() {
  const { url, bookId, autoPromote } = useLocalSearchParams<{
    url?: string;
    bookId?: string;
    autoPromote?: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { textAlign, writingDirection, isRtl } = useTranslation();
  const colors = useColors();
  const webViewRef = useRef<WebView>(null);
  const { setCaptured, setCancelled } = useBookFetchBrowserStore();
  const setGlobalAudioBarHidden = useGlobalAudioBarStore((s) => s.setHidden);

  const [currentUrl, setCurrentUrl] = useState(url ?? "");
  const [pageTitle, setPageTitle] = useState("");
  const [isCloudflare, setIsCloudflare] = useState(true);
  const [htmlLength, setHtmlLength] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [tocProgress, setTocProgress] = useState<{
    expanded: number;
    remaining: number;
  } | null>(null);
  const [tocError, setTocError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const parsedBookId =
    bookId && Number.isFinite(Number(bookId)) ? Number(bookId) : undefined;
  const shouldAutoPromote = autoPromote === "1" || autoPromote === "true";
  const canCheckCaptureState = currentUrl.includes("shamela.ws/book/");
  const { data: captureState, isLoading: isLoadingCaptureState } = useQuery(
    _trpc.book.getShamelaCaptureState.queryOptions(
      { shamelaUrl: currentUrl || url || "" },
      { enabled: canCheckCaptureState },
    ),
  );
  const requiresFullToc = captureState?.requiresFullToc ?? true;

  useEffect(() => {
    setGlobalAudioBarHidden(true);

    return () => {
      setGlobalAudioBarHidden(false);
    };
  }, [setGlobalAudioBarHidden]);

  const { mutate: promotePage, isPending: isPromoting } = useMutation(
    _trpc.book.promoteStagedShamelaPageParse.mutationOptions({
      onSuccess: (result) => {
        qc.invalidateQueries({ queryKey: _trpc.book.getBooks.queryKey() });
        qc.invalidateQueries({
          queryKey: _trpc.book.getBook.queryKey({ id: result.bookId }),
        });
        qc.invalidateQueries({
          queryKey: _trpc.book.getPage.queryKey({ pageId: result.page.id }),
        });
        router.replace(
          `/books/${result.bookId}/reader/${result.page.id}` as any,
        );
      },
      onError: (error) => {
        setIsCapturing(false);
        Alert.alert("Import failed", error.message);
      },
    }),
  );
  const { mutate: captureAndStagePage, isPending: isStaging } = useMutation(
    _trpc.book.captureAndStageShamelaPage.mutationOptions({
      onSuccess: (result) => {
        if (!result.stagedParseId) {
          setIsCapturing(false);
          router.back();
          return;
        }
        if (shouldAutoPromote) {
          promotePage({
            stagedParseId: result.stagedParseId,
            bookId: parsedBookId,
          });
          return;
        }
        setIsCapturing(false);
        router.replace(
          `/book-fetch-preview?stagedParseId=${result.stagedParseId}` as any,
        );
      },
      onError: (error) => {
        setIsCapturing(false);
        Alert.alert("Import failed", error.message);
      },
    }),
  );

  const canCapture = useMemo(() => {
    if (!hasLoadedOnce) return false;
    if (isCapturing || isStaging || isPromoting) return false;
    if (isLoadingCaptureState) return false;
    if (isCloudflare) return false;
    if (!currentUrl.includes("shamela.ws/book/")) return false;
    return htmlLength > 2000;
  }, [
    currentUrl,
    hasLoadedOnce,
    htmlLength,
    isCapturing,
    isCloudflare,
    isLoadingCaptureState,
    isPromoting,
    isStaging,
  ]);

  const close = () => {
    if (!useBookFetchBrowserStore.getState().capture) {
      setCancelled();
    }
    router.back();
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);

      if (payload.type === "page-state") {
        setCurrentUrl(payload.href || currentUrl);
        setPageTitle(payload.title || "");
        const nextIsCloudflare = Boolean(payload.isCloudflare);
        setIsCloudflare(nextIsCloudflare);
        if (!nextIsCloudflare) {
          webViewRef.current?.injectJavaScript(DESKTOP_VIEWPORT_SCRIPT);
        }
        setHtmlLength(
          typeof payload.htmlLength === "number" ? payload.htmlLength : 0,
        );
        return;
      }

      if (payload.type === "capture") {
        const capture: BookFetchBrowserCapture = {
          requestedUrl: url ?? "",
          finalUrl: payload.href || currentUrl,
          title: payload.title || "",
          html: typeof payload.html === "string" ? payload.html : "",
          capturedAt: Date.now(),
        };

        setCaptured(capture);
        captureAndStagePage({
          requestedUrl: capture.requestedUrl,
          finalUrl: capture.finalUrl,
          title: capture.title,
          html: capture.html,
          source: "mobile-webview",
          bookId: parsedBookId,
        });
        return;
      }

      if (payload.type === "toc-progress") {
        setTocProgress({
          expanded: Number(payload.expanded) || 0,
          remaining: Number(payload.remaining) || 0,
        });
        return;
      }

      if (payload.type === "toc-complete") {
        setTocProgress({
          expanded: Number(payload.expanded) || 0,
          remaining: 0,
        });
        webViewRef.current?.injectJavaScript(CAPTURE_SCRIPT);
        return;
      }

      if (payload.type === "toc-error") {
        const message =
          payload.message || "Could not load the full chapter tree.";
        setTocError(message);
        setIsCapturing(false);
        Alert.alert("Chapter import paused", message);
      }
    } catch {}
  };

  const handleCapture = () => {
    if (!canCapture) return;
    setIsCapturing(true);
    setTocError(null);
    setTocProgress(null);
    webViewRef.current?.injectJavaScript(
      requiresFullToc ? EXPAND_TOC_SCRIPT : CAPTURE_SCRIPT,
    );
  };

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
          <View
            className="items-center gap-3 border-b border-border px-4 py-3"
            style={{ flexDirection: isRtl ? "row-reverse" : "row" }}
          >
            <Pressable
              onPress={close}
              className="size-9 items-center justify-center rounded-full bg-card"
            >
              <Icon name="ChevronLeft" size={22} className="text-foreground" />
            </Pressable>
            <View className="flex-1 gap-1">
              <Text
                style={{
                  textAlign,
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.foreground,
                  writingDirection,
                }}
                numberOfLines={1}
              >
                {pageTitle || "Shamela Browser"}
              </Text>
              <Text
                style={{
                  textAlign,
                  fontSize: 12,
                  color: colors.mutedForeground,
                  writingDirection,
                }}
                numberOfLines={1}
              >
                {currentUrl || url}
              </Text>
            </View>
            <Pressable
              onPress={() => webViewRef.current?.reload()}
              className="size-9 items-center justify-center rounded-full bg-card"
            >
              <Icon name="RefreshCw" size={18} className="text-foreground" />
            </Pressable>
          </View>

          <View className="px-4 py-2">
            <View className="rounded-xl bg-card px-3 py-2.5">
              <Text
                style={{
                  textAlign,
                  fontSize: 13,
                  fontWeight: "600",
                  color: isCloudflare ? colors.primary : colors.foreground,
                  writingDirection,
                }}
              >
                {isCloudflare
                  ? "Complete the Cloudflare check, then continue."
                  : "Real Shamela page detected. You can continue now."}
              </Text>
              <Text
                style={{
                  textAlign,
                  marginTop: 4,
                  fontSize: 12,
                  color: colors.mutedForeground,
                  writingDirection,
                }}
              >
                {`Load ${Math.round(loadProgress * 100)}% · HTML ${htmlLength.toLocaleString()} chars`}
              </Text>
              {requiresFullToc ? (
                <Text
                  style={{
                    textAlign,
                    marginTop: 4,
                    fontSize: 12,
                    color: tocError ? colors.destructive : colors.primary,
                    writingDirection,
                  }}
                >
                  {tocError
                    ? `Chapter tree paused: ${tocError}`
                    : tocProgress
                      ? `Chapter tree: ${tocProgress.expanded} loaded · ${tocProgress.remaining} currently pending`
                      : "First import will load the complete chapter tree."}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="flex-1 overflow-hidden">
            <WebView
              ref={webViewRef}
              source={{ uri: url ?? "" }}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              setSupportMultipleWindows={false}
              onMessage={handleMessage}
              onLoadEnd={() => {
                setHasLoadedOnce(true);
                webViewRef.current?.injectJavaScript(PROBE_SCRIPT);
              }}
              onLoadProgress={({ nativeEvent }) => {
                setLoadProgress(nativeEvent.progress);
              }}
              onNavigationStateChange={(state) => {
                setCurrentUrl(state.url);
              }}
              startInLoadingState
              renderLoading={() => (
                <View
                  className="flex-1 items-center justify-center bg-background"
                  style={{ backgroundColor: colors.background }}
                >
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              )}
            />
          </View>

          <View className="border-t border-border px-4 py-3">
            <Pressable
              onPress={handleCapture}
              disabled={!canCapture}
              className={
                canCapture
                  ? "flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3"
                  : "flex-row items-center justify-center gap-2 rounded-xl bg-secondary py-3"
              }
            >
              {isCapturing || isStaging || isPromoting ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color={colors.primaryForeground}
                  />
                  <Text className="text-[15px] font-bold text-primary-foreground">
                    {isPromoting
                      ? "Importing page..."
                      : isStaging
                        ? "Saving staged parse..."
                        : "Capturing page..."}
                  </Text>
                </>
              ) : (
                <>
                  <Icon
                    name="Download"
                    size={18}
                    className={
                      canCapture
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }
                  />
                  <Text
                    className={
                      canCapture
                        ? "text-[15px] font-bold text-primary-foreground"
                        : "text-[15px] font-bold text-muted-foreground"
                    }
                  >
                    {isCloudflare
                      ? "Pass Cloudflare to continue"
                      : "Fetch this page"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </SafeArea>
    </View>
  );
}
