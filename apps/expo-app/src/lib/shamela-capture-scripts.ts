/** A literal script: Metro must not introduce runtime helpers into the WebView realm. */
export function buildShamelaCaptureScript(
	requestId: number,
	expectedUrl: string,
) {
	return `(function(requestId, expectedUrl) { ${SHAMELA_OBSERVER} })(${JSON.stringify(requestId)}, ${JSON.stringify(expectedUrl)}); true;`;
}

const SHAMELA_OBSERVER = String.raw`
  var bridgeWindow = window;
  if (bridgeWindow.__bookCapture?.id === requestId) return;
  bridgeWindow.__bookCapture?.stop();
  let sent = false;
  let previous = "";
  let stableSince = Date.now();
  let challengeReported = false;
  let timer;
  const normalize = (url) => {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname.replace(/\/$/, "");
  };
  const post = (data) => bridgeWindow.ReactNativeWebView?.postMessage(JSON.stringify(Object.assign({}, data, { requestId: requestId })));
  const stop = () => { clearInterval(timer); observer.disconnect(); };
  const probe = () => {
    if (sent) return;
    const nass = document.querySelector(".nass");
    const text = (nass?.textContent ?? "").trim();
    const pageId = nass?.getAttribute("data-page-id")?.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
    const matchesPage = normalize(location.href) === expectedUrl && (!pageId || Number(pageId) === Number(expectedUrl.split("/").pop()));
    const challenge = document.querySelector("#challenge-running, #challenge-stage, #cf-challenge-running, .cf-browser-verification, form#challenge-form") ||
      /just a moment|attention required|verify you are human|security verification/i.test(document.title) ||
      (!text && document.querySelector('iframe[src*="challenges.cloudflare.com"], .cf-turnstile, [name="cf-turnstile-response"]'));
    if (challenge) {
      previous = "";
      stableSince = Date.now();
      if (!challengeReported) { challengeReported = true; post({ type: "verification" }); }
      return;
    }
    if (!matchesPage || !text || document.readyState === "loading") { previous = ""; stableSince = Date.now(); return; }
    // Footnote and inline markup changes also reset stability, not only text length.
    const content = nass.innerHTML;
    if (content !== previous) { previous = content; stableSince = Date.now(); return; }
    if (Date.now() - stableSince < 700) return;
    sent = true;
    stop();
    const html = document.documentElement.outerHTML;
    if (html.length > 4_000_000) { post({ type: "capture-error", message: "This page is too large to capture." }); return; }
    post({ type: "capture", href: location.href, title: document.title, html });
  };
  const observer = new MutationObserver(probe);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  timer = setInterval(probe, 350);
  bridgeWindow.__bookCapture = { id: requestId, stop };
  probe();
`;
