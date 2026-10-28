import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { shouldCompress, sanitizeImageName, compressImage } from "../lib/image-compressor";

describe("lib/image-compressor", () => {
  describe("shouldCompress", () => {
    it("determines if file needs compression based on size and type", () => {
      expect(shouldCompress("image/svg+xml", 100000)).toBe(false);
      expect(shouldCompress("image/png", 600 * 1024)).toBe(true);
      expect(shouldCompress("image/webp", 150 * 1024)).toBe(false);
    });

    it("does not compress SVG or GIF regardless of size", () => {
      expect(shouldCompress("image/svg+xml", 10 * 1024 * 1024)).toBe(false);
      expect(shouldCompress("image/gif", 5 * 1024 * 1024)).toBe(false);
    });

    it("respects 500KB threshold for PNG and JPEG", () => {
      expect(shouldCompress("image/png", 500 * 1024)).toBe(false);
      expect(shouldCompress("image/png", 500 * 1024 + 1)).toBe(true);
      expect(shouldCompress("image/jpeg", 500 * 1024)).toBe(false);
      expect(shouldCompress("image/jpeg", 500 * 1024 + 1)).toBe(true);
    });
  });

  describe("sanitizeImageName", () => {
    it("sanitizes image filenames", () => {
      expect(sanitizeImageName("My Screenshot (1).png")).toBe("My_Screenshot_1.webp");
      expect(sanitizeImageName("test file.jpg")).toBe("test_file.webp");
    });

    it("handles multiple special characters, dashes, and underscores", () => {
      expect(sanitizeImageName("diagram---final!!_v2.png")).toBe("diagram---final_v2.webp");
      expect(sanitizeImageName("photo@2x #1.jpeg")).toBe("photo_2x_1.webp");
    });

    it("falls back to 'image.webp' for empty or symbol-only names", () => {
      expect(sanitizeImageName("...png")).toBe("image.webp");
      expect(sanitizeImageName("###")).toBe("image.webp");
    });
  });

  describe("compressImage", () => {
    it("passes through SVG files directly without re-encoding", async () => {
      const svgFile = new File(["<svg></svg>"], "test.svg", { type: "image/svg+xml" });
      const result = await compressImage(svgFile);
      expect(result).toBe(svgFile);
    });

    it("passes through GIF files directly without re-encoding", async () => {
      const gifFile = new File(["GIF89a"], "anim.gif", { type: "image/gif" });
      const result = await compressImage(gifFile);
      expect(result).toBe(gifFile);
    });

    it("passes through WebP and JPEG files under maxSizeBytes directly", async () => {
      const smallWebpFile = new File(["small webp content"], "small.webp", { type: "image/webp" });
      const resultWebp = await compressImage(smallWebpFile, 500 * 1024);
      expect(resultWebp).toBe(smallWebpFile);

      const smallJpegFile = new File(["small jpeg content"], "small.jpg", { type: "image/jpeg" });
      const resultJpeg = await compressImage(smallJpegFile, 500 * 1024);
      expect(resultJpeg).toBe(smallJpegFile);
    });

    describe("canvas compression in browser environment", () => {
      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;
      const originalImage = globalThis.Image;
      const originalURL = globalThis.URL;

      let createObjectURLMock: ReturnType<typeof vi.fn>;
      let revokeObjectURLMock: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        createObjectURLMock = vi.fn(() => "blob:http://localhost/mock-blob-url");
        revokeObjectURLMock = vi.fn();

        // Setup mock DOM environment
        (globalThis as any).URL = {
          ...originalURL,
          createObjectURL: createObjectURLMock,
          revokeObjectURL: revokeObjectURLMock,
        };
      });

      afterEach(() => {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.Image = originalImage;
        globalThis.URL = originalURL;
      });

      it("compresses large PNG into WebP canvas blob", async () => {
        const mockBlob = new Blob(["mock-webp-data"], { type: "image/webp" });
        const drawImageMock = vi.fn();
        const toBlobMock = vi.fn((callback: (blob: Blob | null) => void, _type: string, _quality: number) => {
          callback(mockBlob);
        });

        class MockImage {
          width = 2400;
          height = 1600;
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

        const mockCanvas = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({
            drawImage: drawImageMock,
          })),
          toBlob: toBlobMock,
        };

        (globalThis as any).window = {};
        (globalThis as any).document = {
          createElement: vi.fn((tag: string) => {
            if (tag === "canvas") return mockCanvas;
            return {};
          }),
        };
        (globalThis as any).Image = MockImage;

        const largeFile = new File([new Uint8Array(600 * 1024)], "large.png", { type: "image/png" });
        const result = await compressImage(largeFile, 500 * 1024, 1920, 1920);

        expect(result).toBe(mockBlob);
        expect(createObjectURLMock).toHaveBeenCalledWith(largeFile);
        expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/mock-blob-url");
        // Canvas dimensions scaled to fit maxWidth=1920: 2400x1600 -> 1920x1280
        expect(mockCanvas.width).toBe(1920);
        expect(mockCanvas.height).toBe(1280);
        expect(drawImageMock).toHaveBeenCalled();
        expect(toBlobMock).toHaveBeenCalled();
      });

      it("falls back to original file if image decode fails", async () => {
        class FailingMockImage {
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          set src(_val: string) {
            setTimeout(() => {
              if (this.onerror) this.onerror();
            }, 0);
          }
        }

        (globalThis as any).window = {};
        (globalThis as any).document = { createElement: vi.fn() };
        (globalThis as any).Image = FailingMockImage;

        const corruptFile = new File([new Uint8Array(600 * 1024)], "corrupt.png", { type: "image/png" });
        const result = await compressImage(corruptFile);

        expect(result).toBe(corruptFile);
        expect(revokeObjectURLMock).toHaveBeenCalled();
      });
    });
  });
});
