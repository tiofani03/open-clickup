-- name: GetSprintFolderSettings :one
SELECT sfs.*, f."spaceId", f.name AS folder_name, f.kind
FROM "SprintFolderSettings" sfs
JOIN "Folder" f ON f.id = sfs."folderId"
WHERE sfs."folderId" = $1;

-- name: ListSprintFolderSourceLists :many
SELECT sfsl."sprintFolderId", sfsl."listId", sfsl.position, sfsl."createdAt",
       l.name AS list_name, l."spaceId" AS space_id, l.color AS list_color
FROM "SprintFolderSourceList" sfsl
JOIN "List" l ON l.id = sfsl."listId"
WHERE sfsl."sprintFolderId" = $1
ORDER BY sfsl.position ASC, l.name ASC;

-- name: AddSprintFolderSourceList :exec
INSERT INTO "SprintFolderSourceList" ("sprintFolderId", "listId", position)
VALUES ($1, $2, $3)
ON CONFLICT ("sprintFolderId", "listId") DO UPDATE SET position = EXCLUDED.position;

-- name: DeleteSprintFolderSourceLists :exec
DELETE FROM "SprintFolderSourceList" WHERE "sprintFolderId" = $1;

-- name: CreateSprint :one
INSERT INTO "Sprint" (
    id, "sprintFolderId", name, goal, status, "startsAt", "endsAt",
    "timezoneSnapshot", "createdById"
)
VALUES ($1, $2, $3, $4, 'PLANNED', $5, $6, $7, $8)
RETURNING *;

-- name: GetSprintByID :one
SELECT s.*, f."spaceId", f.name AS folder_name, sp."workspaceId"
FROM "Sprint" s
JOIN "Folder" f ON f.id = s."sprintFolderId"
JOIN "Space" sp ON sp.id = f."spaceId"
WHERE s.id = $1;

-- name: LockSprintByID :one
SELECT s.*, f."spaceId", f.name AS folder_name, sp."workspaceId"
FROM "Sprint" s
JOIN "Folder" f ON f.id = s."sprintFolderId"
JOIN "Space" sp ON sp.id = f."spaceId"
WHERE s.id = $1
FOR UPDATE OF s;

-- name: ListSprintsByFolder :many
SELECT s.*,
       COUNT(st.id)::int AS task_count,
       COUNT(st.id) FILTER (WHERE st.outcome = 'COMPLETED')::int AS completed_count,
       COALESCE(SUM(CASE WHEN st.outcome IS NULL THEN COALESCE(t."sprintPoints", 0) ELSE COALESCE(st."pointsAtClose", 0) END), 0)::bigint AS total_points
FROM "Sprint" s
LEFT JOIN "SprintTask" st ON st."sprintId" = s.id AND st."removedAt" IS NULL
LEFT JOIN "Task" t ON t.id = st."taskId"
WHERE s."sprintFolderId" = $1
GROUP BY s.id
ORDER BY s."startsAt" DESC;

-- name: UpdateSprint :one
UPDATE "Sprint"
SET name = COALESCE(sqlc.narg('name'), name),
    goal = CASE WHEN sqlc.arg('set_goal')::boolean THEN sqlc.narg('goal') ELSE goal END,
    "startsAt" = COALESCE(sqlc.narg('starts_at'), "startsAt"),
    "endsAt" = COALESCE(sqlc.narg('ends_at'), "endsAt"),
    "updatedAt" = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeletePlannedSprint :execrows
DELETE FROM "Sprint" WHERE id = $1 AND status = 'PLANNED';

