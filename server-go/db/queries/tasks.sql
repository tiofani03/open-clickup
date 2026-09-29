-- name: ListTasksByList :many
SELECT t.id, t."listId", t."statusId", t."parentId", t.name, t.description, t.priority,
       t."position", t."startDate", t."dueDate", t."timeEstimate", t."createdById",
       t."createdAt", t."updatedAt", t."completedAt", t.archived, t.recurrence,
       s.name as status_name, s.color as status_color, s.type as status_type,
       (SELECT COUNT(*)::int FROM "Comment" c WHERE c."taskId" = t.id) as comment_count,
       (SELECT COUNT(*)::int FROM "Checklist" ch WHERE ch."taskId" = t.id) as checklist_count,
       (SELECT COUNT(*)::int FROM "Task" sub WHERE sub."parentId" = t.id AND sub.archived = false) as subtask_count
FROM "Task" t
JOIN "Status" s ON t."statusId" = s.id
WHERE t."listId" = $1 AND t."parentId" IS NULL AND t.archived = false
ORDER BY t."position" ASC;

-- name: GetTaskByID :one
SELECT t.id, t."listId", t."statusId", t."parentId", t.name, t.description, t.priority,
       t."position", t."startDate", t."dueDate", t."timeEstimate", t."createdById",
       t."createdAt", t."updatedAt", t."completedAt", t.archived, t.recurrence,
       s.name as status_name, s.color as status_color, s.type as status_type,
       l.name as list_name, sp.id as space_id, sp.name as space_name
FROM "Task" t
JOIN "Status" s ON t."statusId" = s.id
JOIN "List" l ON t."listId" = l.id
JOIN "Space" sp ON l."spaceId" = sp.id
WHERE t.id = $1 LIMIT 1;

-- name: CreateTask :one
INSERT INTO "Task" (id, "listId", "statusId", "parentId", name, description, priority, "position", "startDate", "dueDate", "timeEstimate", "createdById", "updatedAt", recurrence)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
RETURNING id, "listId", "statusId", "parentId", name, description, priority, "position", "startDate", "dueDate", "timeEstimate", "createdById", "createdAt", "updatedAt", "completedAt", archived, recurrence;

-- name: UpdateTask :one
UPDATE "Task"
SET name = COALESCE($2, name),
    description = COALESCE($3, description),
    priority = $4,
    "statusId" = COALESCE($5, "statusId"),
    "position" = COALESCE($6, "position"),
    "startDate" = $7,
    "dueDate" = $8,
    "timeEstimate" = $9,
    "completedAt" = $10,
    archived = COALESCE($11, archived),
    recurrence = $12,
    "updatedAt" = NOW()
WHERE id = $1
RETURNING id, "listId", "statusId", "parentId", name, description, priority, "position", "startDate", "dueDate", "timeEstimate", "createdById", "createdAt", "updatedAt", "completedAt", archived, recurrence;

-- name: DeleteTask :exec
DELETE FROM "Task" WHERE id = $1;

-- name: ListSubtasksByParent :many
SELECT t.id, t."listId", t."statusId", t."parentId", t.name, t.description, t.priority,
       t."position", t."startDate", t."dueDate", t."timeEstimate", t."createdById",
       t."createdAt", t."updatedAt", t."completedAt", t.archived, t.recurrence,
       s.name as status_name, s.color as status_color, s.type as status_type
FROM "Task" t
JOIN "Status" s ON t."statusId" = s.id
WHERE t."parentId" = $1 AND t.archived = false
ORDER BY t."position" ASC;

-- name: ListTaskAssignees :many
SELECT ta."taskId", ta."userId",
       u.name as user_name, u.email as user_email, u.color as user_color, u."avatarUrl" as user_avatar_url
FROM "TaskAssignee" ta
JOIN "User" u ON ta."userId" = u.id
WHERE ta."taskId" = $1;

-- name: AddTaskAssignee :one
INSERT INTO "TaskAssignee" ("taskId", "userId")
VALUES ($1, $2)
ON CONFLICT ("taskId", "userId") DO NOTHING
RETURNING "taskId", "userId";

