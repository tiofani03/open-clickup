-- name: ListStatusesByList :many
SELECT id, "listId", name, color, type, "position", "wipLimit"
FROM "Status"
WHERE "listId" = $1
ORDER BY "position" ASC;

-- name: GetStatusByID :one
SELECT id, "listId", name, color, type, "position", "wipLimit"
FROM "Status"
WHERE id = $1 LIMIT 1;

-- name: CreateStatus :one
INSERT INTO "Status" (id, "listId", name, color, type, "position", "wipLimit")
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, "listId", name, color, type, "position", "wipLimit";

-- name: UpdateStatus :one
UPDATE "Status"
SET name = COALESCE($2, name),
    color = COALESCE($3, color),
    type = COALESCE($4, type),
    "position" = COALESCE($5, "position"),
    "wipLimit" = $6
WHERE id = $1
RETURNING id, "listId", name, color, type, "position", "wipLimit";

-- name: DeleteStatus :exec
DELETE FROM "Status" WHERE id = $1;
