import { Node, ReactNodeViewRenderer } from "@tiptap/react";
import { ImageBlock } from "./image-block";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageBlock: {
      setImageBlock: (attributes: {
        src: string;
        alt?: string;
        caption?: string;
        width?: string;
        alignment?: string;
      }) => ReturnType;
    };
  }
}

export const ImageExtension = Node.create({
  name: "imageBlock",
  group: "block",
  atom: true,
  draggable: true,
  priority: 1000,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      width: { default: "100%" },
      alignment: { default: "center" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="image-block"]',
        getAttrs: (element) => {
          if (typeof element === "string") return {};
          const el = element as HTMLElement;
          return {
            src:
              el.getAttribute("data-src") ||
              el.querySelector("img")?.getAttribute("src") ||
              "",
            alt:
              el.getAttribute("data-alt") ||
              el.querySelector("img")?.getAttribute("alt") ||
              "",
            caption: el.getAttribute("data-caption") || "",
            width: el.getAttribute("data-width") || "100%",
            alignment: el.getAttribute("data-align") || "center",
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs: (element) => {
          if (typeof element === "string") return false;
          const el = element as HTMLElement;
          return {
            src: el.getAttribute("src") || "",
            alt: el.getAttribute("alt") || "",
            caption: el.getAttribute("alt") || "",
            width: "100%",
            alignment: "center",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {
        "data-type": "image-block",
        "data-src": HTMLAttributes.src || "",
        "data-alt": HTMLAttributes.alt || "",
        "data-caption": HTMLAttributes.caption || "",
        "data-align": HTMLAttributes.alignment || "center",
        "data-width": HTMLAttributes.width || "100%",
      },
      ["img", { src: HTMLAttributes.src || "", alt: HTMLAttributes.alt || "" }],
    ];
  },

  addCommands() {
    return {
      setImageBlock:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlock);
  },
});