-- name: RemoveTaskAssignee :exec
DELETE FROM "TaskAssignee"
WHERE "taskId" = $1 AND "userId" = $2;

-- name: ListTaskTags :many
SELECT tt."taskId", tt."tagId",
       tg.name as tag_name, tg.color as tag_color
FROM "TaskTag" tt
JOIN "Tag" tg ON tt."tagId" = tg.id
WHERE tt."taskId" = $1;

-- name: AddTaskTag :one
INSERT INTO "TaskTag" ("taskId", "tagId")
VALUES ($1, $2)
ON CONFLICT ("taskId", "tagId") DO NOTHING
RETURNING "taskId", "tagId";

-- name: RemoveTaskTag :exec
DELETE FROM "TaskTag"
WHERE "taskId" = $1 AND "tagId" = $2;

-- name: CreateActivity :one
INSERT INTO "Activity" (id, "taskId", "userId", type, data)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, "taskId", "userId", type, data, "createdAt";

-- name: ListActivitiesByTask :many
SELECT a.id, a."taskId", a."userId", a.type, a.data, a."createdAt",
       u.name as user_name, u.color as user_color, u."avatarUrl" as user_avatar_url
FROM "Activity" a
JOIN "User" u ON a."userId" = u.id
WHERE a."taskId" = $1
ORDER BY a."createdAt" DESC;

-- name: ListTaskWatchers :many
SELECT tw."taskId", tw."userId",
       u.name as user_name, u.email as user_email, u.color as user_color, u."avatarUrl" as user_avatar_url
FROM "TaskWatcher" tw
JOIN "User" u ON tw."userId" = u.id
WHERE tw."taskId" = $1;

-- name: ListTaskAttachments :many
SELECT a.id, a."taskId", a.name as file_name, a.size as file_size, a.mime as mime_type, a.url, a."createdAt"
FROM "Attachment" a
WHERE a."taskId" = $1
ORDER BY a."createdAt" DESC;

-- name: ListTaskTimeEntries :many
SELECT te.id, te."taskId", te."userId", te."startedAt", te."endedAt", te.duration,
       u.name as user_name, u.email as user_email, u.color as user_color, u."avatarUrl" as user_avatar_url
FROM "TimeEntry" te
JOIN "User" u ON te."userId" = u.id
WHERE te."taskId" = $1
ORDER BY te."startedAt" DESC;

-- name: ListTaskBlockedBy :many
SELECT td.id, td."blockerId", td."blockedId",
       t.id as blocker_task_id, t.name as blocker_name, t."listId" as blocker_list_id,
       s.name as status_name, s.color as status_color, s.type as status_type
FROM "TaskDependency" td
JOIN "Task" t ON td."blockerId" = t.id
JOIN "Status" s ON t."statusId" = s.id
WHERE td."blockedId" = $1;

-- name: ListTaskBlocking :many
SELECT td.id, td."blockerId", td."blockedId",
       t.id as blocked_task_id, t.name as blocked_name, t."listId" as blocked_list_id,
       s.name as status_name, s.color as status_color, s.type as status_type
FROM "TaskDependency" td
JOIN "Task" t ON td."blockedId" = t.id
JOIN "Status" s ON t."statusId" = s.id
WHERE td."blockerId" = $1;

-- name: ListMyTasks :many
SELECT t.id, t.name, t."listId", t.priority, t."startDate", t."dueDate",
       s.name as status_name, s.color as status_color, s.type as status_type,
       l.name as list_name, sp.name as space_name, sp.color as space_color
FROM "Task" t
JOIN "TaskAssignee" ta ON t.id = ta."taskId"
JOIN "Status" s ON t."statusId" = s.id
JOIN "List" l ON t."listId" = l.id
JOIN "Space" sp ON l."spaceId" = sp.id
WHERE ta."userId" = $1 AND t.archived = false
ORDER BY t."dueDate" ASC NULLS LAST, t."createdAt" DESC;

