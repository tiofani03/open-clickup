# Confluence-style Document Editor: Drafts, Publish Workflow, and Page Comments

## 1. Overview & Context

This design document outlines the Confluence-style editing workflow for Open ClickUp documents:
- **Clean View Mode vs. Interactive Edit Mode**: Documents default to a clean, read-only viewing canvas. Clicking "Edit" (or pressing `e`) transitions the page into interactive editing mode.
- **Drafts & Publish Workflow**: During editing, changes are auto-saved to a draft state (`draft_markdown`, `draft_html`, `has_draft = true`). A prominent "Publish" (or "Update") button commits the draft to the live published content (`content_markdown`, `content_html`). An indicator badge (`DRAFT` / `UNPUBLISHED CHANGES`) reflects the status.
- **Removal of Raw Markdown Button**: The top-right toggle buttons (`[Visual]` / `[Markdown]`) are eliminated. The editor is 100% natural WYSIWYG, with markdown shortcuts (`# `, `**`, etc.) continuing to function seamlessly.
- **Page Comments (Bottom of Page)**: Dedicated threaded discussion section below the document body, enabling collaboration, feedback, and discussion on individual document pages.

---

## 2. Database Schema & Migration

### Migration: `server-go/db/migrations/000003_add_doc_drafts_and_comments.up.sql`
```sql
-- Add draft tracking to DocPage
ALTER TABLE "DocPage"
ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "has_draft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "draft_markdown" TEXT,
ADD COLUMN IF NOT EXISTS "draft_html" TEXT;

-- Create DocComment table
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
```

### Migration: `server-go/db/migrations/000003_add_doc_drafts_and_comments.down.sql`
```sql
DROP TABLE IF EXISTS "DocComment";

ALTER TABLE "DocPage"
DROP COLUMN IF EXISTS "draft_html",
DROP COLUMN IF EXISTS "draft_markdown",
DROP COLUMN IF EXISTS "has_draft",
DROP COLUMN IF EXISTS "is_published";
```

Update `server-go/db/schema.sql` accordingly.

---

## 3. Backend Implementation (Go Fiber & sqlc)

### Queries (`server-go/db/queries/docs.sql`)
1. **Publish Page**:
   ```sql
   -- name: PublishDocPage :one
   UPDATE "DocPage"
   SET content_markdown = COALESCE(draft_markdown, content_markdown),
       content_html = COALESCE(draft_html, content_html),
       draft_markdown = NULL,
       draft_html = NULL,
       has_draft = false,
       is_published = true,
       updated_at = NOW()
   WHERE id = $1
   RETURNING *;
   ```
2. **Discard Page Draft**:
   ```sql
   -- name: DiscardDocPageDraft :one
   UPDATE "DocPage"
   SET draft_markdown = NULL,
       draft_html = NULL,
       has_draft = false,
       updated_at = NOW()
   WHERE id = $1
   RETURNING *;
   ```
3. **Doc Comments**:
   ```sql
   -- name: CreateDocComment :one
   INSERT INTO "DocComment" (id, doc_page_id, user_id, body, parent_id)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING *;

   -- name: ListDocCommentsByPage :many
   SELECT c.*, u.name as user_name, u.email as user_email, u.color as user_color, u."avatarUrl" as user_avatar_url
   FROM "DocComment" c
   JOIN "User" u ON c.user_id = u.id
   WHERE c.doc_page_id = $1
   ORDER BY c.created_at ASC;

   -- name: DeleteDocComment :exec
   DELETE FROM "DocComment" WHERE id = $1;
   ```

### API Endpoints
- `POST /api/docs/:docId/pages/:pageId/publish` -> publishes draft changes.
- `POST /api/docs/:docId/pages/:pageId/discard-draft` -> discards draft changes.
- `GET /api/docs/:docId/pages/:pageId/comments` -> list comments.
- `POST /api/docs/:docId/pages/:pageId/comments` -> create comment.
- `DELETE /api/docs/:docId/pages/:pageId/comments/:commentId` -> delete comment.

---

## 4. Frontend Implementation

### Types & Hooks
- Update `DocPageItem`: add `isPublished`, `hasDraft`, `draftMarkdown`, `draftHtml`.
- Add `DocCommentItem`: id, docPageId, userId, body, parentId, createdAt, updatedAt, user.
- Query hooks:
  - `useDocComments(docId, pageId)`
  - `useCreateDocComment(docId, pageId)`
  - `useDeleteDocComment(docId, pageId)`
  - `usePublishDocPage(docId)`
  - `useDiscardDocDraft(docId)`

### Document View Page (`src/pages/doc-view.tsx`)
- **State**: `isEditing` (boolean, defaults to false, toggled with `[✏️ Edit]` button or `e` key).
- **View Mode**:
  - `readOnly={true}` for `DocEditor`.
  - Shows `[✏️ Edit]` button in the top bar.
  - Shows `DRAFT` status badge if `hasDraft` is true.
  - Page tree shows a subtle `Draft` badge next to any page with active draft changes.
- **Edit Mode**:
  - `readOnly={false}` for `DocEditor`.
  - Editing auto-saves to draft via `useUpdateDocPage` (`draftMarkdown`, `draftHtml`, `has_draft: true`).
  - Shows `[Close]` and `[Publish]` buttons.
- **Comments Section**:
  - Positioned at the bottom of the document canvas.
  - Clean composer with user avatar, textarea, and "Comment" button.
  - Threaded comment list with author details, relative timestamp, and delete action.