-- name: CreateSprintTask :one
INSERT INTO "SprintTask" (
    id, "sprintId", "sprintFolderId", "taskId", position, "addedById",
    "carriedFromMembershipId", "pointsAtAdd", "taskNameSnapshot",
    "homeListIdSnapshot", "homeListNameSnapshot"
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: GetOpenSprintTaskByFolderTask :one
SELECT st.*, s.name AS sprint_name, s.status AS sprint_status
FROM "SprintTask" st
JOIN "Sprint" s ON s.id = st."sprintId"
WHERE st."sprintFolderId" = $1 AND st."taskId" = $2
  AND st.outcome IS NULL AND st."removedAt" IS NULL
LIMIT 1;

-- name: ListOpenSprintTasks :many
SELECT st.*, COALESCE(t.name, st."taskNameSnapshot")::text AS task_name,
       COALESCE(t."listId", st."homeListIdSnapshot")::text AS "listId",
       COALESCE(t."statusId", '')::text AS "statusId", t.priority,
       t."startDate", t."dueDate",
       COALESCE(CASE WHEN st.outcome IS NULL THEN t."timeEstimate" ELSE st."timeEstimateAtClose" END, -1)::integer AS "timeEstimate",
       COALESCE(CASE WHEN st.outcome IS NULL THEN t."sprintPoints" ELSE st."pointsAtClose" END, -1)::integer AS "sprintPoints",
       t."parentId",
       COALESCE(s.name, 'Deleted')::text AS status_name,
       COALESCE(s.color, '#87909e')::text AS status_color,
       COALESCE(s.type, 'CLOSED'::"StatusType") AS status_type,
       COALESCE(l.name, st."homeListNameSnapshot")::text AS list_name, l.color AS list_color,
       COALESCE(
           jsonb_agg(
               jsonb_build_object(
                   'id', u.id, 'name', u.name, 'email', u.email,
                   'color', u.color, 'avatarUrl', u."avatarUrl"
               )
           ) FILTER (WHERE u.id IS NOT NULL),
           '[]'::jsonb
       ) AS assignees
FROM "SprintTask" st
LEFT JOIN "Task" t ON t.id = st."taskId"
LEFT JOIN "Status" s ON s.id = t."statusId"
LEFT JOIN "List" l ON l.id = t."listId"
LEFT JOIN "TaskAssignee" ta ON ta."taskId" = t.id
LEFT JOIN "User" u ON u.id = ta."userId"
WHERE st."sprintId" = $1
  AND st."removedAt" IS NULL
  AND (st.outcome IS NULL OR st.outcome IN ('COMPLETED', 'CARRIED_OVER', 'UNFINISHED'))
GROUP BY st.id, t.id, s.id, l.id
ORDER BY st.position ASC, st."addedAt" ASC;

-- name: ListSprintTaskMembershipsForUpdate :many
SELECT st.*, t.name AS task_name, t."listId", t."timeEstimate", t."sprintPoints",
       status.type AS status_type, l.name AS list_name
FROM "SprintTask" st
JOIN "Task" t ON t.id = st."taskId"
JOIN "Status" status ON status.id = t."statusId"
JOIN "List" l ON l.id = t."listId"
WHERE st."sprintId" = $1 AND st.outcome IS NULL AND st."removedAt" IS NULL
ORDER BY st.position ASC
FOR UPDATE OF st;

-- name: RemoveSprintTask :execrows
UPDATE "SprintTask"
SET "removedAt" = NOW(), "removedById" = $3, outcome = 'REMOVED',
    "pointsAtClose" = t."sprintPoints", "timeEstimateAtClose" = t."timeEstimate"
FROM "Task" t
WHERE "SprintTask"."sprintId" = $1 AND "SprintTask"."taskId" = $2
  AND "SprintTask"."taskId" = t.id
  AND "SprintTask".outcome IS NULL AND "SprintTask"."removedAt" IS NULL;

-- name: LockSprintForecast :exec
UPDATE "SprintTask" st
SET "forecastPoints" = t."sprintPoints",
    "timeEstimateAtForecast" = t."timeEstimate"
FROM "Task" t
WHERE st."sprintId" = $1 AND st."taskId" = t.id
  AND st.outcome IS NULL AND st."removedAt" IS NULL;

-- name: StartSprint :one
UPDATE "Sprint"
SET status = 'ACTIVE', "startedAt" = NOW(), "forecastLockedAt" = NOW(), "updatedAt" = NOW()
WHERE id = $1 AND status = 'PLANNED'
RETURNING *;

-- name: SetSprintTaskOutcome :exec
UPDATE "SprintTask"
SET outcome = $2, "pointsAtClose" = $3, "timeEstimateAtClose" = $4,
    "taskNameSnapshot" = $5, "homeListIdSnapshot" = $6, "homeListNameSnapshot" = $7
WHERE id = $1 AND outcome IS NULL;

-- name: CompleteSprint :one
UPDATE "Sprint"
SET status = 'COMPLETED', "completedAt" = NOW(), "updatedAt" = NOW()
WHERE id = $1 AND status = 'ACTIVE'
RETURNING *;

-- name: CancelSprint :one
UPDATE "Sprint"
SET status = 'CANCELLED', "completedAt" = NOW(), "updatedAt" = NOW()
WHERE id = $1 AND status IN ('PLANNED', 'ACTIVE')
RETURNING *;

-- name: CreateSprintEvent :one
INSERT INTO "SprintEvent" (id, "sprintId", "taskId", "actorId", type, data, "taskNameSnapshot")
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListSprintEvents :many
SELECT * FROM "SprintEvent"
WHERE "sprintId" = $1
ORDER BY "occurredAt" ASC;

-- name: ListTaskSprintHistory :many
SELECT st.id, st."sprintId", st."sprintFolderId", st."addedAt", st."removedAt",
       st.outcome, st."pointsAtAdd", st."forecastPoints", st."pointsAtClose",
       st."carriedFromMembershipId", s.name AS sprint_name, s.status AS sprint_status,
       s."startsAt", s."endsAt", f.name AS folder_name
FROM "SprintTask" st
JOIN "Sprint" s ON s.id = st."sprintId"
JOIN "Folder" f ON f.id = st."sprintFolderId"
WHERE st."taskId" = $1
ORDER BY s."startsAt" DESC;

-- name: ListSprintBacklogTasks :many
SELECT t.id, t."listId", t."statusId", t."parentId", t.name, t.priority,
       t."startDate", t."dueDate", t."timeEstimate", t."sprintPoints",
       s.name AS status_name, s.color AS status_color, s.type AS status_type,
       l.name AS list_name, l.color AS list_color
FROM "Task" t
JOIN "SprintFolderSourceList" source ON source."listId" = t."listId"
JOIN "Status" s ON s.id = t."statusId"
JOIN "List" l ON l.id = t."listId"
WHERE source."sprintFolderId" = $1
  AND t.archived = false
  AND NOT EXISTS (
      SELECT 1 FROM "SprintTask" st
      WHERE st."sprintFolderId" = source."sprintFolderId"
        AND st."taskId" = t.id
        AND st.outcome IS NULL
        AND st."removedAt" IS NULL
  )
ORDER BY t.priority ASC NULLS LAST, t."createdAt" ASC;
