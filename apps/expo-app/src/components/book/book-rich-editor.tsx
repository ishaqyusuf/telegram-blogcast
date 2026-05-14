import {
  CoreBridge,
  PlaceholderBridge,
  RichText,
  TenTapStartKit,
  useBridgeState,
  useEditorBridge,
} from "@10play/tentap-editor";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";

export type BookRichEditorCommand =
  | "bold"
  | "italic"
  | "underline"
  | "highlight"
  | "blockquote"
  | "bullets"
  | "undo"
  | "redo";

export type BookRichEditorHandle = {
  exec: (command: BookRichEditorCommand) => void;
};

type Props = {
  initialHtml?: string | null;
  onChange: (payload: { html: string; plainText: string }) => void;
};

const HIGHLIGHT_COLOR = "rgba(245, 158, 11, 0.35)";
const BOOK_EDITOR_CSS = `
  * {
    direction: rtl;
    text-align: right;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 18px;
    line-height: 1.8;
  }

  html, body {
    min-height: 100%;
    margin: 0;
    padding: 0;
    background: transparent;
  }

  .ProseMirror {
    min-height: 100%;
    box-sizing: border-box;
    padding: 12px 14px 16px;
    outline: none;
    white-space: pre-wrap;
  }

  .ProseMirror a {
    color: #2563eb;
    text-decoration: underline;
  }

  .ProseMirror mark {
    background: ${HIGHLIGHT_COLOR};
  }

  .ProseMirror blockquote {
    border-right: 3px solid #d1d5db;
    margin: 0;
    padding: 0 12px 0 0;
    color: #374151;
  }

  .ProseMirror ul {
    padding-right: 24px;
    padding-left: 0;
  }
`;

export const BookRichEditor = forwardRef<BookRichEditorHandle, Props>(
  function BookRichEditor({ initialHtml, onChange }, ref) {
    const hasInjectedCss = useRef(false);
    const onChangeRef = useRef(onChange);
    const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestIdRef = useRef(0);
    const editor = useEditorBridge({
      autofocus: true,
      avoidIosKeyboard: true,
      initialContent: initialHtml?.trim() ? initialHtml : "<p></p>",
      onChange: () => {
        if (changeTimerRef.current) {
          clearTimeout(changeTimerRef.current);
        }

        changeTimerRef.current = setTimeout(async () => {
          const requestId = ++requestIdRef.current;

          try {
            const [html, plainText] = await Promise.all([
              editor.getHTML(),
              editor.getText(),
            ]);

            if (requestId !== requestIdRef.current) return;

            onChangeRef.current({ html, plainText });
          } catch {}
        }, 220);
      },
      bridgeExtensions: [
        ...TenTapStartKit,
        CoreBridge.configureCSS(BOOK_EDITOR_CSS),
        PlaceholderBridge.configureExtension({
          placeholder: "ابدأ الكتابة...",
        }),
      ],
    });
    const editorState = useBridgeState(editor);

    useImperativeHandle(ref, () => ({
      exec(command) {
        editor.focus();
        if (command === "bold") editor.toggleBold();
        if (command === "italic") editor.toggleItalic();
        if (command === "underline") editor.toggleUnderline();
        if (command === "highlight") editor.toggleHighlight(HIGHLIGHT_COLOR);
        if (command === "blockquote") editor.toggleBlockquote();
        if (command === "bullets") editor.toggleBulletList();
        if (command === "undo") editor.undo();
        if (command === "redo") editor.redo();
      },
    }), [editor]);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      if (!editorState.isReady || hasInjectedCss.current) return;
      editor.injectCSS(BOOK_EDITOR_CSS, "book-editor-theme");
      hasInjectedCss.current = true;
    }, [editor, editorState.isReady]);

    useEffect(() => {
      if (!editorState.isReady) return;

      let cancelled = false;

      const syncInitialContent = async () => {
        try {
          const [html, plainText] = await Promise.all([
            editor.getHTML(),
            editor.getText(),
          ]);

          if (cancelled) return;
          onChangeRef.current({ html, plainText });
        } catch {}
      };

      void syncInitialContent();

      return () => {
        cancelled = true;
      };
    }, [editor, editorState.isReady]);

    useEffect(() => {
      return () => {
        if (changeTimerRef.current) {
          clearTimeout(changeTimerRef.current);
        }
      };
    }, []);

    return (
      <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <RichText editor={editor} />
      </View>
    );
  },
);
