"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "../../lib/utils";
import { markdownToHtml, htmlToMarkdown } from "../../lib/markdown";
import { SlashCommand } from "./slash-command";
import { FloatingToolbar } from "./floating-toolbar";
import { MermaidExtension } from "./mermaid/mermaid-extension";
import { ImageExtension } from "./image/image-extension";
import { compressImage, sanitizeImageName } from "../../lib/image-compressor";

function showUploadToast(text: string, isError = false) {
  if (typeof document === "undefined" || !document.body) return () => {};
  const toast = document.createElement("div");
  toast.className = `fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium shadow-md transition-all ${
    isError ? "bg-red-600 text-white" : "bg-cu-purple text-white animate-pulse"
  }`;
  toast.textContent = text;
  document.body.appendChild(toast);
  if (isError) {
    setTimeout(() => {
      try {
        toast.remove();
      } catch {
        // ignore
      }
    }, 4000);
  }
  return () => {
    try {
      toast.remove();
    } catch {
      // ignore
    }
  };
}

export async function uploadAndInsertImage(file: File, editor: Editor, pos?: number) {
  const removeStatus = showUploadToast(`Uploading ${file.name || "image"}...`);
  try {
    const compressed = await compressImage(file);
    const form = new FormData();
    const uploadName = sanitizeImageName(file.name || "image.webp");
    form.append("file", compressed, uploadName);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const errData = typeof res.json === "function" ? await res.json().catch(() => null) : null;
      throw new Error(errData?.error || `Upload failed with status ${res.status}`);
    }
    const data = await res.json();

    const node = editor.schema.nodes.imageBlock?.create({
      src: data.url,
      alt: (file.name ? file.name.replace(/\.[^/.]+$/, "") : "") || "Image",
      caption: "",
      width: "100%",
      alignment: "center",
    });

    if (!node) return;

    if (pos !== undefined) {
      editor.view.dispatch(editor.state.tr.insert(pos, node));
    } else {
      editor.chain().focus().insertContent(node).run();
    }
  } catch (err) {
    console.error("Failed to insert image:", err);
    const message = err instanceof Error ? err.message : "Failed to upload image";
    showUploadToast(message, true);
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(`Image upload error: ${message}`);
    }
  } finally {
    removeStatus();
  }
}

export interface DocEditorProps {
  markdown: string;
  onChange?: (markdown: string, html: string) => void;
  onBlur?: (markdown: string, html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  mode?: "visual" | "markdown";
  onModeChange?: (mode: "visual" | "markdown") => void;
  className?: string;
}

export function DocEditor({
  markdown,
  onChange,
  onBlur,
  placeholder = "Type '/' for commands, or start typing...",
  readOnly = false,
  mode: propMode,
  onModeChange,
  className,
}: DocEditorProps) {
  const [internalMode, setInternalMode] = useState<"visual" | "markdown">("visual");
  const activeMode = propMode ?? internalMode;

  const [rawMarkdown, setRawMarkdown] = useState<string>(markdown ?? "");
  const rawMarkdownRef = useRef<string>(rawMarkdown);
  const lastMarkdownProp = useRef<string>(markdown ?? "");
  const lastMode = useRef<"visual" | "markdown">(activeMode);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    rawMarkdownRef.current = rawMarkdown;
  }, [rawMarkdown]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder,
      }),
      SlashCommand,
      MermaidExtension,
      ImageExtension,
    ],
    content: markdownToHtml(markdown ?? ""),
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "doc-rich min-h-[450px] outline-none leading-relaxed selection:bg-cu-purple/20 pb-20",
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            const ed = editorRef.current ?? (view as any).editor ?? editor;
            if (file && ed) uploadAndInsertImage(file, ed);
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event, slice, moved) => {
        if (moved) return false;
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
            const ed = editorRef.current ?? (view as any).editor ?? editor;
            if (ed) uploadAndInsertImage(file, ed, coords?.pos);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      lastMarkdownProp.current = md;
      setRawMarkdown(md);
      rawMarkdownRef.current = md;
      onChange?.(md, html);
    },
    onBlur: ({ editor }) => {
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      onBlur?.(md, html);
    },
  });

  editorRef.current = editor;

  // Sync editor editable state
  useEffect(() => {
    if (editor && editor.isEditable === readOnly) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Sync external markdown prop changes
  useEffect(() => {
    if (markdown !== lastMarkdownProp.current) {
      lastMarkdownProp.current = markdown;
      setRawMarkdown(markdown);
      rawMarkdownRef.current = markdown;
      if (editor) {
        const nextHtml = markdownToHtml(markdown);
        if (editor.getHTML() !== nextHtml) {
          editor.commands.setContent(nextHtml, { emitUpdate: false });
        }
      }
    }
  }, [markdown, editor]);

  // Sync content when activeMode changes (supports both internal toggle and external propMode changes)
  useEffect(() => {
    if (activeMode !== lastMode.current) {
      const prevMode = lastMode.current;
      lastMode.current = activeMode;

      if (activeMode === "markdown" && prevMode === "visual") {
        if (editor) {
          const html = editor.getHTML();
          const md = htmlToMarkdown(html);
          setRawMarkdown(md);
          lastMarkdownProp.current = md;
          rawMarkdownRef.current = md;
        }
      } else if (activeMode === "visual" && prevMode === "markdown") {
        if (editor) {
          const html = markdownToHtml(rawMarkdownRef.current);
          editor.commands.setContent(html, { emitUpdate: false });
        }
      }
    }
  }, [activeMode, editor]);

  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMd = e.target.value;
    setRawMarkdown(newMd);
    lastMarkdownProp.current = newMd;
    const newHtml = markdownToHtml(newMd);
    onChange?.(newMd, newHtml);
  };

  const handleRawBlur = () => {
    const html = markdownToHtml(rawMarkdown);
    onBlur?.(rawMarkdown, html);
  };

  return (
    <div className={cn("relative w-full", className)}>
      {activeMode === "visual" ? (
        <div className="relative">
          {editor && !readOnly && <FloatingToolbar editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      ) : (
        <div className="relative min-h-[450px]">
          <textarea
            value={rawMarkdown}
            onChange={handleRawChange}
            onBlur={handleRawBlur}
            disabled={readOnly}
            readOnly={readOnly}
            placeholder={placeholder}
            className="w-full min-h-[450px] bg-transparent text-cu-text font-mono text-[14px] leading-relaxed resize-none focus:outline-none placeholder:text-cu-text-tertiary"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
