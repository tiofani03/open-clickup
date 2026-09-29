"use client";

import { Extension, type Editor, type Range } from "@tiptap/react";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

export interface CommandItem {
  title: string;
  description: string;
  iconSvg: string;
  command: (params: { editor: Editor; range: Range }) => void;
}

const COMMAND_ITEMS: CommandItem[] = [
  {
    title: "Heading 1",
    description: "Big section heading",
    iconSvg: '<span style="font-size:12px;font-weight:700">H1</span>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    iconSvg: '<span style="font-size:12px;font-weight:700">H2</span>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    iconSvg: '<span style="font-size:12px;font-weight:700">H3</span>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Create a simple bulleted list",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Create a list with numbering",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    description: "Track tasks with a to-do checklist",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    command: ({ editor, range }) => {
      // If task list extension exists, toggle it; otherwise insert standard checklist markdown shortcut
      const cmd = editor.commands as Record<string, unknown>;
      if (typeof cmd.toggleTaskList === "function") {
        (editor.chain().focus().deleteRange(range) as any).toggleTaskList().run();
      } else {
        editor.chain().focus().deleteRange(range).insertContent("- [ ] ").run();
      }
    },
  },
  {
    title: "Code Block",
    description: "Capture a code snippet with formatting",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Blockquote",
    description: "Capture a quote or highlight note",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Divider",
    description: "Visually divide blocks with a horizontal line",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

/**
 * Creates suggestion configuration for the Slash (/) command menu.
 */
export function createSlashSuggestion(): Omit<SuggestionOptions<CommandItem>, "editor"> {
  return {
    char: "/",
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase().trim();
      if (!q) return COMMAND_ITEMS;
      return COMMAND_ITEMS.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
      );
    },
    render: () => {
      let popup: HTMLDivElement | null = null;
      let items: CommandItem[] = [];
      let selected = 0;
      let command: ((item: CommandItem) => void) | null = null;
      let rect: DOMRect | null = null;

      function paint() {
        if (!popup) return;
        popup.innerHTML = "";

        if (items.length === 0) {
          const empty = document.createElement("div");
          empty.className = "px-3 py-2 text-xs text-cu-text-tertiary";
          empty.textContent = "No matching commands";
          popup.appendChild(empty);
        } else {
          items.forEach((it, i) => {
            const b = document.createElement("button");
            b.type = "button";
            const isSelected = i === selected;
            b.className = `flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-cu-text transition-colors hover:bg-cu-hover ${
              isSelected ? "bg-cu-hover font-medium" : ""
            }`;

            b.innerHTML = `
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-cu-border bg-cu-bg text-cu-text-secondary">
                ${it.iconSvg}
              </span>
              <div class="flex flex-col min-w-0 flex-1">
                <span class="truncate font-medium text-cu-text text-[13px] leading-tight">${it.title}</span>
                <span class="truncate text-[11px] text-cu-text-tertiary leading-tight">${it.description}</span>
              </div>
            `;

            b.onmousedown = (e) => {
              e.preventDefault();
              command?.(it);
            };

            popup!.appendChild(b);

            if (isSelected) {
              b.scrollIntoView({ block: "nearest" });
            }
          });
        }

        if (rect) {
          const top = rect.bottom + 6;
          const left = rect.left;
          const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
          const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1000;

          if (top + 320 > viewportHeight) {
            popup.style.top = `${Math.max(10, rect.top - 325)}px`;
          } else {
            popup.style.top = `${top}px`;
          }
          popup.style.left = `${Math.max(10, Math.min(left, viewportWidth - 290))}px`;
        }
        popup.style.display = "block";
      }

      return {
        onStart: (props) => {
          items = props.items;
          command = props.command;
          selected = 0;
          rect = props.clientRect?.() ?? null;
          popup = document.createElement("div");
          popup.className =
            "cu-slash-popup fixed z-50 flex max-h-[320px] w-72 flex-col overflow-y-auto rounded-lg border border-cu-border bg-cu-panel p-1.5 shadow-xl text-[13px] text-cu-text";
          document.body.appendChild(popup);
          paint();
        },
        onUpdate: (props) => {
          items = props.items;
          command = props.command;
          selected = 0;
          rect = props.clientRect?.() ?? null;
          paint();
        },
        onKeyDown: (props) => {
          const n = items.length;
          if (props.event.key === "ArrowDown") {
            selected = n ? (selected + 1) % n : 0;
            paint();
            return true;
          }
          if (props.event.key === "ArrowUp") {
            selected = n ? (selected - 1 + n) % n : 0;
            paint();
            return true;
          }
          if (props.event.key === "Enter") {
            if (items[selected]) {
              command?.(items[selected]);
            }
            return true;
          }
          if (props.event.key === "Escape") {
            popup?.remove();
            popup = null;
            return true;
          }
          return false;
        },
        onExit: () => {
          popup?.remove();
          popup = null;
        },
      };
    },
  };
}

/**
 * TipTap Extension for Notion/ClickUp style Slash (/) command.
 */
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: createSlashSuggestion(),
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default SlashCommand;
