"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "../../lib/utils";
import { markdownToHtml, htmlToMarkdown } from "../../lib/markdown";
import { SlashCommand } from "./slash-command";
import { FloatingToolbar } from "./floating-toolbar";

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
    ],
    content: markdownToHtml(markdown ?? ""),
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "doc-rich min-h-[450px] outline-none leading-relaxed selection:bg-cu-purple/20 pb-20",
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
