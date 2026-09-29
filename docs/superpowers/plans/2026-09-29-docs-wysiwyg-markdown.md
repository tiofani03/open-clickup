# Docs Subsystem (WYSIWYG + Markdown) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan fitur Dokumen (Docs) lengkap dengan editor WYSIWYG bergaya Notion/ClickUp yang mendukung Markdown shortcuts otomatis, mode toggle Raw Markdown, dukungan sub-pages bertingkat, Docs Hub, migrasi database, dan seeder data demo.

**Architecture:** 
- **Database:** Tabel `Doc` (kontainer dokumen yang bisa terikat ke Workspace/Space/Folder/List/Task) dan `DocPage` (halaman bersarang dengan kolom `content_markdown` sebagai source-of-truth dan `content_html` sebagai render cache).
- **Backend:** Endpoint RESTful di Go Fiber v2 menggunakan pgx/v5 dan sqlc (`/api/docs`, `/api/docs/:docId/pages`, dsb).
- **Frontend:** React 19 + TipTap Editor yang diperkaya dengan ekstensi formatting markdown + Slash command menu popup + Mode toggle view/edit raw markdown + Halaman Docs Hub (`/docs`) dan Doc View (`/docs/:docId`).

**Tech Stack:** Go 1.24, Go Fiber v2, PostgreSQL, sqlc, Vite 8, React 19, TipTap 3, Tailwind CSS 4, TanStack Query v5, Radix UI, Lucide Icons.

**Spec:** [`docs/superpowers/specs/2026-09-29-docs-wysiwyg-markdown-design.md`](docs/superpowers/specs/2026-09-29-docs-wysiwyg-markdown-design.md)

## Global Constraints
- Tetap mematuhi token desain ClickUp `--cu-*` dan komponen Radix UI yang sudah ada.
- `content_markdown` adalah format utama penyimpanan dokumen.
- Mendukung auto-save debounced pada saat pengeditan dokumen.
- Tidak merusak fungsionalitas views dan task yang sudah berjalan.

---

### Task 1: Database Migration for Docs & DocPages

**Files:**
- Create: `server-go/db/migrations/000002_create_docs.up.sql`
- Create: `server-go/db/migrations/000002_create_docs.down.sql`
- Modify: `server-go/db/schema.sql`

**Interfaces:**
- Produces: Tabel `"Doc"` dan `"DocPage"` pada PostgreSQL

- [x] **Step 1: Buat migration up SQL**
- [x] **Step 2: Buat migration down SQL**
- [x] **Step 3: Update `server-go/db/schema.sql`**
- [x] **Step 4: Jalankan migrasi pada database Docker**
- [x] **Step 5: Commit migrasi**

---

### Task 2: sqlc Query Definitions & Code Generation

**Files:**
- Create: `server-go/db/queries/docs.sql`
- Modify: `server-go/internal/db/` (generated sqlc files)

**Interfaces:**
- Produces: Query methods `CreateDoc`, `GetDoc`, `ListDocsByWorkspace`, `CreateDocPage`, `GetDocPagesByDoc`, `GetDocPage`, `UpdateDocPage`, `DeleteDoc`, `DeleteDocPage`

- [x] **Step 1: Tulis query SQL di `server-go/db/queries/docs.sql`**
- [x] **Step 2: Generate kode Go sqlc**
- [x] **Step 3: Verifikasi build backend Go**
- [x] **Step 4: Commit sqlc queries**

---

### Task 3: Backend Handlers & API Routes

**Files:**
- Modify: `server-go/internal/dto/dto.go`
- Create: `server-go/internal/handlers/docs.go`
- Modify: `server-go/cmd/server/main.go`

**Interfaces:**
- Consumes: `internal/db`, `internal/auth`
- Produces: HTTP API endpoints:
  - `GET /api/docs`
  - `POST /api/docs`
  - `GET /api/docs/:docId`
  - `PATCH /api/docs/:docId`
  - `DELETE /api/docs/:docId`
  - `POST /api/docs/:docId/pages`
  - `GET /api/docs/:docId/pages/:pageId`
  - `PATCH /api/docs/:docId/pages/:pageId`
  - `DELETE /api/docs/:docId/pages/:pageId`

