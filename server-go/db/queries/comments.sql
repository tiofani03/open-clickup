-- name: ListCommentsByTask :many
SELECT c.id, c."taskId", c."userId", c.body, c."parentId", c.resolved, c."createdAt", c."updatedAt",
       u.name as user_name, u.email as user_email, u.color as user_color, u."avatarUrl" as user_avatar_url
FROM "Comment" c
JOIN "User" u ON c."userId" = u.id
WHERE c."taskId" = $1
ORDER BY c."createdAt" ASC;

-- name: GetCommentByID :one
SELECT id, "taskId", "userId", body, "parentId", resolved, "createdAt", "updatedAt"
FROM "Comment"
WHERE id = $1 LIMIT 1;

-- name: CreateComment :one
INSERT INTO "Comment" (id, "taskId", "userId", body, "parentId", "updatedAt")
VALUES ($1, $2, $3, $4, $5, NOW())
RETURNING id, "taskId", "userId", body, "parentId", resolved, "createdAt", "updatedAt";

-- name: UpdateComment :one
UPDATE "Comment"
SET body = COALESCE($2, body),
    resolved = COALESCE($3, resolved),
    "updatedAt" = NOW()
WHERE id = $1
RETURNING id, "taskId", "userId", body, "parentId", resolved, "createdAt", "updatedAt";

-- name: DeleteComment :exec
DELETE FROM "Comment" WHERE id = $1;

-- name: ListReactionsByComment :many
SELECT cr.id, cr."commentId", cr."userId", cr.emoji,
       u.name as user_name
FROM "CommentReaction" cr
JOIN "User" u ON cr."userId" = u.id
WHERE cr."commentId" = $1;

-- name: AddReaction :one
INSERT INTO "CommentReaction" (id, "commentId", "userId", emoji)
VALUES ($1, $2, $3, $4)
RETURNING id, "commentId", "userId", emoji;

-- name: RemoveReaction :exec
DELETE FROM "CommentReaction"
WHERE "commentId" = $1 AND "userId" = $2 AND emoji = $3;
