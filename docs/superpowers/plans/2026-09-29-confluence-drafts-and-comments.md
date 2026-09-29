# Confluence-style Document Editor: Drafts, Publish Workflow, and Page Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Confluence-style document workflow featuring clean read-only View Mode vs interactive Edit Mode, auto-saving drafts with a Publish/Discard lifecycle, removal of the raw markdown button, and a page comments section at the bottom of each document.

**Architecture:** Database schema introduces draft columns to `DocPage` and a new `DocComment` table. Go Fiber backend provides endpoints for publishing, discarding drafts, and full CRUD on doc comments. The frontend leverages TanStack Query hooks, a threaded comments component, and an intuitive View/Edit/Publish mode switch.

**Tech Stack:** Go 1.24 (Fiber v2, pgx/v5, sqlc), PostgreSQL, React 19, TypeScript, TipTap v3, Tailwind CSS v4, TanStack Query v5.

**Spec:** `docs/superpowers/specs/2026-09-29-confluence-drafts-and-comments-design.md`

## Global Constraints
- Preserve ClickUp design tokens (`--cu-*`) and existing Radix UI primitives.
- Content is stored primarily as markdown (`content_markdown`), with HTML for fast rendering.
- All mutating endpoints require authenticated user via `auth.RequireUser` or `auth.RequireRole`.
- Never break existing task and doc routing.
- Keep all unit tests passing (`pnpm test` and `go test ./...`).

---

### Task 1: Database Migration for Doc Drafts & DocComment

**Files:**
- Create: `server-go/db/migrations/000003_add_doc_drafts_and_comments.up.sql`
- Create: `server-go/db/migrations/000003_add_doc_drafts_and_comments.down.sql`
- Modify: `server-go/db/schema.sql`

**Interfaces:**
- Produces: `is_published`, `has_draft`, `draft_markdown`, `draft_html` in `"DocPage"`, and table `"DocComment"`.

- [ ] **Step 1: Create migration up file**
  Add columns to `"DocPage"` and create table `"DocComment"` with indexes.
- [ ] **Step 2: Create migration down file**
  Revert `"DocComment"` and `"DocPage"` columns.
- [ ] **Step 3: Update schema.sql**
  Append changes to `server-go/db/schema.sql`.
- [ ] **Step 4: Execute migration on PostgreSQL**
  Run migration SQL using `docker exec` on container `open-clickup-db-1`.
- [ ] **Step 5: Verify tables and columns in PostgreSQL**
  Query `information_schema.columns` to verify new columns and `DocComment` table exist.
- [ ] **Step 6: Commit**
  `git commit -m "feat(db): migration for doc page drafts and doc comments"`

---

### Task 2: sqlc Query Definitions & Code Generation for Drafts and Comments

**Files:**
- Modify: `server-go/db/queries/docs.sql`
- Generated: `server-go/internal/db/docs.sql.go`

**Interfaces:**
- Consumes: PostgreSQL schema from Task 1.
- Produces: sqlc methods `PublishDocPage`, `DiscardDocPageDraft`, `CreateDocComment`, `ListDocCommentsByPage`, `DeleteDocComment`.

- [ ] **Step 1: Add sqlc queries to `server-go/db/queries/docs.sql`**
  Add queries for publishing pages, discarding drafts, and creating, listing, and deleting doc comments.
- [ ] **Step 2: Run sqlc generate**
  Execute `sqlc generate` in `server-go`.
- [ ] **Step 3: Verify Go compilation**
  Run `go build ./...` in `server-go`.
- [ ] **Step 4: Commit**
  `git commit -m "feat(db): add sqlc queries for doc drafts and comments"`

---

### Task 3: Backend Handlers & API Routes for Drafts, Publish, Discard, and Comments

**Files:**
- Modify: `server-go/internal/dto/doc.go`
- Modify: `server-go/internal/handlers/docs.go`
- Modify: `server-go/cmd/server/main.go`

**Interfaces:**
- Consumes: sqlc methods from Task 2.
- Produces:
  - `POST /api/docs/:docId/pages/:pageId/publish`
  - `POST /api/docs/:docId/pages/:pageId/discard-draft`
  - `GET /api/docs/:docId/pages/:pageId/comments`
  - `POST /api/docs/:docId/pages/:pageId/comments`
  - `DELETE /api/docs/:docId/pages/:pageId/comments/:commentId`

- [ ] **Step 1: Define DTOs in `server-go/internal/dto/doc.go`**
  Add `DocCommentResponse`, `CreateDocCommentRequest`, and update `DocPageResponse`.
- [ ] **Step 2: Implement handlers in `server-go/internal/handlers/docs.go`**
  Implement `PublishDocPage`, `DiscardDocPageDraft`, `ListDocComments`, `CreateDocComment`, and `DeleteDocComment`.
