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

- [ ] **Step 1: Buat migration up SQL**
  Tulis skrip DDL migrasi `server-go/db/migrations/000002_create_docs.up.sql`:
  ```sql
  CREATE TABLE "Doc" (
      "id" TEXT PRIMARY KEY,
      "workspace_id" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
      "space_id" TEXT REFERENCES "Space"("id") ON DELETE CASCADE,
      "folder_id" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL,
      "list_id" TEXT REFERENCES "List"("id") ON DELETE SET NULL,
      "task_id" TEXT REFERENCES "Task"("id") ON DELETE SET NULL,
      "title" TEXT NOT NULL DEFAULT 'Untitled Doc',
      "created_by_id" TEXT NOT NULL REFERENCES "User"("id"),
      "is_pinned" BOOLEAN NOT NULL DEFAULT FALSE,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX "idx_doc_workspace" ON "Doc"("workspace_id");
  CREATE INDEX "idx_doc_space" ON "Doc"("space_id");
  CREATE INDEX "idx_doc_list" ON "Doc"("list_id");
  CREATE INDEX "idx_doc_task" ON "Doc"("task_id");

  CREATE TABLE "DocPage" (
      "id" TEXT PRIMARY KEY,
      "doc_id" TEXT NOT NULL REFERENCES "Doc"("id") ON DELETE CASCADE,
      "parent_page_id" TEXT REFERENCES "DocPage"("id") ON DELETE CASCADE,
      "title" TEXT NOT NULL DEFAULT 'Untitled Page',
      "content_markdown" TEXT NOT NULL DEFAULT '',
      "content_html" TEXT NOT NULL DEFAULT '',
      "icon" TEXT,
      "cover_image" TEXT,
      "position" DOUBLE PRECISION NOT NULL DEFAULT 65535.0,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX "idx_doc_page_doc" ON "DocPage"("doc_id");
  CREATE INDEX "idx_doc_page_parent" ON "DocPage"("parent_page_id");
  ```

- [ ] **Step 2: Buat migration down SQL**
  Tulis skrip rollback `server-go/db/migrations/000002_create_docs.down.sql`:
  ```sql
  DROP TABLE IF EXISTS "DocPage";
  DROP TABLE IF EXISTS "Doc";
  ```

- [ ] **Step 3: Update `server-go/db/schema.sql`**
  Append DDL tabel `"Doc"` dan `"DocPage"` ke file `server-go/db/schema.sql` agar sinkron dengan sqlc.

- [ ] **Step 4: Jalankan migrasi pada database Docker**
  Jalankan perintah SQL ke container database PostgreSQL:
  ```bash
  docker exec open-clickup-db-1 psql -U clickuppp -d clickuppp -f /dev/stdin < server-go/db/migrations/000002_create_docs.up.sql
  ```
  Verifikasi: Kedua tabel berhasil dibuat.

- [ ] **Step 5: Commit migrasi**
  ```bash
  git add server-go/db/migrations server-go/db/schema.sql
  git commit -m "feat(db): add migrations and schema for Doc and DocPage"
  ```

---

### Task 2: sqlc Query Definitions & Code Generation

**Files:**
- Create: `server-go/db/queries/docs.sql`
- Modify: `server-go/internal/db/` (generated sqlc files)

**Interfaces:**
- Produces: Query methods `CreateDoc`, `GetDoc`, `ListDocsByWorkspace`, `CreateDocPage`, `GetDocPagesByDoc`, `GetDocPage`, `UpdateDocPage`, `DeleteDoc`, `DeleteDocPage`

- [ ] **Step 1: Tulis query SQL di `server-go/db/queries/docs.sql`**
  Query lengkap CRUD Doc dan DocPage.

- [ ] **Step 2: Generate kode Go sqlc**
  Jalankan:
  ```bash
  cd server-go && sqlc generate
  ```
  (Atau buat file Go model dan querier yang kompatibel di `internal/db/` jika binary sqlc tidak terinstall lokal).

- [ ] **Step 3: Verifikasi build backend Go**
  Jalankan: `PATH=$PATH:/home/gli-it/go/bin go build ./...` di direktori `server-go/`.

