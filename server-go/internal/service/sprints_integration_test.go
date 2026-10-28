package service

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCompleteSprintCarriesOpenMembershipAfterClosingSource(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for Sprint integration tests")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)

	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	workspaceID, userID := "test_ws_"+suffix, "test_user_"+suffix
	spaceID, folderID, listID := "test_space_"+suffix, "test_folder_"+suffix, "test_list_"+suffix
	statusID, taskID := "test_status_"+suffix, "test_task_"+suffix
	currentID, nextID := "test_sprint_current_"+suffix, "test_sprint_next_"+suffix

	statements := []struct {
		query string
		args  []any
	}{
		{`INSERT INTO "Workspace" (id, name) VALUES ($1, 'Sprint test')`, []any{workspaceID}},
		{`INSERT INTO "User" (id, email, name) VALUES ($1, $2, 'Sprint tester')`, []any{userID, suffix + "@sprint.test"}},
		{`INSERT INTO "WorkspaceMember" (id, "workspaceId", "userId", role) VALUES ($1, $2, $3, 'ADMIN')`, []any{"test_member_" + suffix, workspaceID, userID}},
		{`INSERT INTO "Space" (id, "workspaceId", name) VALUES ($1, $2, 'Engineering')`, []any{spaceID, workspaceID}},
		{`INSERT INTO "Folder" (id, "spaceId", name, kind) VALUES ($1, $2, 'Sprints', 'SPRINT')`, []any{folderID, spaceID}},
		{`INSERT INTO "SprintFolderSettings" ("folderId", timezone) VALUES ($1, 'UTC')`, []any{folderID}},
		{`INSERT INTO "List" (id, "spaceId", name) VALUES ($1, $2, 'Backlog')`, []any{listID, spaceID}},
		{`INSERT INTO "SprintFolderSourceList" ("sprintFolderId", "listId") VALUES ($1, $2)`, []any{folderID, listID}},
		{`INSERT INTO "Status" (id, "listId", name, type) VALUES ($1, $2, 'To do', 'NOT_STARTED')`, []any{statusID, listID}},
		{`INSERT INTO "Task" (id, "listId", "statusId", name, "sprintPoints", "updatedAt") VALUES ($1, $2, $3, 'Carry me', 5, NOW())`, []any{taskID, listID, statusID}},
		{`INSERT INTO "Sprint" (id, "sprintFolderId", name, "startsAt", "endsAt", "timezoneSnapshot", "createdById") VALUES ($1, $2, 'Current', NOW(), NOW() + INTERVAL '14 days', 'UTC', $3)`, []any{currentID, folderID, userID}},
		{`INSERT INTO "Sprint" (id, "sprintFolderId", name, "startsAt", "endsAt", "timezoneSnapshot", "createdById") VALUES ($1, $2, 'Next', NOW() + INTERVAL '14 days', NOW() + INTERVAL '28 days', 'UTC', $3)`, []any{nextID, folderID, userID}},
	}
	for _, statement := range statements {
		if _, err := pool.Exec(ctx, statement.query, statement.args...); err != nil {
			t.Fatalf("fixture setup failed: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM "Workspace" WHERE id = $1`, workspaceID)
		_, _ = pool.Exec(ctx, `DELETE FROM "User" WHERE id = $1`, userID)
	})

	service := NewSprintService(pool)
	if err := service.AddTasks(ctx, AddSprintTasksInput{SprintID: currentID, TaskIDs: []string{taskID}, UserID: userID}); err != nil {
		t.Fatalf("add task: %v", err)
	}
	if _, err := service.StartSprint(ctx, currentID, userID); err != nil {
		t.Fatalf("start Sprint: %v", err)
	}
	stats, err := service.CompleteSprint(ctx, CompleteSprintInput{
		SprintID: currentID, UserID: userID, DefaultAction: "CARRY_OVER", TargetSprintID: nextID,
	})
	if err != nil {
		t.Fatalf("complete Sprint with carry-over: %v", err)
	}
	if stats.CarriedOver != 1 || stats.Completed != 0 || stats.Unfinished != 0 {
		t.Fatalf("unexpected completion stats: %+v", stats)
	}

	var sourceOutcome string
	if err := pool.QueryRow(ctx, `SELECT outcome::text FROM "SprintTask" WHERE "sprintId" = $1 AND "taskId" = $2`, currentID, taskID).Scan(&sourceOutcome); err != nil {
		t.Fatal(err)
	}
	if sourceOutcome != "CARRIED_OVER" {
		t.Fatalf("source outcome = %s, want CARRIED_OVER", sourceOutcome)
	}
	var targetCount, openCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM "SprintTask" WHERE "sprintId" = $1 AND "taskId" = $2 AND outcome IS NULL AND "removedAt" IS NULL`, nextID, taskID).Scan(&targetCount); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM "SprintTask" WHERE "sprintFolderId" = $1 AND "taskId" = $2 AND outcome IS NULL AND "removedAt" IS NULL`, folderID, taskID).Scan(&openCount); err != nil {
		t.Fatal(err)
	}
	if targetCount != 1 || openCount != 1 {
		t.Fatalf("target memberships = %d, open memberships = %d; want 1 and 1", targetCount, openCount)
	}
}