- [ ] **Step 3: Register routes in `server-go/cmd/server/main.go`**
  Mount publish, discard, and comments routes under `/api/docs`.
- [ ] **Step 4: Verify with Go tests**
  Run `go test ./...` in `server-go`.
- [ ] **Step 5: Commit**
  `git commit -m "feat(server): implement endpoints for doc publish, draft discard, and comments"`

---

### Task 4: Frontend Types and TanStack Query Hooks

**Files:**
- Modify: `lib/queries.ts`
- Modify: `lib/hooks.ts`

**Interfaces:**
- Consumes: API endpoints from Task 3.
- Produces: Types `DocCommentItem`, updated `DocPageItem`, and hooks `useDocComments`, `useCreateDocComment`, `useDeleteDocComment`, `usePublishDocPage`, `useDiscardDocDraft`.

- [ ] **Step 1: Add types in `lib/queries.ts`**
  Define `DocCommentItem` and update `DocPageItem` with `isPublished`, `hasDraft`, `draftMarkdown`, `draftHtml`.
- [ ] **Step 2: Add hooks in `lib/hooks.ts`**
  Add query and mutation hooks for doc comments and draft publish/discard.
- [ ] **Step 3: Verify TypeScript and tests**
  Run `pnpm test`.
- [ ] **Step 4: Commit**
  `git commit -m "feat(client): add query hooks and types for doc comments and draft lifecycle"`

---

### Task 5: Frontend Doc Comments Component

**Files:**
- Create: `components/doc/doc-comments.tsx`
- Test: `tests/doc-comments.test.ts`

**Interfaces:**
- Consumes: `useDocComments`, `useCreateDocComment`, `useDeleteDocComment` from `lib/hooks.ts`.
- Produces: `<DocComments docId={docId} pageId={pageId} />` component.

- [ ] **Step 1: Write unit tests for comments component utilities**
  Create `tests/doc-comments.test.ts` to test comment ordering and reply formatting.
- [ ] **Step 2: Build `<DocComments />` in `components/doc/doc-comments.tsx`**
  Implement clean comment composer with user avatar, submit button, threaded discussion list, relative timestamps, and delete capability.
- [ ] **Step 3: Run tests and verify**
  Run `pnpm test`.
- [ ] **Step 4: Commit**
  `git commit -m "feat(client): implement doc comments thread component"`

---

### Task 6: Frontend Confluence Workflow Integration & Removal of Markdown Button

**Files:**
- Modify: `src/pages/doc-view.tsx`
- Modify: `components/doc/doc-editor.tsx`

**Interfaces:**
- Consumes: `<DocComments />` from Task 5, draft hooks from Task 4.
- Produces: Confluence-style View Mode vs Edit Mode, `[✏️ Edit]` button, `DRAFT` status badge, `[Publish]` button, and embedded comments at the bottom of the page.

- [ ] **Step 1: Remove Markdown switcher button from `src/pages/doc-view.tsx`**
  Eliminate `[Visual] / [Markdown]` toggle buttons in the top-right toolbar.
- [ ] **Step 2: Implement View Mode vs Edit Mode state**
  Default to `isEditing = false` (`readOnly={true}`). Add `[✏️ Edit]` button in the top bar with shortcut `e`.
- [ ] **Step 3: Implement Draft and Publish controls**
  When in Edit Mode, auto-save writes to draft (`draftMarkdown`, `hasDraft: true`). Add `[Close]` and `[Publish]` buttons in header.
- [ ] **Step 4: Display Draft badges in header and page tree**
  Show subtle `DRAFT` pill badge in header and next to page title in the tree sidebar.
- [ ] **Step 5: Integrate `<DocComments />` at the bottom of page**
  Embed `<DocComments docId={docId} pageId={activePageId} />` directly below the document canvas in `src/pages/doc-view.tsx`.
- [ ] **Step 6: Run tests and verify Vite build**
  Run `pnpm test && pnpm build`.
- [ ] **Step 7: Commit**
  `git commit -m "feat(client): implement confluence edit/publish workflow, draft indicators, and doc comments"`

---

### Task 7: End-to-End Verification & Automated Tests

**Files:**
- Test: `tests/docs-confluence.test.ts`

**Interfaces:**
- Verifies the full Confluence editing lifecycle and comments subsystem.

- [ ] **Step 1: Write integration tests in `tests/docs-confluence.test.ts`**
  Verify draft lifecycle state transitions, publish behavior, and comments.
- [ ] **Step 2: Run all test suites**
  Run `pnpm test && cd server-go && PATH=$PATH:/home/gli-it/go/bin go test ./...`.
- [ ] **Step 3: Restart running Go backend and test live API endpoints**
  Verify `/publish`, `/discard-draft`, and `/comments` endpoints return HTTP 200.
- [ ] **Step 4: Commit**
  `git commit -m "test(docs): add comprehensive tests for confluence drafts and comments"`
