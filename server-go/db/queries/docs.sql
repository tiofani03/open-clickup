-- name: CreateDoc :one
INSERT INTO "Doc" (id, workspace_id, space_id, folder_id, list_id, task_id, title, created_by_id, is_pinned)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;

-- name: GetDocByID :one
SELECT * FROM "Doc" WHERE id = $1 LIMIT 1;

-- name: ListDocsByWorkspace :many
SELECT d.*, u.name as creator_name, u.email as creator_email, u.color as creator_color, u."avatarUrl" as creator_avatar_url
FROM "Doc" d
JOIN "User" u ON d.created_by_id = u.id
WHERE d.workspace_id = $1
ORDER BY d.updated_at DESC;

-- name: ListDocsBySpace :many
SELECT d.*, u.name as creator_name, u.email as creator_email, u.color as creator_color, u."avatarUrl" as creator_avatar_url
FROM "Doc" d
JOIN "User" u ON d.created_by_id = u.id
WHERE d.space_id = $1
ORDER BY d.updated_at DESC;

-- name: UpdateDoc :one
UPDATE "Doc"
SET title = COALESCE(sqlc.narg('title'), title),
    is_pinned = COALESCE(sqlc.narg('is_pinned'), is_pinned),
    space_id = COALESCE(sqlc.narg('space_id'), space_id),
    folder_id = COALESCE(sqlc.narg('folder_id'), folder_id),
    list_id = COALESCE(sqlc.narg('list_id'), list_id),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteDoc :exec
DELETE FROM "Doc" WHERE id = $1;

-- name: CreateDocPage :one
INSERT INTO "DocPage" (id, doc_id, parent_page_id, title, content_markdown, content_html, icon, cover_image, position)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;

-- name: GetDocPageByID :one
SELECT * FROM "DocPage" WHERE id = $1 LIMIT 1;

-- name: ListDocPagesByDocID :many
SELECT id, doc_id, parent_page_id, title, icon, cover_image, position, created_at, updated_at
FROM "DocPage"
WHERE doc_id = $1
ORDER BY position ASC, created_at ASC;

-- name: UpdateDocPage :one
UPDATE "DocPage"
SET title = COALESCE(sqlc.narg('title'), title),
    content_markdown = COALESCE(sqlc.narg('content_markdown'), content_markdown),
    content_html = COALESCE(sqlc.narg('content_html'), content_html),
    icon = COALESCE(sqlc.narg('icon'), icon),
    cover_image = COALESCE(sqlc.narg('cover_image'), cover_image),
    position = COALESCE(sqlc.narg('position'), position),
    parent_page_id = COALESCE(sqlc.narg('parent_page_id'), parent_page_id),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteDocPage :exec
DELETE FROM "DocPage" WHERE id = $1;
