-- name: GetFirstWorkspace :one
SELECT id, name, color, "avatarUrl", "createdAt"
FROM "Workspace"
ORDER BY "createdAt" ASC
LIMIT 1;

-- name: CreateWorkspace :one
INSERT INTO "Workspace" (id, name, color, "avatarUrl")
VALUES ($1, $2, $3, $4)
RETURNING id, name, color, "avatarUrl", "createdAt";

-- name: CreateWorkspaceMember :one
INSERT INTO "WorkspaceMember" (id, "workspaceId", "userId", role)
VALUES ($1, $2, $3, $4)
RETURNING id, "workspaceId", "userId", role, "createdAt";

-- name: ListWorkspaceMembers :many
SELECT wm.id, wm."workspaceId", wm."userId", wm.role, wm."createdAt",
       u.name as user_name, u.email as user_email, u.color as user_color, u."avatarUrl" as user_avatar_url
FROM "WorkspaceMember" wm
JOIN "User" u ON wm."userId" = u.id
WHERE wm."workspaceId" = $1
ORDER BY wm."createdAt" ASC;

-- name: ListSpacesByWorkspace :many
SELECT id, "workspaceId", name, color, icon, private, "position", "createdAt"
FROM "Space"
WHERE "workspaceId" = $1
ORDER BY "position" ASC;

-- name: GetSpaceByID :one
SELECT id, "workspaceId", name, color, icon, private, "position", "createdAt"
FROM "Space"
WHERE id = $1 LIMIT 1;

-- name: CreateSpace :one
INSERT INTO "Space" (id, "workspaceId", name, color, icon, private, "position")
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, "workspaceId", name, color, icon, private, "position", "createdAt";

-- name: UpdateSpace :one
UPDATE "Space"
SET name = COALESCE($2, name),
    color = COALESCE($3, color),
    icon = COALESCE($4, icon)
WHERE id = $1
RETURNING id, "workspaceId", name, color, icon, private, "position", "createdAt";

-- name: DeleteSpace :exec
DELETE FROM "Space" WHERE id = $1;

-- name: ListFoldersBySpace :many
SELECT id, "spaceId", name, "position", collapsed, "createdAt"
FROM "Folder"
WHERE "spaceId" = $1
ORDER BY "position" ASC;

-- name: CreateFolder :one
INSERT INTO "Folder" (id, "spaceId", name, "position", collapsed)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, "spaceId", name, "position", collapsed, "createdAt";

-- name: UpdateFolder :one
UPDATE "Folder"
SET name = COALESCE($2, name)
WHERE id = $1
RETURNING id, "spaceId", name, "position", collapsed, "createdAt";

-- name: DeleteFolder :exec
DELETE FROM "Folder" WHERE id = $1;

-- name: ListListsBySpace :many
SELECT l.id, l."spaceId", l."folderId", l.name, l.color, l.icon, l."position", l."createdAt",
       COUNT(t.id)::int as task_count
FROM "List" l
LEFT JOIN "Task" t ON t."listId" = l.id AND t.archived = false
WHERE l."spaceId" = $1
GROUP BY l.id
ORDER BY l."position" ASC;

-- name: GetListByID :one
SELECT l.id, l."spaceId", l."folderId", l.name, l.color, l.icon, l."position", l."createdAt",
       s.name as space_name, s.color as space_color, s.icon as space_icon,
       f.name as folder_name
FROM "List" l
JOIN "Space" s ON l."spaceId" = s.id
LEFT JOIN "Folder" f ON l."folderId" = f.id
WHERE l.id = $1 LIMIT 1;

-- name: CreateList :one
INSERT INTO "List" (id, "spaceId", "folderId", name, color, icon, "position")
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, "spaceId", "folderId", name, color, icon, "position", "createdAt";

-- name: UpdateList :one
UPDATE "List"
SET name = COALESCE($2, name),
    color = COALESCE($3, color)
WHERE id = $1
RETURNING id, "spaceId", "folderId", name, color, icon, "position", "createdAt";

-- name: DeleteList :exec
DELETE FROM "List" WHERE id = $1;

-- name: ListUserFavorites :many
SELECT "listId" FROM "Favorite"
WHERE "userId" = $1;

-- name: AddFavorite :one
INSERT INTO "Favorite" (id, "userId", "listId")
VALUES ($1, $2, $3)
ON CONFLICT ("userId", "listId") DO NOTHING
RETURNING id, "userId", "listId";

-- name: RemoveFavorite :exec
DELETE FROM "Favorite"
WHERE "userId" = $1 AND "listId" = $2;
