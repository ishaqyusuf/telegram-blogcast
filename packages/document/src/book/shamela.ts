export type ParseDiagnostic = {
  code: string;
  severity: "info" | "warn" | "error";
  message: string;
  source?: string;
};

export type TenTapBreadcrumbItem = {
  label: string;
  href: string | null;
  role: "book-index" | "volume" | "topic" | "unknown";
};

export type ShamelaBookMetadata = {
  shamelaBookId: number | null;
  title: string | null;
  bookPath: string | null;
  bookUrl: string | null;
  author: {
    name: string;
    path: string | null;
    url: string | null;
  } | null;
  category: {
    name: string;
    path: string | null;
    url: string | null;
  } | null;
};

export type ShamelaTocNode = {
  kind: "volume" | "chapter";
  title: string;
  path: string | null;
  url: string | null;
  shamelaPageNo: number | null;
  volumeNumber: number | null;
  depth: number;
  sortOrder: number;
  treePath: string;
  parentTreePath: string | null;
  active: boolean;
  children: ShamelaTocNode[];
};

export type TenTapPageDocumentV1 = {
  version: "10tap.page.v1";
  source: {
    requestedUrl: string;
    finalUrl: string;
    title: string | null;
    capturedAt: string | null;
    htmlHash: string | null;
  };
  meta: {
    shamelaBookId: number | null;
    shamelaPageNo: number | null;
    printedPageNo: number | null;
    volumeNumber: number | null;
    previousShamelaPageNo: number | null;
    nextShamelaPageNo: number | null;
  };
  context: {
    breadcrumb: TenTapBreadcrumbItem[];
    currentTopic: {
      label: string | null;
      href: string | null;
    } | null;
    adjacentPages: {
      first: {
        href: string | null;
        shamelaPageNo: number | null;
      };
      previous: {
        href: string | null;
        shamelaPageNo: number | null;
      };
      next: {
        href: string | null;
        shamelaPageNo: number | null;
      };
      last: {
        href: string | null;
        shamelaPageNo: number | null;
      };
    };
    navigationSections: Array<{
      label: string | null;
      items: Array<{
        label: string;
        href: string | null;
      }>;
    }>;
    toc: ShamelaTocNode[];
  };
  content: Array<
    | {
        type: "heading";
        id: string;
        level: 1 | 2 | 3;
        text: string;
      }
    | {
        type: "paragraph";
        id: string;
        text: string;
        marks: Array<{
          type: "style";
          kind: "c5";
          start: number;
          end: number;
        }>;
        footnoteRefs: string[];
      }
    | {
        type: "footnote";
        id: string;
        marker: string;
        text: string;
        sourceClass: "hamesh";
      }
  >;
  diagnostics: ParseDiagnostic[];
};

export type ShamelaOpenPageFacts = {
  book: ShamelaBookMetadata;
  pageMeta: {
    shamelaBookId: number | null;
    shamelaPageNo: number | null;
    printedPageNo: number | null;
    volumeNumber: number | null;
    previousShamelaPageNo: number | null;
    previousShamelaUrl: string | null;
    nextShamelaPageNo: number | null;
    nextShamelaUrl: string | null;
    firstShamelaPageNo: number | null;
    firstShamelaUrl: string | null;
    lastShamelaPageNo: number | null;
    lastShamelaUrl: string | null;
  };
  breadcrumb: {
    items: Array<{
      label: string;
      href: string | null;
      position: number;
    }>;
    currentTopicFromInlineLabel: {
      label: string | null;
      href: string | null;
    } | null;
  };
  navigation: {
    sections: Array<{
      head: string | null;
      items: Array<{
        label: string;
        href: string | null;
      }>;
    }>;
  };
  toc: {
    nodes: ShamelaTocNode[];
    topLevelCount: number;
    linkCount: number;
    activeNode: ShamelaTocNode | null;
  };
  blocks: Array<{
    index: number;
    tag: string;
    classList: string[];
    text: string;
    html: string;
    kind:
      | "paragraph"
      | "footnote"
      | "heading"
      | "meta"
      | "navigation"
      | "unknown";
  }>;
  footnotes: Array<{
    index: number;
    marker: string | null;
    text: string;
    html: string;
    sourceClass: "hamesh";
  }>;
  styleMarks: Array<{
    className: "c5";
    text: string;
    blockIndex: number;
  }>;
};

