-- name: ListChecklistsByTask :many
SELECT id, "taskId", name, "position"
FROM "Checklist"
WHERE "taskId" = $1
ORDER BY "position" ASC;

-- name: GetChecklistByID :one
SELECT id, "taskId", name, "position"
FROM "Checklist"
WHERE id = $1 LIMIT 1;

-- name: CreateChecklist :one
INSERT INTO "Checklist" (id, "taskId", name, "position")
VALUES ($1, $2, $3, $4)
RETURNING id, "taskId", name, "position";

-- name: UpdateChecklist :one
UPDATE "Checklist"
SET name = COALESCE($2, name),
    "position" = COALESCE($3, "position")
WHERE id = $1
RETURNING id, "taskId", name, "position";

-- name: DeleteChecklist :exec
DELETE FROM "Checklist" WHERE id = $1;

-- name: ListChecklistItems :many
SELECT id, "checklistId", name, resolved, "position"
FROM "ChecklistItem"
WHERE "checklistId" = $1
ORDER BY "position" ASC;

-- name: CreateChecklistItem :one
INSERT INTO "ChecklistItem" (id, "checklistId", name, resolved, "position")
VALUES ($1, $2, $3, $4, $5)
RETURNING id, "checklistId", name, resolved, "position";

-- name: UpdateChecklistItem :one
UPDATE "ChecklistItem"
SET name = COALESCE($2, name),
    resolved = COALESCE($3, resolved),
    "position" = COALESCE($4, "position")
WHERE id = $1
RETURNING id, "checklistId", name, resolved, "position";

-- name: DeleteChecklistItem :exec
DELETE FROM "ChecklistItem" WHERE id = $1;
