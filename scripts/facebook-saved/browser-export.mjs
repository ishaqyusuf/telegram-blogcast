import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  buildExportPayload,
  canonicalizeUrl,
  getDatedExportPath,
  inferTitle,
  normalizeText,
} from "./export-utils.mjs";

export function createFacebookSavedCollector() {
  return {
    rows: new Map(),
    logs: [],
    noNewPasses: 0,
    lastHeight: 0,
  };
}

function mergeRows(collector, rows) {
  let added = 0;

  for (const row of rows) {
    const link = canonicalizeUrl(row.link);
    const url = canonicalizeUrl(row.url || row.sourcePostUrl || row.link);
    const key = url || link;
    if (!key || collector.rows.has(key)) continue;

    const caption = normalizeText(row.caption);
    const sourceTitle = normalizeText(row.sourceTitle);

    collector.rows.set(key, {
      title: inferTitle(caption, sourceTitle),
      link,
      url: url || link,
      collection: normalizeText(row.collection),
      avatar: normalizeText(row.avatar),
      caption,
    });
    added += 1;
  }

  return added;
}

export async function collectVisibleSavedItems(tab) {
  return await tab.playwright.evaluate(
    () => {
      const normalize = (value) =>
        String(value || "")
          .replace(/\s+/g, " ")
          .trim();
      const rectOf = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const isVisible = (el) => {
        const r = rectOf(el);
        const style = window.getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      };
      const isFacebookHost = (url) => /(^|\.)facebook\.com$/i.test(url.hostname);
      const getUrl = (href) => {
        try {
          return new URL(href, location.href);
        } catch {
          return null;
        }
      };
      const isSavedItemHref = (href) => {
        const url = getUrl(href);
        if (!url || !isFacebookHost(url)) return false;
        if (url.pathname === "/watch/" && url.searchParams.get("v")) return true;
        if (/^\/reel\/[^/]+\/?/.test(url.pathname)) return true;
        if (url.pathname.includes("/posts/")) return true;
        if (url.searchParams.get("story_fbid") || url.searchParams.get("post_id")) {
          return true;
        }
        return false;
      };
      const isPrimaryOpenHref = (href) => {
        const url = getUrl(href);
        return !!(
          url &&
          isFacebookHost(url) &&
          url.pathname === "/watch/" &&
          url.searchParams.get("v")
        );
      };
      const isPostHref = (href) => {
        const url = getUrl(href);
        return !!(
          url &&
          isFacebookHost(url) &&
          (/^\/reel\/[^/]+\/?/.test(url.pathname) ||
            url.pathname.includes("/posts/") ||
            url.searchParams.get("story_fbid") ||
            url.searchParams.get("post_id"))
        );
      };
      const backgroundUrl = (el) => {
        const style = window.getComputedStyle(el);
        const match = String(style.backgroundImage || "").match(
          /url\(["']?([^"')]+)["']?\)/,
        );
        return match ? match[1] : "";
      };
      const findCard = (anchor) => {
        let fallback = null;
        for (let el = anchor; el && el !== document.body; el = el.parentElement) {
          const r = rectOf(el);
          const text = normalize(el.innerText || el.textContent);
          if (r.width >= 360 && r.height >= 80) fallback = el;
          if (r.width >= 360 && r.height >= 80 && /Saved\s+(to|from)/i.test(text)) {
            return el;
          }
        }
        return fallback || anchor.parentElement;
      };
      const cardKey = (el) => {
        const r = rectOf(el);
        return `${Math.round(r.x)}:${Math.round(r.y)}:${Math.round(r.width)}:${Math.round(r.height)}`;
      };
      const cards = new Map();

      for (const anchor of Array.from(document.querySelectorAll("a[href]"))) {
        if (!isVisible(anchor) || !isSavedItemHref(anchor.href)) continue;
        const r = rectOf(anchor);
        if (r.y < -250 || r.y > window.innerHeight + 700) continue;

        const card = findCard(anchor);
        if (card && isVisible(card)) cards.set(cardKey(card), card);
      }

      const rows = [];
      for (const card of cards.values()) {
        const anchors = Array.from(card.querySelectorAll("a[href]")).filter(
          isVisible,
        );
        const itemAnchors = anchors.filter((a) => isSavedItemHref(a.href));
        const primary =
          itemAnchors.find((a) => isPrimaryOpenHref(a.href)) || itemAnchors[0];
        if (!primary) continue;

        const sourcePost =
          itemAnchors.find(
            (a) =>
              isPostHref(a.href) &&
              normalize(a.innerText || a.textContent).toLowerCase().includes("post"),
          ) || itemAnchors.find((a) => isPostHref(a.href));
        const collectionAnchor = anchors.find((a) => {
          const url = getUrl(a.href);
          const text = normalize(a.innerText || a.textContent);
          return (
            url &&
            url.pathname === "/saved/" &&
            url.searchParams.get("list_id") &&
            text &&
            !text.includes("Only me")
          );
        });
        const caption =
          itemAnchors
            .map((a) => normalize(a.innerText || a.textContent))
            .filter(
              (text) =>
                text &&
                !/^\d{1,2}:\d{2}$/.test(text) &&
                !/\bpost$/i.test(text),
            )
            .sort((a, b) => b.length - a.length)[0] ||
          normalize(
            normalize(card.innerText || card.textContent)
              .split(/\bReels\s*•\s*Saved to\b/i)[0]
              .replace(/^\d{1,2}:\d{2}\s*/, ""),
          );

        let avatar = "";
        const smallImage = Array.from(card.querySelectorAll("img"))
          .filter(isVisible)
          .map((img) => ({
            src: img.currentSrc || img.src || "",
            rect: rectOf(img),
          }))
          .find(
            (img) =>
              img.src &&
              img.rect.width >= 20 &&
              img.rect.height >= 20 &&
              img.rect.width <= 80 &&
              img.rect.height <= 80,
          );
        avatar = smallImage?.src || "";
        if (!avatar) {
          const background = Array.from(card.querySelectorAll("div, span, i"))
            .map((el) => ({ url: backgroundUrl(el), rect: rectOf(el) }))
            .find(
              (candidate) =>
                candidate.url &&
                candidate.rect.width >= 20 &&
                candidate.rect.height >= 20 &&
                candidate.rect.width <= 80 &&
                candidate.rect.height <= 80,
            );
          avatar = background?.url || "";
        }

        rows.push({
          link: primary.href,
          url: sourcePost?.href || primary.href,
          sourcePostUrl: sourcePost?.href || "",
          sourceTitle: normalize(
            sourcePost?.innerText ||
              sourcePost?.textContent ||
              sourcePost?.getAttribute("aria-label") ||
              "",
          ),
          collection: normalize(collectionAnchor?.innerText || ""),
          avatar,
          caption,
        });
      }

      return {
        rows,
        scrollY: window.scrollY,
        height: document.documentElement.scrollHeight,
        title: document.title,
        url: location.href,
      };
    },
    undefined,
    { timeoutMs: 12000 },
  );
}

