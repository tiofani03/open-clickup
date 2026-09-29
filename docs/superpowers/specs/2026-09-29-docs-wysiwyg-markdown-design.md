# Design Spec: Docs Subsystem (WYSIWYG + Markdown)

## 1. Overview & Purpose
Menambahkan subsistem Dokumen (**Docs**) ke Open ClickUp dengan pengalaman pengetikan bergaya ClickUp & Notion:
- **WYSIWYG** penuh dengan auto-formatting dari *Markdown shortcuts* saat mengetik (`# `, `**`, `- `, ```, dll.).
- **Dual Mode**: Kemampuan *toggle* antara tampilan visual (WYSIWYG) dan Markdown mentah (*Raw Markdown*).
- **Hierarki Hybrid**: Dokumen dapat berdiri sendiri di tingkat Workspace (Docs Hub), ditautkan ke Space, Folder, List, atau Task tertentu.
- **Halaman Bertingkat (Sub-pages)**: Dokumen mendukung struktur pohon halaman (nested pages) di dalamnya.

---

## 2. Model Data & Skema Database (PostgreSQL)

File migrasi: `server-go/db/migrations/000002_create_docs.up.sql` dan `server-go/db/migrations/000002_create_docs.down.sql`.

### Tabel `Doc`
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
```

### Tabel `DocPage`
```sql
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

---

## 3. Backend Architecture (Go Fiber + sqlc)

### Queries (`server-go/db/queries/docs.sql`)
1. `CreateDoc`: Membuat dokumen baru.
2. `GetDoc`: Mengambil dokumen beserta daftar halaman (`DocPage`).
3. `ListDocsByWorkspace`: Mengambil semua dokumen di workspace (untuk Docs Hub).
4. `ListDocsBySpace`: Mengambil dokumen yang terikat ke Space tertentu.
5. `UpdateDoc`: Update metadata dokumen (title, is_pinned, lokasi space/folder/list/task).
6. `DeleteDoc`: Menghapus dokumen.
7. `CreateDocPage`: Membuat halaman baru di dalam Doc (opsional dengan `parent_page_id`).
8. `GetDocPage`: Mengambil detail konten halaman (`content_markdown`, `content_html`).
9. `UpdateDocPage`: Mengubah judul, icon, posisi, `content_markdown`, dan `content_html`.
10. `DeleteDocPage`: Menghapus halaman dan sub-halaman di bawahnya.

### Handlers & Routes (`server-go/internal/handlers/docs.go`)
- `GET /api/docs` -> Daftar dokumen di workspace (dengan filter `space_id`, `is_pinned`, query pencarian).
- `POST /api/docs` -> Membuat dokumen baru (+ otomatis 1 root page default).
- `GET /api/docs/:docId` -> Mengambil detail dokumen + daftar halaman ringkas (nav tree).
- `PATCH /api/docs/:docId` -> Update dokumen.
- `DELETE /api/docs/:docId` -> Hapus dokumen.
- `POST /api/docs/:docId/pages` -> Tambah halaman baru.
- `GET /api/docs/:docId/pages/:pageId` -> Ambil konten lengkap halaman.
- `PATCH /api/docs/:docId/pages/:pageId` -> Simpan konten/judul halaman (auto-save).
- `DELETE /api/docs/:docId/pages/:pageId` -> Hapus halaman.

### Seeder (`server-go/cmd/seed/main.go`)
- Menambahkan data awal dokumen demo (misal: "Product Roadmap & Architecture", "Engineering Guidelines & Coding Standards") lengkap dengan konten Markdown yang rapi dan contoh sub-pages.

---

## 4. Frontend Architecture (React 19 + TipTap + Tailwind 4)

### Routing (`src/App.tsx`)
- `/docs` -> Halaman **Docs Hub** (tampilan kartu/daftar semua dokumen, filter Recent / Pinned / All).
- `/docs/:docId` -> Tampilan utama dokumen (default ke root page).
- `/docs/:docId/p/:pageId` -> Tampilan dokumen membuka halaman tertentu.

### Komponen Baru
1. **Sidebar Navigation**:
   - Menambahkan item menu `Docs` di bawah Dashboard/Home dengan ikon buku/file (`FileText` atau `BookOpen`).
   - Mendukung klik langsung menuju Docs Hub.
2. **Docs Hub Page (`src/pages/docs-hub.tsx`)**:
   - Menampilkan grid/list dokumen: Pinned, Recent, All.
   - Tombol "+ New Doc" untuk membuat dokumen cepat.
3. **Doc View Layout (`src/pages/doc-view.tsx`)**:
   - **Sub-pages Sidebar (Tree)**: Daftar halaman dan sub-halaman di sebelah kiri, bisa expand/collapse, tambah sub-page `+`, drag/reorder posisi.
   - **Header Bar**: Breadcrumb navigasi, status auto-save ("Saved" / "Saving..."), Pin toggle, Switch Mode `[Visual / Markdown]`.
4. **Editor Teks Kaya (`components/doc/doc-editor.tsx`)**:
   - Menggunakan TipTap dengan extensions:
     - Heading (Level 1, 2, 3), Bold, Italic, Strike, Code, Blockquote, BulletList, OrderedList, TaskList/TaskItem, Table, HorizontalRule, CodeBlockLowlight.
     - **Markdown shortcuts**: Otomatis mengenali input `# `, `## `, `- `, `1. `, `> `, ````, dll.
     - **Slash Command Menu** (`/`): Menu popup cepat saat mengetik `/` untuk memilih blok (Heading, Bullets, To-do list, Code, Divider, Quote).
   - **Markdown Toggle**:
     - Jika dalam mode Markdown: textarea / monaco-style editor dengan syntax highlighting untuk pengeditan raw markdown langsung.
     - Sinkronisasi dua arah: perubahan di raw markdown di-parse ke HTML/TipTap, dan sebaliknya.

---

## 5. Rencana Pengujian
1. **Migrasi & Database**: Memastikan migrasi `up` dan `down` berjalan mulus di PostgreSQL docker.
2. **Backend**: Unit test dan integration test untuk endpoints Go Fiber (`/api/docs`).
3. **Frontend**: Unit test untuk markdown parsing & view state, verifikasi navigasi rute dan auto-save.
