"use client";

import { Extension, type Editor, type Range } from "@tiptap/react";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { uploadAndInsertImage } from "./doc-editor";

export interface CommandItem {
  title: string;
  description: string;
  category: "Basic blocks" | "Advanced blocks";
  iconSvg: string;
  command: (params: { editor: Editor; range: Range }) => void;
}

const COMMAND_ITEMS: CommandItem[] = [
  {
    title: "Text",
    description: "Just start writing with plain text",
    category: "Basic blocks",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: "Heading 1",
    description: "Big section heading",
    category: "Basic blocks",
    iconSvg: '<span style="font-size:12px;font-weight:700">H1</span>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    category: "Basic blocks",
    iconSvg: '<span style="font-size:12px;font-weight:700">H2</span>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    category: "Basic blocks",
    iconSvg: '<span style="font-size:12px;font-weight:700">H3</span>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Create a simple bulleted list",
    category: "Basic blocks",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Create a list with numbering",
    category: "Basic blocks",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "To-do List",
    description: "Track tasks with a checklist",
    category: "Basic blocks",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent("- [ ] ").run();
    },
  },
  {
    title: "Callout",
    description: "Make writing stand out with a highlight box",
    category: "Advanced blocks",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent("> 💡 **Note:** ").run();
    },
  },
  {
    title: "Code Block",
    description: "Capture a code snippet with formatting",
    category: "Advanced blocks",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Mermaid Diagram",
    description: "Flowcharts, sequence diagrams & architecture with drag-n-drop builder",
    category: "Advanced blocks",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M6 9v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9"/><path d="M12 13v2"/></svg>',
    command: ({ editor, range }) => {
      const defaultDiagram = `flowchart TD
    A([Start]) --> B[Process Step]
    B --> C{Decision}
    C -- Yes --> D[(Database)]
    C -- No --> E([Done])
    D --> E`;
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "mermaidBlock",
          attrs: { code: defaultDiagram },
        })
        .run();
    },
  },
  {
    title: "Quote",
    description: "Capture a quote or highlight note",
    category: "Advanced blocks",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Divider",
    description: "Visually divide blocks with a horizontal line",
    category: "Advanced blocks",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Image",
    description: "Upload and insert an image",
    category: "Advanced blocks",
    iconSvg:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      if (typeof document === "undefined") return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          uploadAndInsertImage(file, editor);
        }
        input.remove();
      };
      input.click();
    },
  },
];

/**
 * Creates suggestion configuration for the Slash (/) command menu.
 */
export function createSlashSuggestion(): Omit<SuggestionOptions<CommandItem>, "editor"> {
  return {
    char: "/",
    command: ({ editor, range, props }) => {
      props.command({ editor, range });
    },
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase().trim();
      if (!q) return COMMAND_ITEMS;
      return COMMAND_ITEMS.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
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
          empty.className = "px-3 py-3 text-xs text-cu-text-tertiary text-center";
          empty.textContent = "No matching blocks";
          popup.appendChild(empty);
          return;
        }

        let lastCategory = "";

        items.forEach((it, i) => {
          if (it.category !== lastCategory) {
            lastCategory = it.category;
            const catHeader = document.createElement("div");
            catHeader.className =
              "px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-cu-text-tertiary";
            catHeader.textContent = it.category;
            popup!.appendChild(catHeader);
          }

          const b = document.createElement("button");
          b.type = "button";
          const isSelected = i === selected;
          b.className = `flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-cu-text transition-colors hover:bg-cu-hover ${
            isSelected ? "bg-cu-hover font-medium ring-1 ring-cu-border" : ""
          }`;

          b.innerHTML = `
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-cu-border bg-cu-bg text-cu-text-secondary shadow-xs">
              ${it.iconSvg}
            </span>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="truncate font-medium text-cu-text text-[13px] leading-snug">${it.title}</span>
              <span class="truncate text-[11px] text-cu-text-tertiary leading-snug">${it.description}</span>
            </div>
          `;

          b.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (command) {
              const selectedItem = it;
              if (popup) {
                popup.remove();
                popup = null;
              }
              command(selectedItem);
            }
          };

          if (isSelected) {
            setTimeout(() => {
              b.scrollIntoView({ block: "nearest" });
            }, 0);
          }

          popup!.appendChild(b);
        });
      }

      function updatePosition(clientRect?: DOMRect | null) {
        if (!popup) return;
        const target = clientRect || rect;
        if (!target) return;

        const spaceBelow = window.innerHeight - target.bottom;
        const popupHeight = 320;
        const fitsBelow = spaceBelow >= popupHeight || spaceBelow >= 200;

        let top = fitsBelow ? target.bottom + 6 : target.top - popupHeight - 6;
        let left = target.left;

        // Prevent overflow horizontally
        const popupWidth = 300;
        if (left + popupWidth > window.innerWidth - 16) {
          left = window.innerWidth - popupWidth - 16;
        }
        if (left < 16) left = 16;

        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
      }

      return {
        onStart: (props) => {
          items = props.items;
          selected = 0;
          command = props.command;
          rect = props.clientRect?.() ?? null;

          if (popup) {
            popup.remove();
          }

          popup = document.createElement("div");
          popup.className =
            "fixed z-50 max-h-[340px] w-[300px] overflow-y-auto rounded-xl border border-cu-border bg-cu-panel/95 p-1.5 shadow-2xl backdrop-blur-md outline-none animate-in fade-in zoom-in-95 duration-100";

          paint();
          document.body.appendChild(popup);
          updatePosition(rect);
        },

        onUpdate: (props) => {
          items = props.items;
          selected = Math.min(selected, Math.max(0, items.length - 1));
          command = props.command;
          rect = props.clientRect?.() ?? null;
          paint();
          updatePosition(rect);
        },

        onKeyDown: (props) => {
          if (props.event.key === "ArrowDown") {
            if (items.length > 0) {
              selected = (selected + 1) % items.length;
              paint();
            }
            return true;
          }

          if (props.event.key === "ArrowUp") {
            if (items.length > 0) {
              selected = (selected - 1 + items.length) % items.length;
              paint();
            }
            return true;
          }

          if (props.event.key === "Enter" || props.event.key === "Tab") {
            if (items.length > 0 && items[selected] && command) {
              props.event.preventDefault();
              props.event.stopPropagation();
              const selectedItem = items[selected];
              if (popup) {
                popup.remove();
                popup = null;
              }
              command(selectedItem);
              return true;
            }
          }

          if (props.event.key === "Escape") {
            if (popup) {
              popup.remove();
              popup = null;
            }
            return true;
          }

          return false;
        },

        onExit: () => {
          if (popup) {
            popup.remove();
            popup = null;
          }
        },
      };
    },
  };
}

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
