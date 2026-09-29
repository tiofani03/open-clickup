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
