import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FetchPreview = {
    requestedUrl: string;
    finalUrl: string;
    ok: boolean;
    status: number;
    statusText: string;
    contentType: string | null;
    contentLength: string | null;
    html: string;
    snippet: string;
};

type DebugStreamEvent =
    | {
          type: "log";
          level: "SYS" | "CMD" | "INF" | "OK" | "ERR";
          message: string;
          time: string;
      }
    | { type: "preview"; preview: FetchPreview }
    | { type: "done"; ok: boolean };

function writeEvent(
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder,
    event: DebugStreamEvent,
) {
    controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

function now() {
    return new Date().toISOString();
}

function log(
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder,
    level: "SYS" | "CMD" | "INF" | "OK" | "ERR",
    message: string,
) {
    writeEvent(controller, encoder, {
        type: "log",
        level,
        message,
        time: now(),
    });
}

function toSnippet(html: string) {
    return html.replace(/\s+/g, " ").trim().slice(0, 1200);
}

function looksLikeCloudflareChallenge(html: string) {
    const lower = html.toLowerCase();
    return (
        lower.includes("just a moment") &&
        lower.includes("challenges.cloudflare.com")
    );
}

export async function POST(request: NextRequest) {
    const encoder = new TextEncoder();

    let targetUrl = "";

    try {
        const body = await request.json();
        targetUrl = typeof body?.url === "string" ? body.url.trim() : "";
    } catch {
        targetUrl = "";
    }

    if (!targetUrl) {
        return new Response("URL is required.\n", {
            status: 400,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    }

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            let browser: any = null;
            try {
                const puppeteer = await import("puppeteer");

                log(controller, encoder, "SYS", "book debugger initialized");
                log(controller, encoder, "CMD", `browser-fetch ${targetUrl}`);
                log(
                    controller,
                    encoder,
                    "INF",
                    "launching headless browser for cloudflare-aware fetch",
                );

                browser = await puppeteer.launch({
                    headless: true,
                    args: ["--no-sandbox", "--disable-setuid-sandbox"],
                });

                const page = await browser.newPage();
                await page.setUserAgent(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
                );
                await page.setExtraHTTPHeaders({
                    "accept-language": "en-US,en;q=0.9,ar;q=0.8",
                    pragma: "no-cache",
                    "cache-control": "no-cache",
                });

                page.on("response", (response: any) => {
                    const responseUrl = response.url();
                    if (
                        responseUrl === targetUrl ||
                        responseUrl.includes("shamela.ws/book/")
                    ) {
                        log(
                            controller,
                            encoder,
                            response.ok() ? "INF" : "ERR",
                            `network ${response.status()} ${responseUrl}`,
                        );
                    }
                });

                log(controller, encoder, "INF", "navigating...");
                const response = await page.goto(targetUrl, {
                    waitUntil: "domcontentloaded",
                    timeout: 45000,
                });

                log(
                    controller,
                    encoder,
                    response?.ok() ? "OK" : "INF",
                    `initial response status=${response?.status() ?? "unknown"}`,
                );

                let html = await page.content();
                if (looksLikeCloudflareChallenge(html)) {
                    log(
                        controller,
                        encoder,
                        "INF",
                        "cloudflare challenge detected, waiting for clearance...",
                    );

                    try {
                        await page.waitForFunction(
                            () => {
                                const text =
                                    document.documentElement.outerHTML.toLowerCase();
                                return (
                                    !text.includes("just a moment") &&
                                    !text.includes("challenges.cloudflare.com")
                                );
                            },
                            { timeout: 30000 },
                        );
                        log(
                            controller,
                            encoder,
                            "OK",
                            "challenge cleared in browser session",
                        );
                    } catch {
                        log(
                            controller,
                            encoder,
                            "ERR",
                            "challenge did not clear before timeout",
                        );
                    }
                }

                await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(
                    () => {
                        log(
                            controller,
                            encoder,
                            "INF",
                            "network did not go fully idle before timeout",
                        );
                    },
                );

                html = await page.content();
                const finalUrl = page.url();
                const title = await page.title().catch(() => "");

                log(controller, encoder, "INF", `final url=${finalUrl}`);
                log(
                    controller,
                    encoder,
                    "INF",
                    `page title=${title || "unknown"}`,
                );
                log(controller, encoder, "OK", `html fetched bytes=${html.length}`);

                const preview: FetchPreview = {
                    requestedUrl: targetUrl,
                    finalUrl,
                    ok: !looksLikeCloudflareChallenge(html),
                    status: response?.status() ?? 200,
                    statusText:
                        response?.statusText() ??
                        (looksLikeCloudflareChallenge(html)
                            ? "Cloudflare challenge page"
                            : "OK"),
                    contentType: response?.headers()["content-type"] ?? "text/html",
                    contentLength: null,
                    snippet: toSnippet(html),
                    html,
                };

                writeEvent(controller, encoder, {
                    type: "preview",
                    preview,
                });
                log(controller, encoder, "OK", "html dump ready");
                writeEvent(controller, encoder, { type: "done", ok: response.ok });
            } catch (error) {
                log(
                    controller,
                    encoder,
                    "ERR",
                    error instanceof Error ? error.message : "Unknown fetch error",
                );
                writeEvent(controller, encoder, { type: "done", ok: false });
            } finally {
                if (browser) {
                    await browser.close().catch(() => {});
                }
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
        },
    });
}
