import { Node, ReactNodeViewRenderer } from "@tiptap/react";
import { MermaidBlock } from "./mermaid-block";

export const MermaidExtension = Node.create({
  name: "mermaidBlock",
  group: "block",
  atom: true,
  draggable: true,
  priority: 1000,

  addAttributes() {
    return {
      code: {
        default: `flowchart TD
    A([Start]) --> B[Process Step]
    B --> C{Decision}
    C -- Yes --> D[(Database)]
    C -- No --> E([Done])
    D --> E`,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid-block"]',
        getAttrs: (element) => {
          if (typeof element === "string") return {};
          const el = element as HTMLElement;
          const code =
            el.getAttribute("data-code") ||
            el.querySelector("code")?.textContent ||
            "";
          return { code };
        },
      },
      {
        tag: "pre",
        getAttrs: (element) => {
          if (typeof element === "string") return false;
          const el = element as HTMLElement;
          const codeEl = el.querySelector("code.language-mermaid");
          if (!codeEl) return false;
          return {
            code: codeEl.textContent || "",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {
        "data-type": "mermaid-block",
        "data-code": HTMLAttributes.code || "",
        class: "mermaid-diagram-container",
      },
      [
        "pre",
        { class: "language-mermaid" },
        ["code", { class: "language-mermaid" }, HTMLAttributes.code || ""],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlock);
  },
});
