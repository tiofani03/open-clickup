-- name: ListNotificationsByUser :many
SELECT n.id, n."userId", n."actorId", n."taskId", n.type, n.body, n.read, n."createdAt",
       u.name as actor_name, u.email as actor_email, u.color as actor_color, u."avatarUrl" as actor_avatar_url,
       t.name as task_name, t."listId" as task_list_id
FROM "Notification" n
LEFT JOIN "User" u ON n."actorId" = u.id
LEFT JOIN "Task" t ON n."taskId" = t.id
WHERE n."userId" = $1
ORDER BY n."createdAt" DESC
LIMIT 50;

-- name: CountUnreadNotificationsByUser :one
SELECT COUNT(*)::int
FROM "Notification"
WHERE "userId" = $1 AND read = false;

-- name: MarkNotificationsRead :exec
UPDATE "Notification"
SET read = true
WHERE "userId" = $1 AND id = ANY($2::text[]);

-- name: MarkAllNotificationsRead :exec
UPDATE "Notification"
SET read = true
WHERE "userId" = $1 AND read = false;
