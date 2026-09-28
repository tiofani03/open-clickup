-- name: ListViewsByList :many
SELECT id, "listId", name, type, config, "position"
FROM "View"
WHERE "listId" = $1
ORDER BY "position" ASC;

-- name: GetViewByID :one
SELECT id, "listId", name, type, config, "position"
FROM "View"
WHERE id = $1 LIMIT 1;

-- name: CreateView :one
INSERT INTO "View" (id, "listId", name, type, config, "position")
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, "listId", name, type, config, "position";

-- name: UpdateViewConfig :one
UPDATE "View"
SET config = $2
WHERE id = $1
RETURNING id, "listId", name, type, config, "position";

-- name: DeleteView :exec
DELETE FROM "View" WHERE id = $1;
