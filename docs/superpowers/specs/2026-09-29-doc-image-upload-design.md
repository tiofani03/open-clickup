# Design Specification: Document Image Insertion, Compression, & Rich Image Block

## Overview
This specification details the end-to-end architecture and implementation for image handling in Open ClickUp documents. Users can insert images via clipboard paste (`Ctrl+V` / `Cmd+V`), drag-and-drop from the operating system, or `/image` slash command. Images are automatically compressed client-side to be under 500KB before being uploaded to the Go backend (`/api/upload`) and saved to local disk storage (`./data/uploads/`). The document editor features a Notion-style rich image block with resize handles, alignment controls, captions, and a click-to-expand lightbox preview in read-only mode.

---

## 1. Storage & Backend Upload Architecture

### 1.1 Endpoint: `POST /api/upload`
- **Authentication**: Requires authenticated session (`auth.RequireUser(q)`).
- **Request Type**: `multipart/form-data` with form field name `file`.
- **Validation**:
  - Max file size: 15MB before compression (client compresses before sending, but server enforces an upper guard of 10MB).
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`.
- **Storage Strategy**:
  - Saved to local directory `./data/uploads/` on the server host.
  - Automatically creates the `./data/uploads/` directory on server startup if it doesn't exist.
  - Generates secure unique filenames using UUID or random nanoid + sanitized extension (e.g., `img_d9a8f27b-e9b4-4b52-9471-897b2f0a1d4a.webp`).
- **Response**:
  ```json
  {
    "url": "/uploads/img_d9a8f27b-e9b4-4b52-9471-897b2f0a1d4a.webp",
    "size": 184200,
    "mimeType": "image/webp"
  }
  ```

### 1.2 Static File Serving: `GET /uploads/*`
- Go Fiber mounts static file serving:
  ```go
  app.Static("/uploads", "./data/uploads", fiber.Static{
      Compress: true,
      ByteRange: true,
      MaxAge: 86400 * 30, // 30 days client cache
  })
  ```

---

## 2. Client-Side Smart Compression (< 500KB)

### 2.1 Compression Utility (`lib/image-compressor.ts`)
- Function: `compressImage(file: File, maxSizeBytes = 500 * 1024): Promise<Blob>`
- Behavior:
  - If the original file is already SVG or under 200KB, it may be uploaded directly without lossy conversion.
  - Reads image into an `Image` object via `URL.createObjectURL(file)`.
  - Determines dimensions: if `width > 1920` or `height > 1920`, scales proportionally down to fit inside a 1920x1920 box.
  - Draws onto `HTMLCanvasElement`.
  - Iteratively exports to `image/webp` (fallback to `image/jpeg` if WebP is unsupported):
    - Starts at quality `0.85`.
    - If resulting blob size > 500KB, reduces quality to `0.70`, then `0.55`, then `0.40`.
    - Returns the optimized `Blob` (guaranteed <= 500KB, typically 80KB–250KB with high visual fidelity).

---

## 3. TipTap Editor Integration

### 3.1 Custom Image Extension (`components/doc/image/image-extension.ts`)
- TipTap Node: `imageBlock`
  - Group: `block`
  - Draggable: `true`
  - Priority: `1000`
  - Attributes:
    - `src`: Image URL (e.g. `/uploads/...` or external https)
    - `alt`: Alt text
    - `caption`: Optional text description
    - `width`: Percentage (`25%`, `50%`, `75%`, `100%`) or numeric px
    - `alignment`: `'left' | 'center' | 'full'` (default `'center'`)
  - NodeView: `ImageBlockView` (`components/doc/image/image-block.tsx`)

### 3.2 Rich NodeView Component (`components/doc/image/image-block.tsx`)
- **Edit Mode (`isEditable === true`)**:
  - Image wrapped in a container aligned according to `node.attrs.alignment`.
  - Resize handles on left & right sides allowing user to drag or click quick width presets (25%, 50%, 75%, 100%).
  - Top floating/hover bar:
    - Align Left, Align Center, Align Full-width buttons.
    - Fullscreen preview button.
    - Delete image button.
  - Caption input beneath the image (`placeholder="Write a caption..."`) with auto-save to `node.attrs.caption`.
- **Read-Only / Preview Mode (`isEditable === false`)**:
  - Clean image displayed with the specified width and alignment.
  - Non-draggable, no resize handles, no toolbar.
  - Caption displayed as subtle muted text beneath the image.
  - Hover cursor changes to pointer with a subtle `[⛶ Full preview]` badge.
  - **Click to open Lightbox Modal**:
    - Dialog modal displaying the full-resolution image.
    - Pan & zoom controls (+ / - / 1:1), copy image URL, and close (Esc / ✕).

### 3.3 Clipboard Paste & Drag-and-Drop Handlers
- Registered in `DocEditor` (`components/doc/doc-editor.tsx`):
  - `handlePaste(view, event)`:
    - Scans `event.clipboardData.items` for image files (`item.type.startsWith('image/')`).
    - If found:
      1. Prevents default paste.
      2. Inserts temporary loading placeholder node or status indicator at cursor.
      3. Compresses image using `compressImage`.
      4. Uploads to `POST /api/upload`.
      5. Replaces placeholder with `imageBlock` node containing returned URL.
  - `handleDrop(view, event)`:
    - Scans `event.dataTransfer.files` for image files.
    - If found:
      1. Prevents default drop.
      2. Determines ProseMirror position from coordinates (`view.posAtCoords`).
      3. Compresses and uploads file.
      4. Inserts `imageBlock` node at drop coordinate.
- **Slash Command**:
  - Adds `/image` command to `components/doc/slash-command.tsx`.
  - Triggers hidden `<input type="file" accept="image/*" />` to allow browsing files from disk.

---

## 4. Markdown Serialization & Deserialization

### 4.1 Markdown Format
- Standard Markdown: `![alt](url)`
- Extended Markdown for alignment & width:
  `![caption|align:center|width:75%](/uploads/uuid.webp)`
- Fallback HTML representation during parsing:
  `<div data-type="image-block" data-src="..." data-align="..." data-width="..." data-caption="...">...</div>`

### 4.2 Converter Functions in `lib/markdown.ts`
- **`markdownToHtml`**:
  - Matches `!\[(.*?)\]\(([^)]+)\)`
  - Extracts url and optional metadata (`caption`, `align`, `width`).
  - Converts into TipTap-compatible `<div data-type="image-block" ...>` tag.
- **`htmlToMarkdown`**:
  - Extracts `div[data-type="image-block"]` and `<img ...>` elements.
  - Serializes back into clean Markdown `![caption|align:center|width:75%](url)`.

---

## 5. Security & Verification Strategy
1. **MIME & Header Verification**:
   - Backend checks both the file extension and HTTP content-type header, rejecting executable or script files.
2. **Directory Traversal Prevention**:
   - Uses `filepath.Base` and UUID filename generation to guarantee files remain strictly inside `./data/uploads/`.
3. **Automated Tests**:
   - `tests/image-compressor.test.ts`: Verify file resizing, WebP blob conversion, and 500KB cap.
   - `tests/image-markdown.test.ts`: Test bidirectional roundtrip of image markdown syntax.
   - Backend Go tests for `POST /api/upload` and file serving.
