import { describe, it, expect } from "vitest";
import { ImageExtension } from "../components/doc/image/image-extension";

describe("ImageExtension TipTap Node", () => {
  it("has correct node specifications", () => {
    expect(ImageExtension.name).toBe("imageBlock");
    expect(ImageExtension.config.group).toBe("block");
    expect(ImageExtension.config.atom).toBe(true);
    expect(ImageExtension.config.draggable).toBe(true);
    expect(ImageExtension.config.priority).toBe(1000);
  });

  it("configures default attributes properly", () => {
    const attrs = ImageExtension.config.addAttributes?.call({} as any);
    expect(attrs).toBeDefined();
    expect(attrs?.src?.default).toBe("");
    expect(attrs?.alt?.default).toBe("");
    expect(attrs?.caption?.default).toBe("");
    expect(attrs?.width?.default).toBe("100%");
    expect(attrs?.alignment?.default).toBe("center");
  });

  it("defines parseHTML for data-type=image-block", () => {
    const parseRules = ImageExtension.config.parseHTML?.call({} as any);
    expect(parseRules).toBeDefined();
    expect(parseRules?.length).toBe(2);

    const blockRule = parseRules?.[0];
    expect(blockRule?.tag).toBe('div[data-type="image-block"]');

    // Simulate HTMLElement
    const mockEl = {
      getAttribute: (attr: string) => {
        const map: Record<string, string> = {
          "data-src": "/uploads/test.png",
          "data-alt": "Test Image",
          "data-caption": "Test Caption",
          "data-width": "50%",
          "data-align": "left",
        };
        return map[attr] || null;
      },
      querySelector: () => null,
    } as unknown as HTMLElement;

    const parsedAttrs = (blockRule?.getAttrs as any)(mockEl);
    expect(parsedAttrs).toEqual({
      src: "/uploads/test.png",
      alt: "Test Image",
      caption: "Test Caption",
      width: "50%",
      alignment: "left",
    });
  });

  it("defines parseHTML fallback for legacy img tags", () => {
    const parseRules = ImageExtension.config.parseHTML?.call({} as any);
    const imgRule = parseRules?.[1];
    expect(imgRule?.tag).toBe("img[src]");

    const mockImgEl = {
      getAttribute: (attr: string) => {
        const map: Record<string, string> = {
          src: "/uploads/legacy.png",
          alt: "Legacy",
        };
        return map[attr] || null;
      },
    } as unknown as HTMLElement;

    const parsedAttrs = (imgRule?.getAttrs as any)(mockImgEl);
    expect(parsedAttrs).toEqual({
      src: "/uploads/legacy.png",
      alt: "Legacy",
      caption: "Legacy",
      width: "100%",
      alignment: "center",
    });
  });

  it("renders HTML matching expected schema structure", () => {
    const renderFn = ImageExtension.config.renderHTML;
    expect(renderFn).toBeDefined();

    const output = renderFn?.call({} as any, {
      HTMLAttributes: {
        src: "/img.webp",
        alt: "Preview",
        caption: "A diagram",
        alignment: "center",
        width: "75%",
      },
    } as any);

    expect(output).toEqual([
      "div",
      {
        "data-type": "image-block",
        "data-src": "/img.webp",
        "data-alt": "Preview",
        "data-caption": "A diagram",
        "data-align": "center",
        "data-width": "75%",
      },
      ["img", { src: "/img.webp", alt: "Preview" }],
    ]);
  });
});
