package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"open-clickup-server/internal/auth"
	"open-clickup-server/internal/db"
)

func cuid() string {
	return "c" + uuid.New().String()[:24]
}

func main() {
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://clickuppp:clickuppp@localhost:5544/clickuppp?schema=public"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()

	fmt.Println("🧹 Clearing database...")
	clearTables := []string{
		"\"CommentReaction\"", "\"Comment\"", "\"Activity\"", "\"ChecklistItem\"",
		"\"Checklist\"", "\"CustomFieldValue\"", "\"CustomFieldOption\"", "\"CustomField\"",
		"\"TaskAssignee\"", "\"TaskWatcher\"", "\"TaskTag\"", "\"TimeEntry\"",
		"\"Dependency\"", "\"Task\"", "\"Tag\"", "\"Status\"", "\"View\"",
		"\"List\"", "\"Folder\"", "\"Space\"", "\"WorkspaceMember\"",
		"\"Workspace\"", "\"Session\"", "\"Favorite\"", "\"Notification\"", "\"User\"",
	}

	for _, table := range clearTables {
		_, _ = pool.Exec(ctx, fmt.Sprintf("DELETE FROM %s", table))
	}

	fmt.Println("👤 Creating users...")
	demoPW, _ := auth.HashPassword("password")

	usersData := []struct {
		Email string
		Name  string
		Color string
	}{
		{"santiago@clickuppp.dev", "Santiago Cotto", "#7b68ee"},
		{"maya@clickuppp.dev", "Maya Chen", "#fd71af"},
		{"diego@clickuppp.dev", "Diego Romero", "#2ecd6f"},
		{"priya@clickuppp.dev", "Priya Nair", "#ff7800"},
		{"lucas@clickuppp.dev", "Lucas Martin", "#0ab1e8"},
	}

	userIDs := make([]string, len(usersData))
	for i, u := range usersData {
		id := cuid()
		userIDs[i] = id
		_, err := pool.Exec(ctx, `
			INSERT INTO "User" (id, email, name, color, "passwordHash")
			VALUES ($1, $2, $3, $4, $5)
		`, id, u.Email, u.Name, u.Color, demoPW)
		if err != nil {
			log.Fatalf("Failed to create user %s: %v", u.Email, err)
		}
	}

	fmt.Println("🏢 Creating workspace...")
	wsID := cuid()
	_, err = pool.Exec(ctx, `
		INSERT INTO "Workspace" (id, name, color)
		VALUES ($1, 'Acme Inc.', '#7b68ee')
	`, wsID)
	if err != nil {
		log.Fatalf("Failed to create workspace: %v", err)
	}

	for i, uid := range userIDs {
		role := db.MemberRoleMEMBER
		if i == 0 {
			role = db.MemberRoleOWNER
		}
		_, err = pool.Exec(ctx, `
			INSERT INTO "WorkspaceMember" (id, "workspaceId", "userId", role)
			VALUES ($1, $2, $3, $4)
		`, cuid(), wsID, uid, role)
		if err != nil {
			log.Fatalf("Failed to add member: %v", err)
		}
	}

	// Helper to create list with statuses and views
	createList := func(spaceID string, folderID *string, name, color string, pos float64) (string, []string) {
		listID := cuid()
		_, err := pool.Exec(ctx, `
			INSERT INTO "List" (id, "spaceId", "folderId", name, color, "position")
			VALUES ($1, $2, $3, $4, $5, $6)
		`, listID, spaceID, folderID, name, color, pos)
		if err != nil {
			log.Fatalf("Failed to create list %s: %v", name, err)
		}

		statusDefs := []struct {
			Name  string
			Color string
			Type  db.StatusType
		}{
			{"TO DO", "#87909e", db.StatusTypeNOTSTARTED},
			{"IN PROGRESS", "#5b9fff", db.StatusTypeACTIVE},
			{"IN REVIEW", "#a875ff", db.StatusTypeACTIVE},
			{"COMPLETE", "#6bc950", db.StatusTypeDONE},
		}

		statusIDs := make([]string, len(statusDefs))
		for i, s := range statusDefs {
			sID := cuid()
			statusIDs[i] = sID
			_, err := pool.Exec(ctx, `
				INSERT INTO "Status" (id, "listId", name, color, type, "position")
				VALUES ($1, $2, $3, $4, $5, $6)
			`, sID, listID, s.Name, s.Color, s.Type, float64(i*1000))
			if err != nil {
				log.Fatalf("Failed to create status: %v", err)
			}
		}

		viewDefs := []struct {
			Name string
			Type db.ViewType
		}{
			{"List", db.ViewTypeLIST},
			{"Board", db.ViewTypeBOARD},
			{"Calendar", db.ViewTypeCALENDAR},
			{"Gantt", db.ViewTypeGANTT},
			{"Table", db.ViewTypeTABLE},
		}

		for i, v := range viewDefs {
			_, err := pool.Exec(ctx, `
				INSERT INTO "View" (id, "listId", name, type, "position")
				VALUES ($1, $2, $3, $4, $5)
			`, cuid(), listID, v.Name, v.Type, float64(i*1000))
			if err != nil {
				log.Fatalf("Failed to create view: %v", err)
			}
		}

		return listID, statusIDs
	}

	fmt.Println("📁 Creating spaces and lists...")
	// Space: Product
	prodSpaceID := cuid()
	_, _ = pool.Exec(ctx, `
		INSERT INTO "Space" (id, "workspaceId", name, color, icon, "position")
		VALUES ($1, $2, 'Product', '#7b68ee', '🚀', 1000)
	`, prodSpaceID, wsID)

	// Folder: Sprints
	sprintsFolderID := cuid()
	_, _ = pool.Exec(ctx, `
		INSERT INTO "Folder" (id, "spaceId", name, "position")
		VALUES ($1, $2, 'Sprints', 1000)
	`, sprintsFolderID, prodSpaceID)

	sprint24ID, sprint24Statuses := createList(prodSpaceID, &sprintsFolderID, "Sprint 24", "#7b68ee", 1000)
	_, _ = createList(prodSpaceID, &sprintsFolderID, "Sprint 25", "#7b68ee", 2000)
	backlogID, backlogStatuses := createList(prodSpaceID, nil, "Backlog", "#ff7800", 1000)
	_, _ = createList(prodSpaceID, nil, "Roadmap", "#2ecd6f", 2000)

	// Space: Marketing
	mktSpaceID := cuid()
	_, _ = pool.Exec(ctx, `
		INSERT INTO "Space" (id, "workspaceId", name, color, icon, "position")
		VALUES ($1, $2, 'Marketing', '#fd71af', '📣', 2000)
	`, mktSpaceID, wsID)
	_, _ = createList(mktSpaceID, nil, "Campaigns", "#fd71af", 1000)
	_, _ = createList(mktSpaceID, nil, "Content Calendar", "#0ab1e8", 2000)

	// Space: Engineering
	engSpaceID := cuid()
	_, _ = pool.Exec(ctx, `
		INSERT INTO "Space" (id, "workspaceId", name, color, icon, "position")
		VALUES ($1, $2, 'Engineering', '#2ecd6f', '⚡', 3000)
	`, engSpaceID, wsID)
	_, _ = createList(engSpaceID, nil, "Infra", "#2ecd6f", 1000)

	fmt.Println("📝 Creating sample tasks...")
	sampleTasks := []struct {
		ListID      string
		StatusID    string
		Name        string
		Description string
		Priority    db.Priority
		AssigneeIdx int
	}{
		{backlogID, backlogStatuses[0], "Design multi-workspace data model", "Evaluate tenant isolation and billing models", db.PriorityHIGH, 0},
		{backlogID, backlogStatuses[1], "Vite + Go Fiber architecture migration", "Decouple frontend SPA and build ultra-fast Go backend", db.PriorityURGENT, 0},
		{backlogID, backlogStatuses[2], "Automated E2E test coverage", "Ensure Playwright tests pass on all 5 views", db.PriorityNORMAL, 1},
		{backlogID, backlogStatuses[3], "Initial project setup", "Project repository and initial database schema", db.PriorityLOW, 2},
		{sprint24ID, sprint24Statuses[0], "Add custom dropdown field options", "Support color picking for select options", db.PriorityNORMAL, 3},
		{sprint24ID, sprint24Statuses[1], "Implement task recurrence engine", "Calculate next occurrence date on completion", db.PriorityHIGH, 4},
		{sprint24ID, sprint24Statuses[3], "Realtime SSE broadcast", "Sync changes across client tabs automatically", db.PriorityNORMAL, 0},
	}

	now := time.Now()
	for i, t := range sampleTasks {
		tID := cuid()
		_, err := pool.Exec(ctx, `
			INSERT INTO "Task" (id, "listId", "statusId", name, description, priority, "position", "createdById", "createdAt", "updatedAt")
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
		`, tID, t.ListID, t.StatusID, t.Name, t.Description, t.Priority, float64(i*1000), userIDs[t.AssigneeIdx], now)
		if err != nil {
			log.Fatalf("Failed to create task %s: %v", t.Name, err)
		}

		// Assignee
		_, _ = pool.Exec(ctx, `
			INSERT INTO "TaskAssignee" ("taskId", "userId")
			VALUES ($1, $2)
		`, tID, userIDs[t.AssigneeIdx])

		// Initial created activity
		_, _ = pool.Exec(ctx, `
			INSERT INTO "Activity" (id, "taskId", "userId", type, data)
			VALUES ($1, $2, $3, 'created', '{}')
		`, cuid(), tID, userIDs[t.AssigneeIdx])
	}

	fmt.Println("✅ Database successfully seeded!")
	fmt.Println("   Demo account: santiago@clickuppp.dev / password")
}
