-- name: GetUserByEmail :one
SELECT id, email, name, color, "avatarUrl", "createdAt", "passwordHash"
FROM "User"
WHERE email = $1 LIMIT 1;

-- name: GetUserByID :one
SELECT id, email, name, color, "avatarUrl", "createdAt", "passwordHash"
FROM "User"
WHERE id = $1 LIMIT 1;

-- name: CreateUser :one
INSERT INTO "User" (id, email, name, color, "avatarUrl", "passwordHash")
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, email, name, color, "avatarUrl", "createdAt", "passwordHash";

-- name: UpdateUser :one
UPDATE "User"
SET name = COALESCE($2, name),
    color = COALESCE($3, color),
    "avatarUrl" = COALESCE($4, "avatarUrl")
WHERE id = $1
RETURNING id, email, name, color, "avatarUrl", "createdAt", "passwordHash";

-- name: CreateSession :one
INSERT INTO "Session" (id, "userId", "expiresAt")
VALUES ($1, $2, $3)
RETURNING id, "userId", "expiresAt", "createdAt";

-- name: GetSessionWithUser :one
SELECT s.id, s."userId", s."expiresAt", s."createdAt",
       u.id as user_id, u.email as user_email, u.name as user_name, u.color as user_color, u."avatarUrl" as user_avatar_url
FROM "Session" s
JOIN "User" u ON s."userId" = u.id
WHERE s.id = $1 AND s."expiresAt" > NOW()
LIMIT 1;

-- name: DeleteSession :exec
DELETE FROM "Session"
WHERE id = $1;

-- name: GetUserMembership :one
SELECT wm.id, wm."workspaceId", wm."userId", wm.role, wm."createdAt"
FROM "WorkspaceMember" wm
WHERE wm."userId" = $1
ORDER BY wm."createdAt" ASC
LIMIT 1;

-- name: ListUsers :many
SELECT id, email, name, color, "avatarUrl", "createdAt"
FROM "User"
ORDER BY name ASC;
