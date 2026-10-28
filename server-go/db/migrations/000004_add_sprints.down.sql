DROP TABLE IF EXISTS "SprintEvent";
DROP TABLE IF EXISTS "SprintTask";
DROP TABLE IF EXISTS "Sprint";
DROP TABLE IF EXISTS "SprintFolderSourceList";
DROP TABLE IF EXISTS "SprintFolderSettings";

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_sprintPoints_check";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "sprintPoints";
ALTER TABLE "Folder" DROP COLUMN IF EXISTS kind;

DROP TYPE IF EXISTS "SprintEventType";
DROP TYPE IF EXISTS "SprintTaskOutcome";
DROP TYPE IF EXISTS "SprintEstimationMetric";
DROP TYPE IF EXISTS "SprintStatus";
DROP TYPE IF EXISTS "FolderKind";