export type ShamelaOpenPageParseResult = {
  facts: ShamelaOpenPageFacts;
  document: TenTapPageDocumentV1;
  renderModel: {
    meta: TenTapPageDocumentV1["meta"] & {
      title: string | null;
      currentTopic: string | null;
    };
    breadcrumb: TenTapBreadcrumbItem[];
    content: TenTapPageDocumentV1["content"];
  };
  diagnostics: ParseDiagnostic[];
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeText(value: string | null | undefined) {
  if (!value) return "";
  return stripTags(value).replace(/\s+/g, " ").trim();
}

function getBookIdFromUrl(rawUrl: string) {
  const match = rawUrl.match(/\/book\/(\d+)(?:[/?#]|$)/);
  const value = match ? Number(match[1]) : NaN;
  return Number.isFinite(value) ? value : null;
}

function getPageNoFromUrl(rawUrl: string) {
  const match = rawUrl.match(/\/book\/\d+\/(\d+)(?:[/?#]|$)/);
  const value = match ? Number(match[1]) : NaN;
  return Number.isFinite(value) ? value : null;
}

function getPathFromHref(rawHref: string | null | undefined) {
  if (!rawHref || rawHref === "javascript:;") return null;
  try {
    const url = new URL(decodeHtmlEntities(rawHref), "https://shamela.ws");
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

function getUrlFromPath(path: string | null | undefined) {
  if (!path) return null;
  try {
    return new URL(path, "https://shamela.ws").toString();
  } catch {
    return null;
  }
}

function extractHref(attrSource: string) {
  return attrSource.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? null;
}

function extractClassNames(attrSource: string) {
  return (attrSource.match(/\bclass=["']([^"']+)["']/i)?.[1] ?? "")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPageNoFromPath(path: string | null | undefined) {
  return path ? getPageNoFromUrl(path) : null;
}

function extractBookMetadata(
  html: string,
  finalUrl: string,
): ShamelaBookMetadata {
  const titleMatch = html.match(
    /<h1[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
  );
  const authorMatch = html.match(
    /<div class=["']["']>\s*\[\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*\]\s*<\/div>/i,
  );
  const categoryMatch = html.match(
    /<li>\s*<a\b[^>]*href=["']([^"']*\/category\/\d+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/li>/i,
  );
  const bookPath =
    getPathFromHref(titleMatch?.[1]) ?? getPathFromHref(finalUrl);
  const authorPath = getPathFromHref(authorMatch?.[1]);
  const categoryPath = getPathFromHref(categoryMatch?.[1]);

  return {
    shamelaBookId: bookPath
      ? getBookIdFromUrl(bookPath)
      : getBookIdFromUrl(finalUrl),
    title: normalizeText(titleMatch?.[2]),
    bookPath,
    bookUrl: getUrlFromPath(bookPath),
    author: authorMatch
      ? {
          name: normalizeText(authorMatch[2]),
          path: authorPath,
          url: getUrlFromPath(authorPath),
        }
      : null,
    category: categoryMatch
      ? {
          name: normalizeText(categoryMatch[2]),
          path: categoryPath,
          url: getUrlFromPath(categoryPath),
        }
      : null,
  };
}

function parseArabicDigits(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/[٠-٩]/g, (digit) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
  );
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractNassMeta(html: string) {
  const match = html.match(
    /<div\b[^>]*class=["'][^"']*\bnass\b[^"']*["'][^>]*>/i,
  );
  const attrs = match?.[0] ?? "";
  const pageId = parseArabicDigits(
    attrs.match(/\bdata-page-id=["']([^"']+)["']/i)?.[1],
  );
  const pageNum = parseArabicDigits(
    attrs.match(/\bdata-page-num=["']([^"']+)["']/i)?.[1],
  );

  return {
    pageId,
    pageNum,
  };
}

function extractNassContentHtml(html: string) {
  return (
    html.match(
      /<div\b[^>]*class=["'][^"']*\bnass\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div\s+id=["']appended_pages["']/i,
    )?.[1] ?? html
  );
}

function extractInputValue(html: string, inputId: string) {
  const pattern = new RegExp(
    `<input\\b[^>]*id=["']${inputId}["'][^>]*value=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1] ?? null;
}

function extractAnchorTrail(html: string) {
  const sectionMatch = html.match(
    /<div class="heading-title heading-border[\s\S]*?<div class="size-12">([\s\S]*?)<\/div>\s*<\/div>/i,
  );
  const source = sectionMatch?.[1] ?? "";
  return [
    ...source.matchAll(
      /<a[^>]*href="([^"]+)"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/a>/gi,
    ),
  ].map((match, index) => ({
    label: normalizeText(match[2]),
    href: match[1] ?? null,
    position: index,
  }));
}

function extractCurrentTopicFromInlineLabel(html: string) {
  const match = html.match(/current topic:\s*<span[^>]*>([\s\S]*?)<\/span>/i);
  const label = normalizeText(match?.[1]);
  return label
    ? {
        label,
        href: null,
      }
    : null;
}

function extractNavigationSections(html: string) {
  const navBlock = html.match(
    /<div\b[^>]*class=["'][^"']*\bs-nav\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div\b[^>]*class=["'][^"']*\bcol-md-8\b/i,
  )?.[1];
  if (!navBlock) return [];

  const head = normalizeText(
    navBlock.match(
      /<div\b[^>]*class=["'][^"']*\bs-nav-head\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    )?.[1],
  );

  return [
    {
      head,
      items: [...navBlock.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
        .map((item) => ({
          label: normalizeText(item[2]),
          href: extractHref(item[1] ?? ""),
        }))
        .filter((item) => item.label && item.href !== "javascript:;"),
    },
  ];
}

function getHrefWithPageNo(html: string, pageNo: number | null): string | null {
  if (pageNo == null) return null;
  const escapedPageNo = String(pageNo).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(
      `<a\\b([^>]*)href=["']([^"']*/book/\\d+/${escapedPageNo}(?:#[^"']*)?)["'][^>]*>`,
      "i",
    ),
  );
  return match?.[2] ?? null;
}

function extractAdjacentPages(html: string) {
  const pagerLinks = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const href = extractHref(match[1] ?? "");
      const label = normalizeText(match[2]);
      return {
        href,
        label,
        shamelaPageNo: href ? getPageNoFromUrl(href) : null,
      };
    })
    .filter(
      (item) =>
        Boolean(item.href?.includes("/book/")) && item.shamelaPageNo != null,
    );
  const firstLink = pagerLinks.find((item) => item.label === "<<") ?? null;
  const lastLink = pagerLinks.find((item) => item.label === ">>") ?? null;
  const previousFromButton = parseArabicDigits(
    html.match(
      /\bid=["']bu_load_prev["'][^>]*\bdata-prev-id=["']([^"']+)["']/i,
    )?.[1] ??
      html.match(
        /\bdata-prev-id=["']([^"']+)["'][^>]*\bid=["']bu_load_prev["']/i,
      )?.[1],
  );
  const nextFromButton = parseArabicDigits(
    html.match(
      /\bid=["']bu_load_next["'][^>]*\bdata-next-id=["']([^"']+)["']/i,
    )?.[1] ??
      html.match(
        /\bdata-next-id=["']([^"']+)["'][^>]*\bid=["']bu_load_next["']/i,
      )?.[1],
  );
  const previousHref = getHrefWithPageNo(html, previousFromButton);
  const nextHref = getHrefWithPageNo(html, nextFromButton);

  return {
    first: {
      href: firstLink?.href ?? null,
      shamelaPageNo: firstLink?.shamelaPageNo ?? null,
    },
    previous: {
      href: previousHref,
      shamelaPageNo: previousFromButton,
    },
    next: {
      href: nextHref,
      shamelaPageNo: nextFromButton,
    },
    last: {
      href: lastLink?.href ?? null,
      shamelaPageNo: lastLink?.shamelaPageNo ?? null,
    },
  };
}

function flattenToc(nodes: ShamelaTocNode[]): ShamelaTocNode[] {
  return nodes.flatMap((node) => [node, ...flattenToc(node.children)]);
}

function extractTocTree(html: string): ShamelaTocNode[] {
  const navBlock = html.match(
    /<div\b[^>]*class=["'][^"']*\bs-nav\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div\b[^>]*class=["'][^"']*\bcol-md-8\b/i,
  )?.[1];
  if (!navBlock) return [];

  const topLevelMatches = [
    ...navBlock.matchAll(
      /<li>\s*<a\b[^>]*href=["']javascript:;["'][^>]*class=["'][^"']*\bexp_bu\b[^"']*["'][\s\S]*?<\/a>\s*<a\b([^>]*)>([\s\S]*?)<\/a>\s*<ul[^>]*>([\s\S]*?)<\/ul>\s*<\/li>/gi,
    ),
  ];

  return topLevelMatches.map((match, volumeIndex) => {
    const attrs = match[1] ?? "";
    const path = getPathFromHref(extractHref(attrs));
    const treePath = String(volumeIndex + 1);
    const volumeNumber = volumeIndex + 1;
    const volumeNode: ShamelaTocNode = {
      kind: "volume",
      title: normalizeText(match[2]),
      path,
      url: getUrlFromPath(path),
      shamelaPageNo: getPageNoFromPath(path),
      volumeNumber,
      depth: 0,
      sortOrder: volumeIndex,
      treePath,
      parentTreePath: null,
      active: extractClassNames(attrs).includes("active"),
      children: [],
    };

    volumeNode.children = [
      ...(match[3] ?? "").matchAll(
        /<li>\s*-?\s*<a\b([^>]*)>([\s\S]*?)<\/a>\s*<\/li>/gi,
      ),
    ]
      .map((childMatch, childIndex) => {
        const childAttrs = childMatch[1] ?? "";
        const childPath = getPathFromHref(extractHref(childAttrs));
        return {
          kind: "chapter" as const,
          title: normalizeText(childMatch[2]),
          path: childPath,
          url: getUrlFromPath(childPath),
          shamelaPageNo: getPageNoFromPath(childPath),
          volumeNumber,
          depth: 1,
          sortOrder: childIndex,
          treePath: `${treePath}.${childIndex + 1}`,
          parentTreePath: treePath,
          active: extractClassNames(childAttrs).includes("active"),
          children: [],
        };
      })
      .filter((node) => node.title.length > 0);

    return volumeNode;
  });
}

function extractFootnotes(html: string) {
  return [
    ...html.matchAll(
      /<(?:div|p|li)\b[^>]*class="[^"]*\bhamesh\b[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p|li)>/gi,
    ),
  ]
    .map((match, index) => {
      const rawText = stripTags(match[1] ?? "");
      if (!rawText) return null;
      const markerMatch = rawText.match(
        /^([0-9\u0660-\u0669A-Za-z\u0623-\u064A]+)[\s)\].:-]+/,
      );
      return {
        index,
        marker: markerMatch?.[1] ?? null,
        text: markerMatch
          ? rawText.slice(markerMatch[0].length).trim()
          : rawText,
        html: match[1] ?? "",
        sourceClass: "hamesh" as const,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function extractParagraphMatches(html: string) {
  return [...html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)]
    .map((match, index) => {
      const attrs = match[1] ?? "";
      const blockHtml = match[2] ?? "";
      const classMatch = attrs.match(/class="([^"]+)"/i);
      const classList = (classMatch?.[1] ?? "")
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean);
      const text = stripTags(blockHtml).trim();
      return {
        index,
        tag: "p",
        classList,
        text,
        html: blockHtml,
      };
    })
    .filter(
      (block) => block.text.length > 20 && !block.classList.includes("hamesh"),
    );
}

function extractStyleMarksFromParagraph(html: string, blockIndex: number) {
  return [
    ...html.matchAll(
      /<[^>]*class="[^"]*\bc5\b[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/gi,
    ),
  ]
    .map((match) => normalizeText(match[1]))
    .filter(Boolean)
    .map((text) => ({
      className: "c5" as const,
      text,
      blockIndex,
    }));
}

function classifyBreadcrumbRole(
  label: string,
  position: number,
  total: number,
): TenTapBreadcrumbItem["role"] {
  if (position === 0 && /فهرس الكتاب/.test(label)) return "book-index";
  if (/المجلد|الجزء|الجزء|الكتاب/.test(label) && position < total - 1)
    return "volume";
  if (position === total - 1) return "topic";
  return "unknown";
}

export function parseShamelaOpenPage(input: {
  html: string;
  requestedUrl: string;
  finalUrl: string;
  title?: string | null;
  capturedAt?: string | null;
  htmlHash?: string | null;
}): ShamelaOpenPageParseResult {
  const diagnostics: ParseDiagnostic[] = [];

  const nassMeta = extractNassMeta(input.html);
  const printedPageNoFromInput = parseArabicDigits(
    extractInputValue(input.html, "fld_goto_top"),
  );
  const volumeNumber = parseArabicDigits(
    extractInputValue(input.html, "fld_part_top"),
  );
  const shamelaPageNo = nassMeta.pageId ?? getPageNoFromUrl(input.finalUrl);
  const printedPageNo = nassMeta.pageNum ?? printedPageNoFromInput;
  const shamelaBookId =
    getBookIdFromUrl(input.finalUrl) ?? getBookIdFromUrl(input.requestedUrl);
  const book = extractBookMetadata(input.html, input.finalUrl);

  if (nassMeta.pageId != null) {
    diagnostics.push({
      code: "shamela-page-id-from-nass",
      severity: "info",
      message: `Resolved Shamela page ID from .nass[data-page-id]: ${nassMeta.pageId}`,
      source: ".nass[data-page-id]",
    });
  }
  if (printedPageNo != null) {
    diagnostics.push({
      code: "printed-page-number-from-nass",
      severity: "info",
      message: `Resolved printed page number: ${printedPageNo}`,
      source: ".nass[data-page-num]",
    });
  }
  if (volumeNumber != null) {
    diagnostics.push({
      code: "volume-number-from-hidden-input",
      severity: "info",
      message: `Resolved volume number from #fld_part_top: ${volumeNumber}`,
      source: "#fld_part_top",
    });
  }

  const breadcrumbFacts = extractAnchorTrail(input.html);
  const breadcrumb = breadcrumbFacts.map((item, index) => ({
    label: item.label,
    href: item.href,
    role: classifyBreadcrumbRole(item.label, index, breadcrumbFacts.length),
  }));
  const currentTopicInline = extractCurrentTopicFromInlineLabel(input.html);
  const currentTopic =
    currentTopicInline ??
    (() => {
      const last = breadcrumb[breadcrumb.length - 1];
      return last
        ? {
            label: last.label,
            href: last.href,
          }
        : null;
    })();

  const navigationSections = extractNavigationSections(input.html);
  const documentNavigationSections = navigationSections.map((section) => ({
    label: section.head,
    items: section.items,
  }));
  const adjacentPages = extractAdjacentPages(input.html);
  const tocNodes = extractTocTree(input.html);
  const flatTocNodes = flattenToc(tocNodes);
  const activeTocNode = flatTocNodes.find((node) => node.active) ?? null;
  if (navigationSections.some((section) => section.head === "فصول الكتاب")) {
    diagnostics.push({
      code: "navigation-fusul-detected",
      severity: "info",
      message: 'Detected "فصول الكتاب" navigation section.',
      source: "s-nav > s-nav-head",
    });
  }
  if (tocNodes.length > 0) {
    diagnostics.push({
      code: "toc-tree-detected",
      severity: "info",
      message: `Detected ${tocNodes.length} top-level TOC nodes and ${flatTocNodes.length} total TOC nodes.`,
      source: ".s-nav",
    });
  }

  const pageContentHtml = extractNassContentHtml(input.html);
  const paragraphBlocks = extractParagraphMatches(pageContentHtml);
  const footnotes = extractFootnotes(pageContentHtml);
  if (footnotes.length > 0) {
    diagnostics.push({
      code: "footnotes-from-hamesh",
      severity: "info",
      message: `Detected ${footnotes.length} footnotes from .hamesh blocks.`,
      source: ".hamesh",
    });
  } else {
    diagnostics.push({
      code: "no-footnotes-found",
      severity: "warn",
      message: "No .hamesh footnote blocks detected.",
      source: ".hamesh",
    });
  }

  const styleMarks = paragraphBlocks.flatMap((block) =>
    extractStyleMarksFromParagraph(block.html, block.index),
  );
  if (styleMarks.length > 0) {
    diagnostics.push({
      code: "c5-inline-style-detected",
      severity: "info",
      message: `Detected ${styleMarks.length} .c5 style mark segments.`,
      source: ".c5",
    });
  }

  const paragraphContent = paragraphBlocks.map((block, index) => {
    const marks = styleMarks
      .filter((mark) => mark.blockIndex === block.index)
      .map((mark) => {
        const start = block.text.indexOf(mark.text);
        return {
          type: "style" as const,
          kind: "c5" as const,
          start: start >= 0 ? start : 0,
          end: start >= 0 ? start + mark.text.length : mark.text.length,
        };
      });
    return {
      type: "paragraph" as const,
      id: `p-${index + 1}`,
      text: block.text,
      marks,
      footnoteRefs: [
        ...block.html.matchAll(
          /<span\b[^>]*class=["'][^"']*\bc2\b[^"']*["'][^>]*>\s*\(([^)]+)\)\s*<\/span>/gi,
        ),
      ]
        .map((match) => normalizeText(match[1]))
        .filter(Boolean),
    };
  });

  const footnoteContent = footnotes.map((footnote, index) => ({
    type: "footnote" as const,
    id: `fn-${index + 1}`,
    marker: footnote.marker ?? String(index + 1),
    text: footnote.text,
    sourceClass: "hamesh" as const,
  }));

  const headingText =
    currentTopic?.label ??
    breadcrumb[breadcrumb.length - 1]?.label ??
    normalizeText(input.title) ??
    null;
  const headingContent = headingText
    ? [
        {
          type: "heading" as const,
          id: "heading-1",
          level: 1 as const,
          text: headingText,
        },
      ]
    : [];

  const facts: ShamelaOpenPageFacts = {
    book,
    pageMeta: {
      shamelaBookId: book.shamelaBookId ?? shamelaBookId,
      shamelaPageNo,
      printedPageNo,
      volumeNumber,
      previousShamelaPageNo: adjacentPages.previous.shamelaPageNo,
      previousShamelaUrl: adjacentPages.previous.href,
      nextShamelaPageNo: adjacentPages.next.shamelaPageNo,
      nextShamelaUrl: adjacentPages.next.href,
      firstShamelaPageNo: adjacentPages.first.shamelaPageNo,
      firstShamelaUrl: adjacentPages.first.href,
      lastShamelaPageNo: adjacentPages.last.shamelaPageNo,
      lastShamelaUrl: adjacentPages.last.href,
    },
    breadcrumb: {
      items: breadcrumbFacts,
      currentTopicFromInlineLabel: currentTopicInline,
    },
    navigation: {
      sections: navigationSections,
    },
    toc: {
      nodes: tocNodes,
      topLevelCount: tocNodes.length,
      linkCount: flatTocNodes.filter((node) => node.path).length,
      activeNode: activeTocNode,
    },
    blocks: [
      ...headingContent.map((heading, index) => ({
        index,
        tag: "h1",
        classList: [],
        text: heading.text,
        html: heading.text,
        kind: "heading" as const,
      })),
      ...paragraphBlocks.map((block) => ({
        ...block,
        kind: "paragraph" as const,
      })),
      ...footnotes.map((footnote) => ({
        index: footnote.index,
        tag: "div",
        classList: ["hamesh"],
        text: footnote.text,
        html: footnote.html,
        kind: "footnote" as const,
      })),
    ],
    footnotes,
    styleMarks,
  };

  if (paragraphContent.length === 0) {
    diagnostics.push({
      code: "no-paragraphs-found",
      severity: "error",
      message: "No paragraph blocks were extracted from the opened page.",
      source: "<p>",
    });
  }

  const document: TenTapPageDocumentV1 = {
    version: "10tap.page.v1",
    source: {
      requestedUrl: input.requestedUrl,
      finalUrl: input.finalUrl,
      title: input.title ?? null,
      capturedAt: input.capturedAt ?? null,
      htmlHash: input.htmlHash ?? null,
    },
    meta: {
      shamelaBookId: book.shamelaBookId ?? shamelaBookId,
      shamelaPageNo,
      printedPageNo,
      volumeNumber,
      previousShamelaPageNo: adjacentPages.previous.shamelaPageNo,
      nextShamelaPageNo: adjacentPages.next.shamelaPageNo,
    },
    context: {
      breadcrumb,
      currentTopic,
      adjacentPages,
      navigationSections: documentNavigationSections,
      toc: tocNodes,
    },
    content: [...headingContent, ...paragraphContent, ...footnoteContent],
    diagnostics,
  };

  return {
    facts,
    document,
    renderModel: {
      meta: {
        ...document.meta,
        title: document.source.title,
        currentTopic: document.context.currentTopic?.label ?? null,
      },
      breadcrumb: document.context.breadcrumb,
      content: document.content,
    },
    diagnostics,
  };
}
