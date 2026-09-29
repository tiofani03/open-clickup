ALTER TABLE "DocPage"
ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "has_draft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "draft_markdown" TEXT,
ADD COLUMN IF NOT EXISTS "draft_html" TEXT;

CREATE TABLE IF NOT EXISTS "DocComment" (
    "id" TEXT PRIMARY KEY,
    "doc_page_id" TEXT NOT NULL REFERENCES "DocPage"("id") ON DELETE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "body" TEXT NOT NULL,
    "parent_id" TEXT REFERENCES "DocComment"("id") ON DELETE CASCADE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_doc_comment_page" ON "DocComment"("doc_page_id");
CREATE INDEX IF NOT EXISTS "idx_doc_comment_parent" ON "DocComment"("parent_id");
