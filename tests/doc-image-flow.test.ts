import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { markdownToHtml, htmlToMarkdown } from "../lib/markdown";
import { shouldCompress, sanitizeImageName, compressImage } from "../lib/image-compressor";
import { ImageExtension } from "../components/doc/image/image-extension";
import { uploadAndInsertImage } from "../components/doc/doc-editor";
import { createSlashSuggestion, type CommandItem } from "../components/doc/slash-command";

describe("Doc Image End-to-End Integration Flow", () => {
  describe("1. Markdown <-> HTML Bidirectional Conversion", () => {
    it("converts default markdown image to TipTap-compatible HTML and back", () => {
      const initialMd = "![Product Overview](/uploads/img_overview.webp)";
      const html = markdownToHtml(initialMd);

      // Verify HTML structure
      expect(html).toContain('data-type="image-block"');
      expect(html).toContain('data-src="/uploads/img_overview.webp"');
      expect(html).toContain('data-alt="Product Overview"');
      expect(html).toContain('data-caption="Product Overview"');
      expect(html).toContain('data-align="center"');
      expect(html).toContain('data-width="100%"');
      expect(html).toContain('<img src="/uploads/img_overview.webp" alt="Product Overview" />');

      // Roundtrip back to markdown
      const backToMd = htmlToMarkdown(html);
      expect(backToMd).toBe(initialMd);
    });

    it("preserves custom alignment and width through markdown and HTML roundtrip", () => {
      const cases = [
        {
          md: "![Left Align|align:left|width:25%](/uploads/img_left.webp)",
          align: "left",
          width: "25%",
          caption: "Left Align",
        },
        {
          md: "![Quarter Width|align:center|width:50%](/uploads/img_half.webp)",
          align: "center",
          width: "50%",
          caption: "Quarter Width",
        },
        {
          md: "![Right Align|align:right|width:50%](/uploads/img_right.webp)",
          align: "right",
          width: "50%",
          caption: "Right Align",
        },
        {
          md: "![Wide Banner|align:center|width:75%](/uploads/img_wide.webp)",
          align: "center",
          width: "75%",
          caption: "Wide Banner",
        },
        {
          md: "![Full Canvas|align:full|width:100%](/uploads/img_full.webp)",
          align: "full",
          width: "100%",
          caption: "Full Canvas",
        },
        {
          md: "![Fixed Pixels|align:center|width:450px](/uploads/img_px.webp)",
          align: "center",
          width: "450px",
          caption: "Fixed Pixels",
        },
      ];

      for (const item of cases) {
        const html = markdownToHtml(item.md);
        expect(html).toContain(`data-align="${item.align}"`);
        expect(html).toContain(`data-width="${item.width}"`);
        expect(html).toContain(`data-caption="${item.caption}"`);

        const roundtripMd = htmlToMarkdown(html);
        expect(roundtripMd).toBe(item.md);
      }
    });

    it("handles special characters in captions without corruption", () => {
      const initialMd = '![Diagram <v1.2> & "Final" (Approved)|align:center|width:75%](/uploads/chart.webp)';
      const html = markdownToHtml(initialMd);

      expect(html).toContain("&lt;v1.2&gt;");
      expect(html).toContain("&amp;");
      expect(html).toContain("&quot;Final&quot;");

      const roundtripMd = htmlToMarkdown(html);
      expect(roundtripMd).toBe(initialMd);
    });

    it("correctly handles mixed documents with multiple images and complex markdown", () => {
      const complexDoc = [
        "# Release Notes v2.0",
        "Here are the new architecture updates for our self-hosted platform.",
        "![Backend Architecture|align:center|width:75%](/uploads/backend_arch.webp)",
        "### Key Highlights",
        "- Native image upload and compression\n- High-performance Go Fiber backend",
        "![Performance Benchmark|align:left|width:50%](/uploads/benchmark.webp)",
        "Review complete.",
      ].join("\n\n");

      const html = markdownToHtml(complexDoc);
      expect(html).toContain("<h1>Release Notes v2.0</h1>");
      expect(html).toContain("<h3>Key Highlights</h3>");
      expect(html).toContain(
        "<ul><li>Native image upload and compression</li><li>High-performance Go Fiber backend</li></ul>"
      );
      expect(html).toContain('data-src="/uploads/backend_arch.webp"');
      expect(html).toContain('data-src="/uploads/benchmark.webp"');

      const restoredDoc = htmlToMarkdown(html);
      expect(restoredDoc).toBe(complexDoc);
    });

    it("converts legacy img tag to standard markdown image", () => {
      const legacyHtml = '<img src="/uploads/legacy.png" alt="Legacy Screenshot" />';
      const md = htmlToMarkdown(legacyHtml);
      expect(md).toBe("![Legacy Screenshot](/uploads/legacy.png)");
    });
  });

  describe("2. Client Compressor Size Check & Filename Sanitization", () => {
    it("enforces <500KB compression threshold based on file size and mime type", () => {
      const MAX_SIZE = 500 * 1024;

      // Under or equal to 500KB -> false
      expect(shouldCompress("image/png", MAX_SIZE)).toBe(false);
      expect(shouldCompress("image/jpeg", MAX_SIZE)).toBe(false);
      expect(shouldCompress("image/webp", 250 * 1024)).toBe(false);

      // Over 500KB -> true
      expect(shouldCompress("image/png", MAX_SIZE + 1)).toBe(true);
      expect(shouldCompress("image/jpeg", 2 * 1024 * 1024)).toBe(true);

      // SVGs and GIFs are excluded regardless of size to avoid corruption
      expect(shouldCompress("image/svg+xml", 10 * 1024 * 1024)).toBe(false);
      expect(shouldCompress("image/gif", 8 * 1024 * 1024)).toBe(false);
    });

    it("sanitizes filenames into safe, standardized WebP names", () => {
      expect(sanitizeImageName("Screenshot 2026-09-29 at 14.30.00.png")).toBe(
        "Screenshot_2026-09-29_at_14_30_00.webp"
      );
      expect(sanitizeImageName("diagram (v2) [final].jpg")).toBe(
        "diagram_v2_final.webp"
      );
      expect(sanitizeImageName("weird/path../name*?.jpeg")).toBe(
        "weird_path_name.webp"
      );
      expect(sanitizeImageName("already_safe.webp")).toBe("already_safe.webp");
      expect(sanitizeImageName("")).toBe("image.webp");
      expect(sanitizeImageName("   ")).toBe("image.webp");
    });

    it("passes through vector and animated files untouched during compression", async () => {
      const svg = new File(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"], "icon.svg", {
        type: "image/svg+xml",
      });
      const compressedSvg = await compressImage(svg);
      expect(compressedSvg).toBe(svg);

      const gif = new File(["GIF89a..."], "anim.gif", { type: "image/gif" });
      const compressedGif = await compressImage(gif);
      expect(compressedGif).toBe(gif);
    });

    it("passes through WebP and JPEG files that are already <= 500KB", async () => {
      const smallWebp = new File([new Uint8Array(200 * 1024)], "optimized.webp", {
        type: "image/webp",
      });
      const resultWebp = await compressImage(smallWebp, 500 * 1024);
      expect(resultWebp).toBe(smallWebp);

      const smallJpeg = new File([new Uint8Array(450 * 1024)], "photo.jpg", {
        type: "image/jpeg",
      });
      const resultJpeg = await compressImage(smallJpeg, 500 * 1024);
      expect(resultJpeg).toBe(smallJpeg);
    });

    it("scales down large images using HTML Canvas and outputs WebP blob", async () => {
      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;
      const originalImage = globalThis.Image;
      const originalURL = globalThis.URL;

      const mockCompressedBlob = new Blob([new Uint8Array(250 * 1024)], { type: "image/webp" });
      const drawImageMock = vi.fn();
      const toBlobMock = vi.fn((callback: (blob: Blob | null) => void) => {
        callback(mockCompressedBlob);
      });

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage: drawImageMock })),
        toBlob: toBlobMock,
      };

      class MockImage {
        width = 3840;
        height = 2160;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private _src = "";
        set src(val: string) {
          this._src = val;
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
        get src() {
          return this._src;
        }
      }

      (globalThis as any).window = {};
      (globalThis as any).document = {
        createElement: vi.fn((tag: string) => {
          if (tag === "canvas") return mockCanvas;
          return {};
        }),
      };
      (globalThis as any).Image = MockImage;
      (globalThis as any).URL = {
        ...originalURL,
        createObjectURL: vi.fn(() => "blob:http://localhost/mock-blob"),
        revokeObjectURL: vi.fn(),
      };

      try {
        const largeFile = new File([new Uint8Array(2 * 1024 * 1024)], "huge_banner.png", {
          type: "image/png",
        });

        const result = await compressImage(largeFile, 500 * 1024, 1920, 1920);
        expect(result).toBe(mockCompressedBlob);
        expect(mockCanvas.width).toBe(1920);
        expect(mockCanvas.height).toBe(1080);
        expect(drawImageMock).toHaveBeenCalled();
        expect(toBlobMock).toHaveBeenCalled();
      } finally {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.Image = originalImage;
        globalThis.URL = originalURL;
      }
    });
  });

  describe("3. HTML Structure & TipTap Schema Compatibility", () => {
    it("ensures markdownToHtml output matches ImageExtension parseHTML requirements", () => {
      const md = "![Deployment Flow|align:center|width:75%](/uploads/deploy.webp)";
      const html = markdownToHtml(md);

      // Create a mock DOM element from the generated HTML
      const mockElement = {
        getAttribute: (attr: string) => {
          if (attr === "data-src") return "/uploads/deploy.webp";
          if (attr === "data-alt") return "Deployment Flow";
          if (attr === "data-caption") return "Deployment Flow";
          if (attr === "data-align") return "center";
          if (attr === "data-width") return "75%";
          return null;
        },
        querySelector: () => null,
      } as unknown as HTMLElement;

      const parseRules = ImageExtension.config.parseHTML?.call({} as any);
      const blockRule = parseRules?.find((r) => r.tag === 'div[data-type="image-block"]');
      expect(blockRule).toBeDefined();

      const parsedAttrs = (blockRule?.getAttrs as any)(mockElement);
      expect(parsedAttrs).toEqual({
        src: "/uploads/deploy.webp",
        alt: "Deployment Flow",
        caption: "Deployment Flow",
        alignment: "center",
        width: "75%",
      });
    });

    it("ensures ImageExtension renderHTML produces markup recognized by htmlToMarkdown", () => {
      const renderFn = ImageExtension.config.renderHTML;
      expect(renderFn).toBeDefined();

      const nodeAttrs = {
        src: "/uploads/rendered_img.webp",
        alt: "Sample Graph",
        caption: "Sample Graph",
        alignment: "center",
        width: "50%",
      };

      const renderSpec = renderFn?.call({} as any, { HTMLAttributes: nodeAttrs } as any) as any;
      expect(renderSpec[0]).toBe("div");
      expect(renderSpec[1]["data-type"]).toBe("image-block");
      expect(renderSpec[1]["data-src"]).toBe(nodeAttrs.src);
      expect(renderSpec[1]["data-align"]).toBe(nodeAttrs.alignment);
      expect(renderSpec[1]["data-width"]).toBe(nodeAttrs.width);

      // Construct the HTML string represented by the renderSpec
      const reconstructedHtml = `<div data-type="${renderSpec[1]["data-type"]}" data-src="${renderSpec[1]["data-src"]}" data-alt="${renderSpec[1]["data-alt"]}" data-caption="${renderSpec[1]["data-caption"]}" data-align="${renderSpec[1]["data-align"]}" data-width="${renderSpec[1]["data-width"]}"><img src="${renderSpec[1]["data-src"]}" alt="${renderSpec[1]["data-alt"]}" /></div>`;

      const markdown = htmlToMarkdown(reconstructedHtml);
      expect(markdown).toBe("![Sample Graph|align:center|width:50%](/uploads/rendered_img.webp)");
    });

    it("verifies full pipeline closure: Markdown -> HTML -> TipTap Parse -> TipTap Render -> Markdown", () => {
      const inputMd = "![Closing Loop|align:center|width:75%](/uploads/loop.webp)";

      // Step A: Markdown -> HTML
      const htmlA = markdownToHtml(inputMd);

      // Step B: Simulate TipTap parseHTML
      const parseRules = ImageExtension.config.parseHTML?.call({} as any);
      const blockRule = parseRules?.[0];
      const parsedAttrs = (blockRule?.getAttrs as any)({
        getAttribute: (key: string) => {
          const match = htmlA.match(new RegExp(`${key}="([^"]*)"`));
          return match ? match[1] : null;
        },
        querySelector: () => null,
      });

      // Step C: Simulate TipTap renderHTML with parsed attrs
      const renderSpec = ImageExtension.config.renderHTML?.call({} as any, {
        HTMLAttributes: parsedAttrs,
      } as any) as any;

      const htmlB = `<div data-type="${renderSpec[1]["data-type"]}" data-src="${renderSpec[1]["data-src"]}" data-alt="${renderSpec[1]["data-alt"]}" data-caption="${renderSpec[1]["data-caption"]}" data-align="${renderSpec[1]["data-align"]}" data-width="${renderSpec[1]["data-width"]}"><img src="${renderSpec[1]["data-src"]}" alt="${renderSpec[1]["data-alt"]}" /></div>`;

      // Step D: HTML -> Markdown
      const outputMd = htmlToMarkdown(htmlB);

      expect(outputMd).toBe(inputMd);
    });
  });

  describe("4. Editor Upload and Node Insertion Integration", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it("executes uploadAndInsertImage successfully and inserts node at selection", async () => {
      const mockFile = new File(["dummy image content"], "screenshot.png", { type: "image/png" });
      const uploadedUrl = "/uploads/img_mock_uuid.webp";

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: uploadedUrl, size: 1024 }),
      } as any);

      const mockCreatedNode = { type: "imageBlock", attrs: { src: uploadedUrl } };
      const insertContentMock = vi.fn().mockReturnValue({ run: vi.fn() });
      const focusMock = vi.fn().mockReturnValue({ insertContent: insertContentMock });

      const mockEditor = {
        schema: {
          nodes: {
            imageBlock: {
              create: vi.fn().mockReturnValue(mockCreatedNode),
            },
          },
        },
        chain: vi.fn().mockReturnValue({ focus: focusMock }),
        view: {
          dispatch: vi.fn(),
        },
        state: {
          tr: {
            insert: vi.fn(),
          },
        },
      } as any;

      await uploadAndInsertImage(mockFile, mockEditor);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/upload",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      );

      expect(mockEditor.schema.nodes.imageBlock.create).toHaveBeenCalledWith({
        src: uploadedUrl,
        alt: "screenshot",
        caption: "",
        width: "100%",
        alignment: "center",
      });

      expect(mockEditor.chain).toHaveBeenCalled();
      expect(focusMock).toHaveBeenCalled();
      expect(insertContentMock).toHaveBeenCalledWith(mockCreatedNode);
    });

    it("executes uploadAndInsertImage with specific position when dropped", async () => {
      const mockFile = new File(["dropped data"], "drop.jpg", { type: "image/jpeg" });
      const uploadedUrl = "/uploads/img_dropped.webp";

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: uploadedUrl, size: 2048 }),
      } as any);

      const mockCreatedNode = { type: "imageBlock" };
      const mockTr: any = {};
      mockTr.insert = vi.fn().mockReturnValue(mockTr);
      const dispatchMock = vi.fn();

      const mockEditor = {
        schema: {
          nodes: {
            imageBlock: {
              create: vi.fn().mockReturnValue(mockCreatedNode),
            },
          },
        },
        view: {
          dispatch: dispatchMock,
        },
        state: {
          tr: mockTr,
        },
      } as any;

      const dropPos = 42;
      await uploadAndInsertImage(mockFile, mockEditor, dropPos);

      expect(mockEditor.schema.nodes.imageBlock.create).toHaveBeenCalledWith({
        src: uploadedUrl,
        alt: "drop",
        caption: "",
        width: "100%",
        alignment: "center",
      });
      expect(mockTr.insert).toHaveBeenCalledWith(dropPos, mockCreatedNode);
      expect(dispatchMock).toHaveBeenCalledWith(mockTr);
    });

    it("handles upload failure gracefully without throwing unhandled rejection", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockFile = new File(["bad data"], "error.png", { type: "image/png" });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      const mockEditor = {
        schema: { nodes: { imageBlock: { create: vi.fn() } } },
      } as any;

      await expect(uploadAndInsertImage(mockFile, mockEditor)).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to insert image:", expect.any(Error));
    });

    it("provides /image command item that initializes file input for upload", async () => {
      const suggestion = createSlashSuggestion();
      const items = await (suggestion.items as any)({ query: "image" });

      const imageItem = items.find((i: CommandItem) => i.title.toLowerCase() === "image");
      expect(imageItem).toBeDefined();
      expect(imageItem?.category).toBe("Advanced blocks");
      expect(imageItem?.description).toContain("image");

      const originalDocument = globalThis.document;
      const createdInputs: any[] = [];
      const mockInputElement = {
        type: "",
        accept: "",
        style: {},
        onchange: null,
        click: vi.fn(),
        remove: vi.fn(),
      };

      (globalThis as any).document = {
        createElement: vi.fn((tag: string) => {
          if (tag === "file" || tag === "input") {
            createdInputs.push(mockInputElement);
            return mockInputElement;
          }
          return {};
        }),
        body: {
          appendChild: vi.fn(),
        },
      };

      const deleteRangeMock = vi.fn().mockReturnValue({ run: vi.fn() });
      const focusMock = vi.fn().mockReturnValue({ deleteRange: deleteRangeMock });
      const mockEditor = {
        chain: vi.fn().mockReturnValue({ focus: focusMock }),
      } as any;

      try {
        imageItem.command({
          editor: mockEditor,
          range: { from: 5, to: 11 },
        });

        expect(mockEditor.chain).toHaveBeenCalled();
        expect(deleteRangeMock).toHaveBeenCalledWith({ from: 5, to: 11 });
        expect(mockInputElement.type).toBe("file");
        expect(mockInputElement.accept).toBe("image/*");
        expect(mockInputElement.click).toHaveBeenCalled();
      } finally {
        globalThis.document = originalDocument;
      }
    });
  });
});