- [ ] **Step 4: Commit sqlc queries**
  ```bash
  git add server-go/db/queries/docs.sql server-go/internal/db/
  git commit -m "feat(db): add sqlc queries and generated code for docs"
  ```

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

- [ ] **Step 1: Tambahkan DTO request/response di `server-go/internal/dto/dto.go`**
  Definisikan struct `CreateDocRequest`, `UpdateDocRequest`, `CreateDocPageRequest`, `UpdateDocPageRequest`, `DocDetailResponse`.

- [ ] **Step 2: Buat handler `server-go/internal/handlers/docs.go`**
  Implementasikan logika handler Fiber untuk semua endpoint Doc dan DocPage. Saat membuat Doc baru, otomatis buatkan 1 `DocPage` awal (root page).

- [ ] **Step 3: Daftarkan route di `server-go/cmd/server/main.go`**
  Tambahkan group route `/api/docs` dengan middleware `auth.RequireUser(q)` dan `auth.RequireRole(q, db.MemberRoleMEMBER)`.

- [ ] **Step 4: Test endpoint backend menggunakan curl**
  Jalankan pengujian curl untuk memastikan login, create doc, list docs, dan get doc page mengembalikan HTTP 200 OK.

- [ ] **Step 5: Commit handler backend**
  ```bash
  git add server-go/internal/dto/dto.go server-go/internal/handlers/docs.go server-go/cmd/server/main.go
  git commit -m "feat(server): implement docs and doc pages api endpoints"
  ```

---

### Task 4: Standalone Seeder for Docs Demo Data

**Files:**
- Modify: `server-go/cmd/seed/main.go`

**Interfaces:**
- Produces: Data demo dokumen contoh ("Product Roadmap & Architecture", "Engineering Guidelines & Code Conventions") lengkap dengan konten Markdown yang kaya dan sub-pages.

- [ ] **Step 1: Tambahkan fungsi seeder dokumen di `server-go/cmd/seed/main.go`**
  Insert contoh Doc di tingkat Workspace dan Space Engineering, lengkap dengan beberapa DocPage bertingkat dan konten Markdown yang menarik.

- [ ] **Step 2: Jalankan seeder**
  ```bash
  cd server-go && PATH=$PATH:/home/gli-it/go/bin go run ./cmd/seed
  ```
  Verifikasi output: `Seeded demo docs successfully`.

- [ ] **Step 3: Commit seeder**
  ```bash
  git add server-go/cmd/seed/main.go
  git commit -m "feat(seed): add demo documents and pages to database seeder"
  ```

---

### Task 5: Frontend API Client & TanStack Query Hooks

**Files:**
- Modify: `lib/queries.ts`
- Modify: `lib/hooks.ts`

**Interfaces:**
- Produces: Types `DocItem`, `DocPageItem`, `DocDetail` dan hooks `useDocs()`, `useDoc(docId)`, `useDocPage(docId, pageId)`, `useCreateDoc()`, `useUpdateDoc()`, `useDeleteDoc()`, `useCreateDocPage()`, `useUpdateDocPage()`, `useDeleteDocPage()`.

- [ ] **Step 1: Tambahkan Type definitions di `lib/queries.ts`**
  Definisikan interface `DocItem`, `DocPageItem`, `DocDetailResponse`.

- [ ] **Step 2: Tambahkan TanStack Query Hooks di `lib/hooks.ts`**
  Implementasikan hook query dan mutation dengan optimasi invalidate query cache.

- [ ] **Step 3: Verifikasi typecheck**
  Jalankan: `npx tsc --noEmit` untuk memastikan tidak ada error typing.

- [ ] **Step 4: Commit hooks frontend**
  ```bash
  git add lib/queries.ts lib/hooks.ts
  git commit -m "feat(client): add types and hooks for docs management"
  ```

---

### Task 6: TipTap WYSIWYG Editor with Markdown Shortcuts & Dual Mode

**Files:**
- Create: `components/doc/slash-command.tsx`
- Create: `components/doc/doc-editor.tsx`

**Interfaces:**
- Consumes: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/suggestion`, Lucide icons
- Produces: `<DocEditor />` dengan support markdown shortcuts (`# `, `**`, `- `, ```), slash command menu (`/`), dan toggle Visual / Raw Markdown editor.

