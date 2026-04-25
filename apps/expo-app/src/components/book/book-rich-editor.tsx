import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildEditorHtml(initialHtml: string) {
  const safeHtml = initialHtml || "<p><br/></p>";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        color: #111827;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 18px;
        line-height: 1.8;
        direction: rtl;
      }
      #editor {
        min-height: 100vh;
        padding: 16px;
        outline: none;
        white-space: pre-wrap;
      }
      #editor a { color: #2563eb; text-decoration: underline; }
      #editor mark { background: rgba(245, 158, 11, 0.35); }
      blockquote {
        border-right: 3px solid #d1d5db;
        margin: 0;
        padding: 0 12px 0 0;
        color: #374151;
      }
      ul {
        padding-right: 24px;
      }
    </style>
  </head>
  <body>
    <div id="editor" contenteditable="true">${safeHtml}</div>
    <script>
      const editor = document.getElementById("editor");
      const postState = () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "change",
          html: editor.innerHTML,
          plainText: editor.innerText || ""
        }));
      };

      const ensureParagraph = () => {
        if (!editor.innerHTML.trim()) {
          editor.innerHTML = "<p><br/></p>";
        }
      };

      editor.addEventListener("input", () => {
        ensureParagraph();
        postState();
      });

      document.addEventListener("selectionchange", () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "selection"
        }));
      });

      window.__BOOK_EDITOR__ = {
        exec(command) {
          editor.focus();
          if (command === "bold") document.execCommand("bold");
          if (command === "italic") document.execCommand("italic");
          if (command === "underline") document.execCommand("underline");
          if (command === "undo") document.execCommand("undo");
          if (command === "redo") document.execCommand("redo");
          if (command === "bullets") document.execCommand("insertUnorderedList");
          if (command === "blockquote") {
            document.execCommand("formatBlock", false, "blockquote");
          }
          if (command === "highlight") {
            document.execCommand("styleWithCSS", false, true);
            document.execCommand("hiliteColor", false, "rgba(245, 158, 11, 0.35)");
          }
          postState();
        }
      };

      ensureParagraph();
      setTimeout(postState, 0);
    </script>
  </body>
</html>`;
}

export const BookRichEditor = forwardRef<BookRichEditorHandle, Props>(
  function BookRichEditor({ initialHtml, onChange }, ref) {
    const webViewRef = useRef<WebView>(null);
    const html = useMemo(() => buildEditorHtml(initialHtml ?? ""), [initialHtml]);

    useImperativeHandle(ref, () => ({
      exec(command) {
        const js = `window.__BOOK_EDITOR__ && window.__BOOK_EDITOR__.exec(${JSON.stringify(command)}); true;`;
        webViewRef.current?.injectJavaScript(js);
      },
    }), []);

    useEffect(() => {
      // no-op to keep ref stable for future runtime extensions
    }, []);

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "change") {
          onChange({
            html: typeof data.html === "string" ? data.html : "",
            plainText: typeof data.plainText === "string" ? data.plainText : "",
          });
        }
      } catch {}
    };

    return (
      <View className="min-h-[320px] overflow-hidden rounded-2xl bg-card">
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html }}
          onMessage={handleMessage}
          hideKeyboardAccessoryView
          keyboardDisplayRequiresUserAction={false}
          style={{ backgroundColor: "transparent", minHeight: 320 }}
        />
      </View>
    );
  },
);
