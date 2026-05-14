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
  };
  context: {
    breadcrumb: TenTapBreadcrumbItem[];
    currentTopic: {
      label: string | null;
      href: string | null;
    } | null;
    navigationSections: Array<{
      label: string | null;
      items: Array<{
        label: string;
        href: string | null;
      }>;
    }>;
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
  pageMeta: {
    shamelaBookId: number | null;
    shamelaPageNo: number | null;
    printedPageNo: number | null;
    volumeNumber: number | null;
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
  blocks: Array<{
    index: number;
    tag: string;
    classList: string[];
    text: string;
    html: string;
    kind: "paragraph" | "footnote" | "heading" | "meta" | "navigation" | "unknown";
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

function parseArabicDigits(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/[٠-٩]/g, (digit) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
  );
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
  return [...source.matchAll(/<a[^>]*href="([^"]+)"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/a>/gi)].map(
    (match, index) => ({
      label: normalizeText(match[2]),
      href: match[1] ?? null,
      position: index,
    }),
  );
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
  const matches = [...html.matchAll(/<s-nav[\s\S]*?<s-nav-head[^>]*>([\s\S]*?)<\/s-nav-head>([\s\S]*?)<\/s-nav>/gi)];
  return matches.map((match) => ({
    head: normalizeText(match[1]),
    items: [...(match[2] ?? "").matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(
      (item) => ({
        label: normalizeText(item[2]),
        href: item[1] ?? null,
      }),
    ),
  }));
}

function extractFootnotes(html: string) {
  return [...html.matchAll(/<(?:div|p|li)\b[^>]*class="[^"]*\bhamesh\b[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p|li)>/gi)]
    .map((match, index) => {
      const rawText = stripTags(match[1] ?? "");
      if (!rawText) return null;
      const markerMatch = rawText.match(/^([0-9\u0660-\u0669A-Za-z\u0623-\u064A]+)[\s)\].:-]+/);
      return {
        index,
        marker: markerMatch?.[1] ?? null,
        text: markerMatch ? rawText.slice(markerMatch[0].length).trim() : rawText,
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
    .filter((block) => block.text.length > 20 && !block.classList.includes("hamesh"));
}

function extractStyleMarksFromParagraph(html: string, blockIndex: number) {
  return [...html.matchAll(/<[^>]*class="[^"]*\bc5\b[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/gi)]
    .map((match) => normalizeText(match[1]))
    .filter(Boolean)
    .map((text) => ({
      className: "c5" as const,
      text,
      blockIndex,
    }));
}

function classifyBreadcrumbRole(label: string, position: number, total: number): TenTapBreadcrumbItem["role"] {
  if (position === 0 && /فهرس الكتاب/.test(label)) return "book-index";
  if (/المجلد|الجزء|الجزء|الكتاب/.test(label) && position < total - 1) return "volume";
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

  const shamelaPageNoFromInput = parseArabicDigits(extractInputValue(input.html, "fld_goto_top"));
  const volumeNumber = parseArabicDigits(extractInputValue(input.html, "fld_part_top"));
  const shamelaPageNo = shamelaPageNoFromInput ?? getPageNoFromUrl(input.finalUrl);
  const shamelaBookId = getBookIdFromUrl(input.finalUrl) ?? getBookIdFromUrl(input.requestedUrl);

  if (shamelaPageNoFromInput != null) {
    diagnostics.push({
      code: "page-number-from-input",
      severity: "info",
      message: `Resolved page number from #fld_goto_top: ${shamelaPageNoFromInput}`,
      source: "#fld_goto_top",
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

  const printedPageMatch = stripTags(input.html).match(
    /(?:الصفحة|صفحة|Page)\s*[:#]?\s*([0-9\u0660-\u0669]+)/i,
  );
  const printedPageNo = parseArabicDigits(printedPageMatch?.[1]);

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
  if (navigationSections.some((section) => section.head === "فصول الكتاب")) {
    diagnostics.push({
      code: "navigation-fusul-detected",
      severity: "info",
      message: 'Detected "فصول الكتاب" navigation section.',
      source: "s-nav > s-nav-head",
    });
  }

  const paragraphBlocks = extractParagraphMatches(input.html);
  const footnotes = extractFootnotes(input.html);
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
      footnoteRefs: [] as string[],
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
    pageMeta: {
      shamelaBookId,
      shamelaPageNo,
      printedPageNo,
      volumeNumber,
    },
    breadcrumb: {
      items: breadcrumbFacts,
      currentTopicFromInlineLabel: currentTopicInline,
    },
    navigation: {
      sections: navigationSections,
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
      shamelaBookId,
      shamelaPageNo,
      printedPageNo,
      volumeNumber,
    },
    context: {
      breadcrumb,
      currentTopic,
      navigationSections,
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