- [x] **Step 1: Tambahkan DTO request/response di `server-go/internal/dto/dto.go`**
- [x] **Step 2: Buat handler `server-go/internal/handlers/docs.go`**
- [x] **Step 3: Daftarkan route di `server-go/cmd/server/main.go`**
- [x] **Step 4: Test endpoint backend menggunakan curl**
- [x] **Step 5: Commit handler backend**

---

### Task 4: Standalone Seeder for Docs Demo Data

**Files:**
- Modify: `server-go/cmd/seed/main.go`

**Interfaces:**
- Produces: Data demo dokumen contoh ("Product Roadmap & Architecture", "Engineering Guidelines & Code Conventions") lengkap dengan konten Markdown yang kaya dan sub-pages.

- [x] **Step 1: Tambahkan fungsi seeder dokumen di `server-go/cmd/seed/main.go`**
- [x] **Step 2: Jalankan seeder**
- [x] **Step 3: Commit seeder**

---

### Task 5: Frontend API Client & TanStack Query Hooks

**Files:**
- Modify: `lib/queries.ts`
- Modify: `lib/hooks.ts`

**Interfaces:**
- Produces: Types `DocItem`, `DocPageItem`, `DocDetail` dan hooks `useDocs()`, `useDoc(docId)`, `useDocPage(docId, pageId)`, `useCreateDoc()`, `useUpdateDoc()`, `useDeleteDoc()`, `useCreateDocPage()`, `useUpdateDocPage()`, `useDeleteDocPage()`.

- [x] **Step 1: Tambahkan Type definitions di `lib/queries.ts`**
- [x] **Step 2: Tambahkan TanStack Query Hooks di `lib/hooks.ts`**
- [x] **Step 3: Verifikasi typecheck**
- [x] **Step 4: Commit hooks frontend**

---

### Task 6: TipTap WYSIWYG Editor with Markdown Shortcuts & Dual Mode

**Files:**
- Create: `components/doc/slash-command.tsx`
- Create: `components/doc/doc-editor.tsx`

**Interfaces:**
- Consumes: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/suggestion`, Lucide icons
- Produces: `<DocEditor />` dengan support markdown shortcuts (`# `, `**`, `- `, ```), slash command menu (`/`), dan toggle Visual / Raw Markdown editor.

- [x] **Step 1: Buat komponen Slash Command Menu di `components/doc/slash-command.tsx`**
- [x] **Step 2: Buat komponen `DocEditor` di `components/doc/doc-editor.tsx`**
- [x] **Step 3: Uji fungsi konversi Markdown <-> HTML TipTap**
- [x] **Step 4: Commit komponen editor**

---

### Task 7: Frontend Docs Hub, Tree Navigation, & Sidebar Integration

**Files:**
- Create: `src/pages/docs-hub.tsx`
- Create: `src/pages/doc-view.tsx`
- Modify: `components/sidebar/sidebar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `<DocEditor />`, `useDocs()`, `useDoc()`
- Produces: Rute `/docs`, `/docs/:docId`, `/docs/:docId/p/:pageId`, dan tautan Docs di sidebar.

- [x] **Step 1: Tambahkan item menu "Docs" di Sidebar (`components/sidebar/sidebar.tsx`)**
- [x] **Step 2: Buat halaman Docs Hub (`src/pages/docs-hub.tsx`)**
- [x] **Step 3: Buat halaman Doc View (`src/pages/doc-view.tsx`)**
- [x] **Step 4: Daftarkan rute di `src/App.tsx`**
- [x] **Step 5: Verifikasi tampilan di browser**
- [x] **Step 6: Commit halaman UI Docs**

---

### Task 8: End-to-End Verification & Automated Tests

**Files:**
- Create: `tests/doc-markdown.test.ts`
- Run: `pnpm test`
- Run: `cd server-go && PATH=$PATH:/home/gli-it/go/bin go test ./...`

- [x] **Step 1: Tulis unit test untuk parser/serializer markdown**
- [x] **Step 2: Jalankan test suite vitest**
- [x] **Step 3: Jalankan test suite Go backend**
- [x] **Step 4: Verifikasi manual di browser**
- [x] **Step 5: Final commit**
