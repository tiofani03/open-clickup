"use client";

import React, { useEffect, useState, useRef } from "react";
import type { Editor } from "@tiptap/react";
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
  Pilcrow,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface FloatingToolbarProps {
  editor: Editor;
}

export function FloatingToolbar({ editor }: FloatingToolbarProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      const { selection } = editor.state;
      if (selection.empty || !editor.isEditable) {
        setVisible(false);
        return;
      }

      // Check if text is selected
      const from = selection.from;
      const to = selection.to;
      if (from === to) {
        setVisible(false);
        return;
      }

      try {
        const view = editor.view;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);

        // Center horizontally above the selection
        const left = (start.left + end.right) / 2;
        const top = Math.min(start.top, end.top) - 10;

        setCoords({ top, left });
        setVisible(true);
      } catch {
        setVisible(false);
      }
    };

    editor.on("selectionUpdate", updatePosition);
    editor.on("blur", () => {
      // Delay hide slightly so clicks inside menu don't disappear before firing
      setTimeout(() => {
        if (!menuRef.current?.contains(document.activeElement)) {
          setVisible(false);
        }
      }, 150);
    });

    return () => {
      editor.off("selectionUpdate", updatePosition);
    };
  }, [editor]);

  if (!visible || !coords) return null;

  const btn = (active: boolean) =>
    cn(
      "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
      active
        ? "bg-cu-purple-light text-cu-purple-dark font-semibold dark:bg-cu-purple/20 dark:text-cu-purple"
        : "text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text"
    );

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        transform: "translate(-50%, -100%)",
      }}
      className="z-50 flex items-center gap-0.5 rounded-lg border border-cu-border bg-cu-panel/95 p-1 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
      onMouseDown={(e) => e.preventDefault()} // Keep editor focus
    >
      {/* Turn into Paragraph */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={btn(editor.isActive("paragraph") && !editor.isActive("heading"))}
        title="Text"
      >
        <Pilcrow className="h-3.5 w-3.5" />
      </button>

      {/* Heading 1 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btn(editor.isActive("heading", { level: 1 }))}
        title="Heading 1"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </button>

      {/* Heading 2 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
        title="Heading 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </button>

      {/* Heading 3 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
        title="Heading 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </button>

      <div className="mx-0.5 h-4 w-px bg-cu-border" />

      {/* Bold */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
        title="Bold (Cmd+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>

      {/* Italic */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
        title="Italic (Cmd+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>

      {/* Strikethrough */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike"))}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </button>

      {/* Inline Code */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={btn(editor.isActive("code"))}
        title="Inline code"
      >
        <Code className="h-3.5 w-3.5" />
      </button>

      <div className="mx-0.5 h-4 w-px bg-cu-border" />

      {/* Bullet List */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </button>

      {/* Numbered List */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </button>

      {/* Quote */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
        title="Quote"
      >
        <Quote className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