- [ ] **Step 1: Buat komponen Slash Command Menu di `components/doc/slash-command.tsx`**
  Menu melayang saat pengguna mengetik `/` untuk memilih blok: H1, H2, H3, Bullet list, Numbered list, Code block, Quote, Divider.

- [ ] **Step 2: Buat komponen `DocEditor` di `components/doc/doc-editor.tsx`**
  Editor berbasis TipTap yang menyimpan dan membaca markdown.
  Sediakan mode toggle:
  - Mode Visual (WYSIWYG)
  - Mode Raw Markdown (textarea dengan monospace font yang bisa diedit langsung).

- [ ] **Step 3: Uji fungsi konversi Markdown <-> HTML TipTap**
  Pastikan pergantian mode tidak menghilangkan konten atau formatting.

- [ ] **Step 4: Commit komponen editor**
  ```bash
  git add components/doc/
  git commit -m "feat(client): implement notion-style doc editor with markdown shortcuts and dual mode"
  ```

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

- [ ] **Step 1: Tambahkan item menu "Docs" di Sidebar (`components/sidebar/sidebar.tsx`)**
  Tampilkan icon `FileText` di bawah menu Home dengan badge jumlah doc, mengarahkan ke `/docs`.

- [ ] **Step 2: Buat halaman Docs Hub (`src/pages/docs-hub.tsx`)**
  Halaman dashboard semua dokumen: kartu Pinned Docs, Recent Docs, All Docs, filter pencarian, dan tombol "+ New Doc".

- [ ] **Step 3: Buat halaman Doc View (`src/pages/doc-view.tsx`)**
  Layout dokumen lengkap dengan:
  - Sidebar kiri: Pohon daftar halaman (`DocPage` tree), tombol tambah sub-page, tombol delete/rename.
  - Header: Breadcrumb judul, status simpan ("Saved" / "Saving..."), switch mode Visual / Markdown.
  - Body: Judul halaman yang bisa diedit, icon picker, dan komponen `<DocEditor />`.
  - Auto-save debounced (otomatis menyimpan perubahan setelah berhenti mengetik 800ms).

- [ ] **Step 4: Daftarkan rute di `src/App.tsx`**
  Tambahkan rute `/docs`, `/docs/:docId`, dan `/docs/:docId/p/:pageId` di dalam `<AppShell>`.

- [ ] **Step 5: Verifikasi tampilan di browser**
  Buka `http://localhost:3000/docs`, coba navigasi dan edit dokumen.

- [ ] **Step 6: Commit halaman UI Docs**
  ```bash
  git add src/pages/docs-hub.tsx src/pages/doc-view.tsx components/sidebar/sidebar.tsx src/App.tsx
  git commit -m "feat(client): implement docs hub, tree navigation, and app routing"
  ```

---

### Task 8: End-to-End Verification & Automated Tests

**Files:**
- Create: `tests/doc-markdown.test.ts`
- Run: `pnpm test`
- Run: `cd server-go && PATH=$PATH:/home/gli-it/go/bin go test ./...`

- [ ] **Step 1: Tulis unit test untuk parser/serializer markdown**
  Uji edge case konversi markdown ke format yang dikonsumsi editor.

- [ ] **Step 2: Jalankan test suite vitest**
  Jalankan: `pnpm test`
  Harus 100% PASS.

- [ ] **Step 3: Jalankan test suite Go backend**
  Jalankan: `cd server-go && PATH=$PATH:/home/gli-it/go/bin go test ./...`
  Harus 100% PASS.

- [ ] **Step 4: Verifikasi manual di browser**
  - Buat doc baru.
  - Buat sub-page.
  - Ketik dengan markdown shortcuts (`# Heading`, `- List`, dll.).
  - Beralih ke mode Raw Markdown, ubah teks, kembali ke visual.
  - Refresh halaman untuk memastikan perubahan tersimpan di database PostgreSQL.

- [ ] **Step 5: Final commit**
  ```bash
  git add .
  git commit -m "feat(docs): complete wysiwyg + markdown docs subsystem with sub-pages and seeder"
  ```
