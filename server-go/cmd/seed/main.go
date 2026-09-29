package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
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
		dbURL = "postgresql://clickuppp:clickuppp@localhost:5544/clickuppp?sslmode=disable"
	}
	dbURL = strings.ReplaceAll(dbURL, "?schema=public", "?sslmode=disable")
	dbURL = strings.ReplaceAll(dbURL, "&schema=public", "")

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
		"\"DocPage\"", "\"Doc\"",
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

	userMap := make(map[string]string)
	userIDs := make([]string, len(usersData))
	for i, u := range usersData {
		id := cuid()
		userIDs[i] = id
		userMap[u.Email] = id
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

	spaceMap := make(map[string]string)

	fmt.Println("📁 Creating spaces and lists...")
	// Space: Product
	prodSpaceID := cuid()
	spaceMap["Product"] = prodSpaceID
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
	spaceMap["Marketing"] = mktSpaceID
	_, _ = pool.Exec(ctx, `
		INSERT INTO "Space" (id, "workspaceId", name, color, icon, "position")
		VALUES ($1, $2, 'Marketing', '#fd71af', '📣', 2000)
	`, mktSpaceID, wsID)
	_, _ = createList(mktSpaceID, nil, "Campaigns", "#fd71af", 1000)
	_, _ = createList(mktSpaceID, nil, "Content Calendar", "#0ab1e8", 2000)

	// Space: Engineering
	engSpaceID := cuid()
	spaceMap["Engineering"] = engSpaceID
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

	fmt.Println("📄 Creating demo documents...")
	santiagoID := userMap["santiago@clickuppp.dev"]

	// Document 1: "Product Roadmap & Architecture" (Workspace level, pinned)
	doc1ID := cuid()
	_, err = pool.Exec(ctx, `
		INSERT INTO "Doc" (id, workspace_id, space_id, folder_id, list_id, task_id, title, created_by_id, is_pinned, created_at, updated_at)
		VALUES ($1, $2, NULL, NULL, NULL, NULL, $3, $4, $5, $6, $6)
	`, doc1ID, wsID, "Product Roadmap & Architecture", santiagoID, true, now)
	if err != nil {
		log.Fatalf("Failed to create doc 1: %v", err)
	}

	overviewMarkdown := `# Product Overview & Vision 🚀

> "Empowering high-velocity engineering and product teams with an intuitive, hyper-fast workspace."

## Vision Statement
Open ClickUp is designed to bring together tasks, docs, and team collaboration into a unified, responsive interface without bloat or latency.

### Core Objectives
- [x] High-performance reactive backend in Go with Fiber
- [x] Sub-second real-time state synchronization via SSE
- [x] Hierarchical project navigation (Workspaces, Spaces, Folders, Lists)
- [ ] Rich WYSIWYG document editing with bidirectional Markdown support
- [ ] Collaborative real-time canvas & whiteboards

### Product Pillars
* **Speed & Responsiveness**: Immediate UI updates with optimistic rendering and sub-50ms server responses.
* **Developer First**: Clean APIs, Postgres-backed persistence, and full markdown import/export.
* **Extensibility**: Modular structure allowing seamless integration of custom fields, views, and automations.
`

	overviewHTML := `<h1>Product Overview & Vision 🚀</h1>
<blockquote><p>"Empowering high-velocity engineering and product teams with an intuitive, hyper-fast workspace."</p></blockquote>
<h2>Vision Statement</h2>
<p>Open ClickUp is designed to bring together tasks, docs, and team collaboration into a unified, responsive interface without bloat or latency.</p>
<h3>Core Objectives</h3>
<ul data-type="taskList">
<li data-checked="true"><label><input type="checkbox" checked></label><div>High-performance reactive backend in Go with Fiber</div></li>
<li data-checked="true"><label><input type="checkbox" checked></label><div>Sub-second real-time state synchronization via SSE</div></li>
<li data-checked="true"><label><input type="checkbox" checked></label><div>Hierarchical project navigation (Workspaces, Spaces, Folders, Lists)</div></li>
<li data-checked="false"><label><input type="checkbox"></label><div>Rich WYSIWYG document editing with bidirectional Markdown support</div></li>
<li data-checked="false"><label><input type="checkbox"></label><div>Collaborative real-time canvas &amp; whiteboards</div></li>
</ul>
<h3>Product Pillars</h3>
<ul>
<li><strong>Speed &amp; Responsiveness</strong>: Immediate UI updates with optimistic rendering and sub-50ms server responses.</li>
<li><strong>Developer First</strong>: Clean APIs, Postgres-backed persistence, and full markdown import/export.</li>
<li><strong>Extensibility</strong>: Modular structure allowing seamless integration of custom fields, views, and automations.</li>
</ul>`

	doc1Page1ID := cuid()
	_, err = pool.Exec(ctx, `
		INSERT INTO "DocPage" (id, doc_id, parent_page_id, title, content_markdown, content_html, icon, cover_image, position, created_at, updated_at)
		VALUES ($1, $2, NULL, $3, $4, $5, $6, NULL, $7, $8, $8)
	`, doc1Page1ID, doc1ID, "Overview & Vision", overviewMarkdown, overviewHTML, "🚀", 1000.0, now)
	if err != nil {
		log.Fatalf("Failed to create doc 1 page 1: %v", err)
	}

	architectureMarkdown := `# System Architecture 🏗️

The Open ClickUp architecture decouples the frontend client SPA from the high-throughput Go backend service.

## Tech Stack

* **Frontend**: Next.js 16 (App Router), React 19, TipTap WYSIWYG, Tailwind CSS
* **Backend API**: Go 1.24, Fiber v2, pgxpool v5
* **Database**: PostgreSQL 16 with relational integrity and cascade deletes
* **Realtime**: Event-driven SSE (Server-Sent Events) hub

## Architecture Diagram

` + "```" + `
+-------------------------------------------------------+
|                   Web Browser (SPA)                   |
|           Next.js 16 App + React 19 + TipTap          |
+-------------------------------------------------------+
                           |
             HTTP REST API | SSE Events
                           v
+-------------------------------------------------------+
|                   Go Backend (Fiber)                  |
|  - Auth Middleware & Session Validation (JWT/Cookie)  |
|  - Realtime Event Hub & SSE Streaming Engine          |
|  - SQLC Data Access Layer                             |
+-------------------------------------------------------+
                           |
               Binary pgx Connection Pool
                           v
+-------------------------------------------------------+
|                   PostgreSQL 16                       |
|  - Relational Schema (Workspaces, Tasks, Docs)        |
+-------------------------------------------------------+
` + "```" + `

## Backend Service Blueprint

` + "```go" + `
package main

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	app := fiber.New()
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "healthy"})
	})
	app.Listen(":3001")
}
` + "```" + `
`

	architectureHTML := `<h1>System Architecture 🏗️</h1>
<p>The Open ClickUp architecture decouples the frontend client SPA from the high-throughput Go backend service.</p>
<h2>Tech Stack</h2>
<ul>
<li><strong>Frontend</strong>: Next.js 16 (App Router), React 19, TipTap WYSIWYG, Tailwind CSS</li>
<li><strong>Backend API</strong>: Go 1.24, Fiber v2, pgxpool v5</li>
<li><strong>Database</strong>: PostgreSQL 16 with relational integrity and cascade deletes</li>
<li><strong>Realtime</strong>: Event-driven SSE (Server-Sent Events) hub</li>
</ul>
<h2>Architecture Diagram</h2>
<pre><code>+-------------------------------------------------------+
|                   Web Browser (SPA)                   |
|           Next.js 16 App + React 19 + TipTap          |
+-------------------------------------------------------+
                           |
             HTTP REST API | SSE Events
                           v
+-------------------------------------------------------+
|                   Go Backend (Fiber)                  |
|  - Auth Middleware &amp; Session Validation (JWT/Cookie)  |
|  - Realtime Event Hub &amp; SSE Streaming Engine          |
|  - SQLC Data Access Layer                             |
+-------------------------------------------------------+
                           |
               Binary pgx Connection Pool
                           v
+-------------------------------------------------------+
|                   PostgreSQL 16                       |
|  - Relational Schema (Workspaces, Tasks, Docs)        |
+-------------------------------------------------------+
</code></pre>
<h2>Backend Service Blueprint</h2>
<pre><code class="language-go">package main

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	app := fiber.New()
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "healthy"})
	})
	app.Listen(":3001")
}
</code></pre>`

	doc1Page2ID := cuid()
	_, err = pool.Exec(ctx, `
		INSERT INTO "DocPage" (id, doc_id, parent_page_id, title, content_markdown, content_html, icon, cover_image, position, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $9)
	`, doc1Page2ID, doc1ID, doc1Page1ID, "System Architecture", architectureMarkdown, architectureHTML, "🏗️", 2000.0, now)
	if err != nil {
		log.Fatalf("Failed to create doc 1 page 2: %v", err)
	}

	// Document 2: "Engineering Guidelines & Code Conventions" (Engineering Space)
	doc2ID := cuid()
	_, err = pool.Exec(ctx, `
		INSERT INTO "Doc" (id, workspace_id, space_id, folder_id, list_id, task_id, title, created_by_id, is_pinned, created_at, updated_at)
		VALUES ($1, $2, $3, NULL, NULL, NULL, $4, $5, $6, $7, $7)
	`, doc2ID, wsID, spaceMap["Engineering"], "Engineering Guidelines & Code Conventions", santiagoID, false, now)
	if err != nil {
		log.Fatalf("Failed to create doc 2: %v", err)
	}

	guidelinesMarkdown := `# Git & Code Review Standards 📐

Following strict version control and review conventions ensures codebase stability and smooth team velocity.

## Commit Message Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

` + "```" + `
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
` + "```" + `

### Allowed Types
* ` + "`feat`" + `: A new feature for end users or API consumers.
* ` + "`fix`" + `: A bug fix.
* ` + "`refactor`" + `: Code restructuring without modifying behavior.
* ` + "`test`" + `: Adding or correcting tests.
* ` + "`docs`" + `: Documentation updates.
* ` + "`perf`" + `: Performance improvements.
* ` + "`chore`" + `: Build tooling, dependency upgrades, or configuration.

## Pull Request Review Rules

1. **Atomic & Focused**: Keep PRs under 400 lines of diff where possible.
2. **Verification Required**: Include testing evidence and verify CI checks pass.
3. **Prompt Reviews**: Review teammates' pull requests within 24 business hours.
4. **Constructive Feedback**: Explain the *why* behind suggested revisions.
`

	guidelinesHTML := `<h1>Git & Code Review Standards 📐</h1>
<p>Following strict version control and review conventions ensures codebase stability and smooth team velocity.</p>
<h2>Commit Message Conventions</h2>
<p>We follow the <a href="https://www.conventionalcommits.org/">Conventional Commits</a> specification:</p>
<pre><code>&lt;type&gt;(&lt;scope&gt;): &lt;subject&gt;

[optional body]

[optional footer(s)]
</code></pre>
<h3>Allowed Types</h3>
<ul>
<li><code>feat</code>: A new feature for end users or API consumers.</li>
<li><code>fix</code>: A bug fix.</li>
<li><code>refactor</code>: Code restructuring without modifying behavior.</li>
<li><code>test</code>: Adding or correcting tests.</li>
<li><code>docs</code>: Documentation updates.</li>
<li><code>perf</code>: Performance improvements.</li>
<li><code>chore</code>: Build tooling, dependency upgrades, or configuration.</li>
</ul>
<h2>Pull Request Review Rules</h2>
<ol>
<li><strong>Atomic &amp; Focused</strong>: Keep PRs under 400 lines of diff where possible.</li>
<li><strong>Verification Required</strong>: Include testing evidence and verify CI checks pass.</li>
<li><strong>Prompt Reviews</strong>: Review teammates' pull requests within 24 business hours.</li>
</ol>`

	doc2Page1ID := cuid()
	_, err = pool.Exec(ctx, `
		INSERT INTO "DocPage" (id, doc_id, parent_page_id, title, content_markdown, content_html, icon, cover_image, position, created_at, updated_at)
		VALUES ($1, $2, NULL, $3, $4, $5, $6, NULL, $7, $8, $8)
	`, doc2Page1ID, doc2ID, "Git & Code Review Standards", guidelinesMarkdown, guidelinesHTML, "📐", 1000.0, now)
	if err != nil {
		log.Fatalf("Failed to create doc 2 page 1: %v", err)
	}

	fmt.Println("📄 Seeded demo docs successfully")

	fmt.Println("✅ Database successfully seeded!")
	fmt.Println("   Demo account: santiago@clickuppp.dev / password")
}
