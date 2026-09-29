DROP TABLE IF EXISTS "DocComment";

ALTER TABLE "DocPage"
DROP COLUMN IF EXISTS "draft_html",
DROP COLUMN IF EXISTS "draft_markdown",
DROP COLUMN IF EXISTS "has_draft",
DROP COLUMN IF EXISTS "is_published";
