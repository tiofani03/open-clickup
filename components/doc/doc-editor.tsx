"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Eye,
  FileText,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { markdownToHtml, htmlToMarkdown } from "../../lib/markdown";
import { SlashCommand } from "./slash-command";

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
  placeholder = "Type '/' for commands or start typing...",
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
        class: "rich min-h-[350px] p-4 outline-none leading-relaxed",
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

  // Handle mode toggling from UI buttons
  const setMode = (nextMode: "visual" | "markdown") => {
    if (nextMode === activeMode) return;
    setInternalMode(nextMode);
    onModeChange?.(nextMode);
  };

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
    <div
      className={cn(
        "rounded-lg border border-cu-border bg-cu-panel transition-colors focus-within:border-cu-purple/60",
        className
      )}
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-cu-border bg-cu-panel px-2 py-1.5">
        {/* Left: formatting tools for visual mode or markdown indicator */}
        <div className="flex items-center gap-0.5">
          {activeMode === "visual" && editor && !readOnly ? (
            <VisualToolbar editor={editor} />
          ) : activeMode === "markdown" ? (
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-cu-text-secondary">
              <FileText className="h-3.5 w-3.5 text-cu-purple" />
              <span>Raw Markdown Mode</span>
            </div>
          ) : (
            <div className="h-7" />
          )}
        </div>

        {/* Right: Mode Switch Toggle Buttons */}
        <div className="flex items-center rounded-md border border-cu-border bg-cu-bg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("visual")}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 transition-colors",
              activeMode === "visual"
                ? "bg-cu-purple text-white shadow-xs font-medium"
                : "text-cu-text-secondary hover:text-cu-text"
            )}
            title="Visual WYSIWYG Mode"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Visual</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("markdown")}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 transition-colors",
              activeMode === "markdown"
                ? "bg-cu-purple text-white shadow-xs font-medium"
                : "text-cu-text-secondary hover:text-cu-text"
            )}
            title="Raw Markdown Mode"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Markdown</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      {activeMode === "visual" ? (
        <div className="relative min-h-[350px]">
          <EditorContent editor={editor} />
        </div>
      ) : (
        <div className="relative min-h-[350px]">
          <textarea
            value={rawMarkdown}
            onChange={handleRawChange}
            onBlur={handleRawBlur}
            disabled={readOnly}
            readOnly={readOnly}
            placeholder={placeholder}
            className="w-full min-h-[350px] p-4 bg-cu-panel text-cu-text font-mono text-[13px] leading-relaxed resize-y focus:outline-none"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}

function VisualToolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    cn(
      "flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-cu-hover",
      active
        ? "bg-cu-purple-light text-cu-purple-dark font-medium dark:bg-cu-purple/20 dark:text-cu-purple"
        : "text-cu-text-secondary hover:text-cu-text"
    );

  return (
    <>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btn(editor.isActive("heading", { level: 1 }))}
        title="Heading 1"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
        title="Heading 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
        title="Heading 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </button>

      <span className="mx-1 h-4 w-px bg-cu-border" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike"))}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={btn(editor.isActive("code"))}
        title="Inline Code"
      >
        <Code className="h-3.5 w-3.5" />
      </button>

      <span className="mx-1 h-4 w-px bg-cu-border" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
        title="Bullet List (- )"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
        title="Numbered List (1. )"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
        title="Blockquote (> )"
      >
        <Quote className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btn(editor.isActive("codeBlock"))}
        title="Code Block (```)"
      >
        <SquareCode className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

export default DocEditor;
