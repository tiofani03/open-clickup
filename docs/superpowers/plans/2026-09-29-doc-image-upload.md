# Document Image Insertion, Compression, & Rich Image Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to insert images into documents via clipboard paste, drag-and-drop, or slash command, with automatic client-side compression to under 500KB, local Go server storage, and rich image block controls (resize, alignment, captions, and full preview lightbox).

**Architecture:** 
Go Fiber provides `POST /api/upload` storing images in `./data/uploads/` and serving them at `/uploads/*`. Client-side Canvas utility compresses images to WebP/JPEG under 500KB before upload. TipTap custom NodeView `ImageBlock` provides interactive resize and alignment in edit mode and click-to-lightbox in read-only mode.

**Tech Stack:** Go (Fiber v2), React 19, TipTap v3, Radix UI Dialog, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-doc-image-upload-design.md`

## Global Constraints
- Images uploaded must be compressed client-side to <= 500KB before transmission.
- Server upload directory must be `./data/uploads/` and served at `/uploads/*`.
- File names must be random UUIDs/nanoids to prevent collisions and directory traversal.
- TipTap image block must respect `--cu-*` design tokens and Radix dialogs.
- In read-only mode (`isEditable === false`), images must be static (no resize handles/toolbars) with click-to-expand lightbox preview.

---

### Task 1: Backend Upload API & Static File Serving

**Files:**
- Create: `server-go/internal/handlers/upload.go`
- Modify: `server-go/cmd/server/main.go`
- Test: `server-go/internal/handlers/upload_test.go`

**Interfaces:**
- Consumes: Fiber `*fiber.App`, `auth.RequireUser`
- Produces: `POST /api/upload` returning `{ "url": "/uploads/<filename>", "size": int64 }`, static route `GET /uploads/*`

- [ ] **Step 1: Write backend upload handler test**
```go
package handlers_test

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tiofani03/open-clickup/internal/handlers"
)

func TestUploadImage(t *testing.T) {
	uploadDir := "./data/test_uploads"
	defer os.RemoveAll(uploadDir)

	h := handlers.NewUploadHandler(uploadDir)
	app := fiber.New()
	app.Post("/api/upload", h.Upload)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "sample.png")
	require.NoError(t, err)
	_, err = io.Copy(part, bytes.NewReader([]byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")))
	require.NoError(t, err)
	writer.Close()

	req := httptest.NewRequest("POST", "/api/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd server-go && PATH=$PATH:/home/gli-it/go/bin go test -v ./internal/handlers/ -run TestUploadImage`
Expected: FAIL

- [ ] **Step 3: Implement UploadHandler and mount routes**
In `server-go/internal/handlers/upload.go`:
```go
package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type UploadHandler struct {
	uploadDir string
}

func NewUploadHandler(uploadDir string) *UploadHandler {
	_ = os.MkdirAll(uploadDir, 0755)
	return &UploadHandler{uploadDir: uploadDir}
}

type UploadResponse struct {
	URL  string `json:"url"`
	Size int64  `json:"size"`
}

func (h *UploadHandler) Upload(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing file in form"})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowed := map[string]bool{
		".png":  true,
		".jpg":  true,
		".jpeg": true,
		".webp": true,
		".gif":  true,
		".svg":  true,
	}
	if !allowed[ext] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unsupported file format"})
	}

	newFilename := fmt.Sprintf("img_%s%s", uuid.New().String(), ext)
	dst := filepath.Join(h.uploadDir, newFilename)

	if err := c.SaveFile(file, dst); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save file"})
	}

	return c.JSON(UploadResponse{
		URL:  fmt.Sprintf("/uploads/%s", newFilename),
		Size: file.Size,
	})
}
```

In `server-go/cmd/server/main.go`:
Mount upload route and static serving:
```go
uploadDir := "./data/uploads"
_ = os.MkdirAll(uploadDir, 0755)
uploadH := handlers.NewUploadHandler(uploadDir)
api.Post("/upload", auth.RequireUser(q), uploadH.Upload)
app.Static("/uploads", uploadDir)
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd server-go && PATH=$PATH:/home/gli-it/go/bin go test -v ./internal/handlers/ -run TestUploadImage`
Expected: PASS

- [ ] **Step 5: Commit backend upload changes**
```bash
git add server-go/internal/handlers/upload.go server-go/internal/handlers/upload_test.go server-go/cmd/server/main.go
git commit -m "feat(server): implement image upload endpoint and static uploads serving"
```

---

### Task 2: Client-Side Image Compression (< 500KB)

**Files:**
- Create: `lib/image-compressor.ts`
- Create: `tests/image-compressor.test.ts`

**Interfaces:**
- Produces: `compressImage(file: File, maxSizeBytes?: number): Promise<Blob>`

- [ ] **Step 1: Write compression utility test**
In `tests/image-compressor.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { shouldCompress, sanitizeImageName } from "../lib/image-compressor";

describe("lib/image-compressor", () => {
  it("determines if file needs compression based on size and type", () => {
    expect(shouldCompress("image/svg+xml", 100000)).toBe(false);
    expect(shouldCompress("image/png", 600 * 1024)).toBe(true);
    expect(shouldCompress("image/webp", 150 * 1024)).toBe(false);
  });

  it("sanitizes image filenames", () => {
    expect(sanitizeImageName("My Screenshot (1).png")).toBe("My_Screenshot_1.webp");
    expect(sanitizeImageName("test file.jpg")).toBe("test_file.webp");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run tests/image-compressor.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement image compression utility**
In `lib/image-compressor.ts`:
```ts
export function shouldCompress(mimeType: string, sizeBytes: number): boolean {
  if (mimeType === "image/svg+xml" || mimeType === "image/gif") return false;
  return sizeBytes > 500 * 1024;
}

export function sanitizeImageName(filename: string): string {
  const base = filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${base}.webp`;
}

export async function compressImage(
  file: File,
  maxSizeBytes: number = 500 * 1024,
  maxWidth: number = 1920,
  maxHeight: number = 1920
): Promise<Blob> {
  // Pass-through SVGs or GIFs to preserve animation/vectors
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  // If already under max size and is WebP or JPEG, don't re-compress
  if (file.size <= maxSizeBytes && (file.type === "image/webp" || file.type === "image/jpeg")) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Iteratively step down quality to satisfy maxSizeBytes
      const qualities = [0.85, 0.70, 0.55, 0.40];
      let qualityIndex = 0;

      function tryCompress() {
        const quality = qualities[qualityIndex] ?? 0.4;
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            if (blob.size <= maxSizeBytes || qualityIndex >= qualities.length - 1) {
              resolve(blob);
            } else {
              qualityIndex++;
              tryCompress();
            }
          },
          "image/webp",
          quality
        );
      }

      tryCompress();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback to original file if decode fails
    };

    img.src = url;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run tests/image-compressor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit compression utility**
```bash
git add lib/image-compressor.ts tests/image-compressor.test.ts
git commit -m "feat(client): implement client-side image compression utility"
```

---

### Task 3: Markdown Image Parser & Bidirectional Roundtrip

**Files:**
- Modify: `lib/markdown.ts`
- Create: `tests/image-markdown.test.ts`

**Interfaces:**
- Consumes: `markdownToHtml`, `htmlToMarkdown`
- Produces: parsing of `![caption|align:center|width:75%](url)` to `<div data-type="image-block" ...>` and back.

- [ ] **Step 1: Write markdown image parser tests**
In `tests/image-markdown.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { markdownToHtml, htmlToMarkdown } from "../lib/markdown";

describe("Markdown Image Parser", () => {
  it("converts standard markdown images to image-block html", () => {
    const md = "![App Screenshot](/uploads/img_123.webp)";
    const html = markdownToHtml(md);
    expect(html).toContain('data-type="image-block"');
    expect(html).toContain('data-src="/uploads/img_123.webp"');
    expect(html).toContain('data-alt="App Screenshot"');
  });

  it("converts rich markdown images with alignment and width", () => {
    const md = "![Architecture Diagram|align:center|width:75%](/uploads/img_arch.webp)";
    const html = markdownToHtml(md);
    expect(html).toContain('data-align="center"');
    expect(html).toContain('data-width="75%"');
    expect(html).toContain('data-caption="Architecture Diagram"');
  });

  it("roundtrips image block HTML back to markdown", () => {
    const initialMd = "![System Design|align:center|width:50%](/uploads/img_999.webp)";
    const html = markdownToHtml(initialMd);
    const backToMd = htmlToMarkdown(html);
    expect(backToMd).toBe(initialMd);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run tests/image-markdown.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `lib/markdown.ts`**
Add image block conversion in `markdownToHtml` and `htmlToMarkdown`:
```ts
// In markdownToHtml:
// Match ![alt|align:center|width:50%](url) or ![alt](url)
const imgMatch = rawLine.match(/^!\[(.*?)\]\(([^)]+)\)$/);
if (imgMatch) {
  flushAll();
  const rawMeta = imgMatch[1];
  const url = imgMatch[2];
  let caption = rawMeta;
  let align = "center";
  let width = "100%";

  if (rawMeta.includes("|")) {
    const parts = rawMeta.split("|");
    caption = parts[0];
    for (let p = 1; p < parts.length; p++) {
      const part = parts[p].trim();
      if (part.startsWith("align:")) align = part.replace("align:", "").trim();
      if (part.startsWith("width:")) width = part.replace("width:", "").trim();
    }
  }

  htmlParts.push(
    `<div data-type="image-block" data-src="${escapeHtml(url)}" data-alt="${escapeHtml(caption)}" data-caption="${escapeHtml(caption)}" data-align="${escapeHtml(align)}" data-width="${escapeHtml(width)}"><img src="${escapeHtml(url)}" alt="${escapeHtml(caption)}" /></div>`
  );
  continue;
}

// In htmlToMarkdown:
result = result.replace(
  /<div[^>]*data-type="image-block"[^>]*data-src="([^"]*)"(?:[^>]*data-caption="([^"]*)")?(?:[^>]*data-align="([^"]*)")?(?:[^>]*data-width="([^"]*)")?[\s\S]*?<\/div>/gi,
  (_, src, caption, align, width) => {
    const cap = unescapeHtml(caption || "");
    const al = align || "center";
    const w = width || "100%";
    const meta = (al !== "center" || (w !== "100%" && w !== "")) ? `${cap}|align:${al}|width:${w}` : cap;
    return `\n\n![${meta}](${src})\n\n`;
  }
);
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run tests/image-markdown.test.ts`
Expected: PASS

- [ ] **Step 5: Commit markdown image changes**
```bash
git add lib/markdown.ts tests/image-markdown.test.ts
git commit -m "feat(markdown): support rich image block syntax and bidirectional conversion"
```

---

### Task 4: Rich TipTap Image Extension & Lightbox NodeView

**Files:**
- Create: `components/doc/image/image-block.tsx`
- Create: `components/doc/image/image-extension.ts`
- Modify: `components/doc/doc-editor.tsx`

**Interfaces:**
- Produces: `ImageExtension` node, `ImageBlock` view with edit resize/alignment controls and read-only lightbox modal.

- [ ] **Step 1: Create `components/doc/image/image-block.tsx`**
Implement `ImageBlock` with:
- Edit Mode:
  - Width buttons (`25%`, `50%`, `75%`, `100%`) and drag handle.
  - Alignment buttons (Left, Center, Full-width).
  - Caption textarea below image with immediate update.
  - Delete button.
- Read-Only Mode (`isEditable === false`):
  - Clean static image at configured width and alignment.
  - Caption displayed beneath image.
  - Hover shows `[⛶ Full preview]` badge.
  - Click opens Radix `Dialog` lightbox modal with pan & zoom and Close (`Esc`).

- [ ] **Step 2: Create `components/doc/image/image-extension.ts`**
Define `ImageExtension` TipTap node:
```ts
import { Node, ReactNodeViewRenderer } from "@tiptap/react";
import { ImageBlock } from "./image-block";

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
            src: el.getAttribute("data-src") || el.querySelector("img")?.getAttribute("src") || "",
            alt: el.getAttribute("data-alt") || el.querySelector("img")?.getAttribute("alt") || "",
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

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlock);
  },
});
```

- [ ] **Step 3: Register `ImageExtension` in `doc-editor.tsx`**
In `components/doc/doc-editor.tsx`, import `ImageExtension` and add to editor `extensions`.

- [ ] **Step 4: Run typecheck and tests**
Run: `pnpm test && pnpm build`
Expected: PASS

- [ ] **Step 5: Commit Image extension**
```bash
git add components/doc/image/ components/doc/doc-editor.tsx
git commit -m "feat(docs): create rich image extension with resize alignment and lightbox preview"
```

---

### Task 5: Paste, Drag-and-Drop, & Slash Command Handlers

**Files:**
- Modify: `components/doc/doc-editor.tsx`
- Modify: `components/doc/slash-command.tsx`

**Interfaces:**
- Consumes: `compressImage` from `lib/image-compressor.ts`, `POST /api/upload`
- Produces: Clipboard paste image insertion, drag-and-drop file upload, `/image` slash command.

- [ ] **Step 1: Implement `uploadAndInsertImage` helper**
In `components/doc/doc-editor.tsx`:
```ts
async function uploadAndInsertImage(file: File, editor: Editor, pos?: number) {
  try {
    const compressed = await compressImage(file);
    const form = new FormData();
    form.append("file", compressed, file.name || "image.webp");

    const res = await fetch("/api/upload", {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();

    const node = editor.schema.nodes.imageBlock.create({
      src: data.url,
      alt: file.name.replace(/\.[^/.]+$/, "") || "Image",
      caption: "",
      width: "100%",
      alignment: "center",
    });

    if (pos !== undefined) {
      editor.view.dispatch(editor.state.tr.insert(pos, node));
    } else {
      editor.chain().focus().insertContent(node).run();
    }
  } catch (err) {
    console.error("Failed to insert image:", err);
  }
}
```

- [ ] **Step 2: Add `handlePaste` and `handleDrop` to `editorProps`**
In `components/doc/doc-editor.tsx`:
```ts
editorProps: {
  handlePaste: (view, event) => {
    const items = event.clipboardData?.items;
    if (!items) return false;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) uploadAndInsertImage(file, editor);
        return true;
      }
    }
    return false;
  },
  handleDrop: (view, event, slice, moved) => {
    if (moved) return false;
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return false;
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        uploadAndInsertImage(file, editor, coords?.pos);
        return true;
      }
    }
    return false;
  },
}
```

- [ ] **Step 3: Add `/image` slash command**
In `components/doc/slash-command.tsx`, add `/image` entry that opens hidden file picker `<input type="file" accept="image/*" />`.

- [ ] **Step 4: Run tests and verify build**
Run: `pnpm test && pnpm build`
Expected: PASS

- [ ] **Step 5: Commit paste and drop handlers**
```bash
git add components/doc/doc-editor.tsx components/doc/slash-command.tsx
git commit -m "feat(docs): enable image clipboard paste, drag-and-drop, and slash command"
```

---

### Task 6: End-to-End Verification & Documentation

**Files:**
- Test: `tests/doc-image-flow.test.ts`
- Modify: `README.md` (if needed)

- [ ] **Step 1: Write integration test for image doc flow**
In `tests/doc-image-flow.test.ts`:
Verify markdownToHtml, htmlToMarkdown, compressor logic, and image node attributes.

- [ ] **Step 2: Run all test suites**
Run: `pnpm test`
Expected: All test suites PASS (100% green).

- [ ] **Step 3: Run backend Go tests**
Run: `cd server-go && PATH=$PATH:/home/gli-it/go/bin go test ./...`
Expected: All Go tests PASS.

- [ ] **Step 4: Verify production build**
Run: `pnpm build`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit completed feature**
```bash
git add tests/doc-image-flow.test.ts
git commit -m "test(docs): add comprehensive automated tests for doc image insertion and compression"
```
