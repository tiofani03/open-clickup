CREATE TYPE "FolderKind" AS ENUM ('STANDARD', 'SPRINT');
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SprintEstimationMetric" AS ENUM ('POINTS', 'TIME');
CREATE TYPE "SprintTaskOutcome" AS ENUM (
    'COMPLETED',
    'CARRIED_OVER',
    'UNFINISHED',
    'REMOVED',
    'CANCELLED',
    'DELETED'
);
CREATE TYPE "SprintEventType" AS ENUM (
    'SPRINT_CREATED',
    'SPRINT_STARTED',
    'SPRINT_COMPLETED',
    'SPRINT_CANCELLED',
    'FORECAST_LOCKED',
    'TASK_ADDED',
    'TASK_REMOVED',
    'TASK_CARRIED_OVER',
    'TASK_COMPLETED',
    'TASK_REOPENED',
    'POINTS_CHANGED',
    'STATUS_CHANGED'
);

ALTER TABLE "Folder"
    ADD COLUMN kind "FolderKind" NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "Task"
    ADD COLUMN "sprintPoints" INTEGER,
    ADD CONSTRAINT "Task_sprintPoints_check" CHECK ("sprintPoints" IS NULL OR "sprintPoints" >= 0);

CREATE TABLE "SprintFolderSettings" (
    "folderId" TEXT PRIMARY KEY REFERENCES "Folder"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    "durationDays" INTEGER NOT NULL DEFAULT 14 CHECK ("durationDays" BETWEEN 1 AND 90),
    "startDayOfWeek" INTEGER NOT NULL DEFAULT 1 CHECK ("startDayOfWeek" BETWEEN 0 AND 6),
    "startTime" TIME NOT NULL DEFAULT '09:00:00',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    "estimationMetric" "SprintEstimationMetric" NOT NULL DEFAULT 'POINTS',
    "pointScale" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 5, 8, 13],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "SprintFolderSourceList" (
    "sprintFolderId" TEXT NOT NULL REFERENCES "Folder"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    "listId" TEXT NOT NULL REFERENCES "List"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("sprintFolderId", "listId")
);

CREATE TABLE "Sprint" (
    id TEXT PRIMARY KEY,
    "sprintFolderId" TEXT NOT NULL REFERENCES "Folder"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    name TEXT NOT NULL,
    goal TEXT,
    status "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "timezoneSnapshot" TEXT NOT NULL,
    "forecastLockedAt" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "createdById" TEXT REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Sprint_dates_check" CHECK ("startsAt" < "endsAt"),
    CONSTRAINT "Sprint_folder_name_key" UNIQUE ("sprintFolderId", name)
);

CREATE TABLE "SprintTask" (
    id TEXT PRIMARY KEY,
    "sprintId" TEXT NOT NULL REFERENCES "Sprint"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    "sprintFolderId" TEXT NOT NULL REFERENCES "Folder"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    "taskId" TEXT REFERENCES "Task"(id) ON UPDATE CASCADE ON DELETE SET NULL,
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "addedById" TEXT REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL,
    "removedAt" TIMESTAMPTZ,
    "removedById" TEXT REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL,
    outcome "SprintTaskOutcome",
    "carriedFromMembershipId" TEXT REFERENCES "SprintTask"(id) ON UPDATE CASCADE ON DELETE SET NULL,
    "pointsAtAdd" INTEGER,
    "forecastPoints" INTEGER,
    "pointsAtClose" INTEGER,
    "timeEstimateAtForecast" INTEGER,
    "timeEstimateAtClose" INTEGER,
    "taskNameSnapshot" TEXT NOT NULL,
    "homeListIdSnapshot" TEXT NOT NULL,
    "homeListNameSnapshot" TEXT NOT NULL,
    CONSTRAINT "SprintTask_points_check" CHECK (
        ("pointsAtAdd" IS NULL OR "pointsAtAdd" >= 0) AND
        ("forecastPoints" IS NULL OR "forecastPoints" >= 0) AND
        ("pointsAtClose" IS NULL OR "pointsAtClose" >= 0)
    )
);

CREATE TABLE "SprintEvent" (
    id TEXT PRIMARY KEY,
    "sprintId" TEXT NOT NULL REFERENCES "Sprint"(id) ON UPDATE CASCADE ON DELETE CASCADE,
    "taskId" TEXT REFERENCES "Task"(id) ON UPDATE CASCADE ON DELETE SET NULL,
    "actorId" TEXT REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL,
    type "SprintEventType" NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    "taskNameSnapshot" TEXT,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "SprintFolderSourceList_listId_idx" ON "SprintFolderSourceList"("listId");
CREATE INDEX "Sprint_sprintFolderId_idx" ON "Sprint"("sprintFolderId");
CREATE UNIQUE INDEX "Sprint_one_active_per_folder_idx"
    ON "Sprint"("sprintFolderId") WHERE status = 'ACTIVE';
CREATE INDEX "SprintTask_sprintId_idx" ON "SprintTask"("sprintId");
CREATE INDEX "SprintTask_taskId_idx" ON "SprintTask"("taskId");
CREATE UNIQUE INDEX "SprintTask_sprint_task_idx"
    ON "SprintTask"("sprintId", "taskId") WHERE "taskId" IS NOT NULL;
CREATE UNIQUE INDEX "SprintTask_one_open_per_folder_idx"
    ON "SprintTask"("sprintFolderId", "taskId")
    WHERE "taskId" IS NOT NULL AND outcome IS NULL AND "removedAt" IS NULL;
CREATE UNIQUE INDEX "SprintTask_carriedFrom_idx"
    ON "SprintTask"("carriedFromMembershipId") WHERE "carriedFromMembershipId" IS NOT NULL;
CREATE INDEX "SprintEvent_sprint_occurred_idx" ON "SprintEvent"("sprintId", "occurredAt");
CREATE INDEX "SprintEvent_taskId_idx" ON "SprintEvent"("taskId");
