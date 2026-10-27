"use client";
// filename: admin/editor.tsx

import { useState, type ReactElement } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import {
  TableNode,
  TableRowNode,
  TableCellNode,
  INSERT_TABLE_COMMAND,
} from "@lexical/table";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  HeadingNode,
  QuoteNode,
  $createHeadingNode,
  $createQuoteNode,
} from "@lexical/rich-text";
import {
  ListNode,
  ListItemNode,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from "@lexical/list";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { CodeNode, CodeHighlightNode, $createCodeNode } from "@lexical/code";
import { $setBlocksType } from "@lexical/selection";
import {
  DecoratorNode,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $insertNodes,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  type NodeKey,
  type SerializedLexicalNode,
} from "lexical";
import {
  DocumentSchema,
  safeURL,
  type ContentNode,
  type Document,
  type Media,
} from "@/lib/domain";

type ImageJSON = SerializedLexicalNode & { mediaId: string; alt: string };
class ImageNode extends DecoratorNode<ReactElement> {
  __mediaId: string;
  __alt: string;
  static getType() {
    return "image";
  }
  static clone(node: ImageNode) {
    return new ImageNode(node.__mediaId, node.__alt, node.__key);
  }
  constructor(mediaId: string, alt: string, key?: NodeKey) {
    super(key);
    this.__mediaId = mediaId;
    this.__alt = alt;
  }
  static importJSON(node: ImageJSON) {
    return new ImageNode(node.mediaId, node.alt);
  }
  exportJSON(): ImageJSON {
    return {
      ...super.exportJSON(),
      type: "image",
      version: 1,
      mediaId: this.__mediaId,
      alt: this.__alt,
    };
  }
  createDOM() {
    return document.createElement("span");
  }
  updateDOM() {
    return false;
  }
  decorate() {
    return (
      <img
        src={`/media/${this.__mediaId}?preview=1&w=640`}
        alt={this.__alt}
        style={{ maxWidth: "100%" }}
      />
    );
  }
}
function Toolbar({
  pageId,
  media,
  onMediaAdded,
}: {
  pageId?: string;
  media: Media[];
  onMediaAdded?: (image: Media) => void;
}) {
  const [editor] = useLexicalComposerContext(),
    [url, setURL] = useState(""),
    [alt, setAlt] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const block = (kind: string) =>
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection))
        $setBlocksType(selection, () =>
          kind === "h2"
            ? $createHeadingNode("h2")
            : kind === "h3"
              ? $createHeadingNode("h3")
              : kind === "quote"
                ? $createQuoteNode()
                : kind === "code"
                  ? $createCodeNode()
                  : $createParagraphNode(),
        );
    });
  async function upload(file: File) {
    if (!pageId) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("pageId", pageId);
      form.set("alt", alt);
      form.set("file", file);
      const response = await fetch("/api/admin/media", {
        method: "POST",
        body: form,
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.detail || "Upload failed");
      const image = value as Media;
      onMediaAdded?.(image);
      editor.update(() => $insertNodes([new ImageNode(image.id, image.alt)]));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="editor-toolbar" aria-label="Text formatting">
        <button
          type="button"
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        >
          Redo
        </button>
        <button
          type="button"
          onClick={() =>
            editor.dispatchCommand(INSERT_TABLE_COMMAND, {
              rows: "3",
              columns: "3",
              includeHeaders: true,
            })
          }
        >
          Insert table
        </button>
        {["paragraph", "h2", "h3", "quote", "code"].map((kind) => (
          <button type="button" key={kind} onClick={() => block(kind)}>
            {kind}
          </button>
        ))}
        <button
          type="button"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() =>
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
          }
        >
          Bullets
        </button>
        <button
          type="button"
          onClick={() =>
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
          }
        >
          Numbered list
        </button>
      </div>
      <div className="editor-toolbar">
        <label>
          Link URL{" "}
          <input
            value={url}
            onChange={(event) => setURL(event.target.value)}
            placeholder="https:// or /path"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            try {
              editor.dispatchCommand(TOGGLE_LINK_COMMAND, safeURL(url));
              setError("");
            } catch {
              setError("Enter a safe HTTP(S) or local link.");
            }
          }}
        >
          Apply link to selection
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)}
        >
          Remove link
        </button>
      </div>
      <div className="editor-toolbar">
        <label>
          Image alt text{" "}
          <input value={alt} onChange={(event) => setAlt(event.target.value)} />
        </label>
        <label>
          Upload image{" "}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={!pageId || busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
        <label>
          Existing image{" "}
          <select
            defaultValue=""
            disabled={!pageId}
            onChange={(event) => {
              const image = media.find(
                (item) => item.id === event.target.value,
              );
              if (image)
                editor.update(() =>
                  $insertNodes([new ImageNode(image.id, image.alt)]),
                );
              event.target.value = "";
            }}
          >
            <option value="">Choose image</option>
            {media.map((image) => (
              <option value={image.id} key={image.id}>
                {image.alt}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
function editorTree(node: ContentNode): unknown {
  if (node.type === "text" || node.type === "code-highlight")
    return {
      ...node,
      format: typeof node.format === "number" ? node.format : 0,
      detail: 0,
      mode: "normal",
      style: "",
    };
  return {
    ...node,
    format: typeof node.format === "string" ? node.format : "",
    indent: node.indent || 0,
    direction: null,
    textFormat: 0,
    textStyle: "",
    ...(node.type === "list"
      ? {
          tag: node.listType === "number" ? "ol" : "ul",
          start: node.start || 1,
        }
      : {}),
    ...(node.type === "listitem" ? { value: 1 } : {}),
    children: node.children?.map(editorTree) || [],
  };
}
export default function Editor({
  value,
  onChange,
  pageId,
  media,
  onMediaAdded,
  readOnly = false,
}: {
  value: Document;
  onChange: (value: Document) => void;
  pageId?: string;
  media: Media[];
  onMediaAdded?: (image: Media) => void;
  readOnly?: boolean;
}) {
  const [error, setError] = useState("");
  const [config] = useState(() => ({
    namespace: "cms-editor",
    editable: !readOnly,
    nodes: [
      TableNode,
      TableRowNode,
      TableCellNode,
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      CodeNode,
      CodeHighlightNode,
      ImageNode,
    ],
    editorState: JSON.stringify({ root: editorTree(value.root) }),
    onError: (error: Error) => setError(error.message),
    theme: {},
  }));
  return (
    <div className="editor">
      <LexicalComposer initialConfig={config}>
        <Toolbar pageId={pageId} media={media} onMediaAdded={onMediaAdded} />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              aria-label="Page body"
              className="editor-content"
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <TablePlugin />
        <LinkPlugin />
        <OnChangePlugin
          onChange={(state) => {
            const result = DocumentSchema.safeParse({
              version: 1,
              ...state.toJSON(),
            });
            if (result.success) {
              onChange(result.data);
              setError("");
            } else
              setError(
                "The document contains unsupported blocks or exceeds its size limit.",
              );
          }}
        />
      </LexicalComposer>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