export async function collectBatch(tab, collector, options = {}) {
  const passes = options.passes ?? 8;
  const stopAfterNoNewPasses = options.stopAfterNoNewPasses ?? 5;

  for (let index = 0; index < passes; index += 1) {
    const snapshot = await collectVisibleSavedItems(tab);
    const added = mergeRows(collector, snapshot.rows);
    collector.logs.push({
      pass: collector.logs.length + 1,
      visible: snapshot.rows.length,
      added,
      total: collector.rows.size,
      scrollY: Math.round(snapshot.scrollY),
      height: Math.round(snapshot.height),
    });

    if (added === 0 && Math.abs(snapshot.height - collector.lastHeight) < 10) {
      collector.noNewPasses += 1;
    } else {
      collector.noNewPasses = 0;
    }
    collector.lastHeight = snapshot.height;

    if (collector.noNewPasses >= stopAfterNoNewPasses) {
      return { done: true, snapshot };
    }

    await tab.cua.scroll({
      x: 900,
      y: 1650,
      scrollY: 1350,
      scrollX: 0,
    });
    await tab.playwright.waitForTimeout(options.waitMs ?? 650);
  }

  const snapshot = await collectVisibleSavedItems(tab);
  mergeRows(collector, snapshot.rows);
  return { done: false, snapshot };
}

export async function writeFacebookSavedExport(collector, snapshot, outputPath) {
  const payload = buildExportPayload(Array.from(collector.rows.values()), {
    url: snapshot?.url,
    title: snapshot?.title,
  });
  const finalPath = outputPath || getDatedExportPath(new Date());

  await mkdir(dirname(finalPath), { recursive: true });
  await writeFile(finalPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return { path: finalPath, payload };
}
