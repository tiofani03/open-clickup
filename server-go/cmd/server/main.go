package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"open-clickup-server/internal/auth"
	"open-clickup-server/internal/db"
	"open-clickup-server/internal/handlers"
)

func main() {
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://clickuppp:clickuppp@localhost:5544/clickuppp?sslmode=disable"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Printf("Warning: Database ping failed: %v", err)
	} else {
		log.Println("Connected to PostgreSQL database")
	}

	q := db.New(pool)

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowCredentials: true,
		AllowOriginsFunc: func(origin string) bool { return true },
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
	}))

	// API routes
	api := app.Group("/api")
	api.Get("/health", handlers.HealthHandler(pool))

	authH := handlers.NewAuthHandler(q)
	authAPI := api.Group("/auth")
	authAPI.Post("/login", authH.Login)
	authAPI.Post("/signup", authH.Signup)
	authAPI.Post("/logout", authH.Logout)

	api.Get("/me", auth.RequireUser(q), authH.Me)

	// Bootstrap
	bootstrapH := handlers.NewBootstrapHandler(pool, q)
	api.Get("/bootstrap", auth.RequireUser(q), bootstrapH.GetBootstrap)

	// Hierarchy: Spaces, Folders, Lists
	hierH := handlers.NewHierarchyHandler(pool, q)
	spaces := api.Group("/spaces", auth.RequireUser(q))
	spaces.Post("/", auth.RequireRole(q, db.MemberRoleMEMBER), hierH.CreateSpace)
	spaces.Patch("/:spaceId", auth.RequireRole(q, db.MemberRoleMEMBER), hierH.UpdateSpace)
	spaces.Delete("/:spaceId", auth.RequireRole(q, db.MemberRoleMEMBER), hierH.DeleteSpace)

	folders := api.Group("/folders", auth.RequireUser(q))
	folders.Post("/", auth.RequireRole(q, db.MemberRoleMEMBER), hierH.CreateFolder)
	folders.Patch("/:folderId", auth.RequireRole(q, db.MemberRoleMEMBER), hierH.UpdateFolder)
	folders.Delete("/:folderId", auth.RequireRole(q, db.MemberRoleMEMBER), hierH.DeleteFolder)

	lists := api.Group("/lists", auth.RequireUser(q))
	lists.Post("/", auth.RequireRole(q, db.MemberRoleMEMBER), hierH.CreateList)
	lists.Get("/:listId", hierH.GetList)
	lists.Patch("/:listId", auth.RequireRole(q, db.MemberRoleMEMBER), hierH.UpdateList)
	lists.Delete("/:listId", auth.RequireRole(q, db.MemberRoleMEMBER), hierH.DeleteList)
	lists.Post("/:listId/favorite", hierH.ToggleFavorite)

	// Statuses & Views
	statusH := handlers.NewStatusesHandler(q)
	api.Patch("/statuses/:statusId", auth.RequireRole(q, db.MemberRoleMEMBER), statusH.UpdateStatus)
	api.Delete("/statuses/:statusId", auth.RequireRole(q, db.MemberRoleMEMBER), statusH.DeleteStatus)

	viewH := handlers.NewViewsHandler(q)
	api.Patch("/views/:viewId", auth.RequireUser(q), viewH.UpdateViewConfig)

	// Stream (SSE realtime)
	api.Get("/stream", handlers.StreamHandler)

	// Search
	searchH := handlers.NewSearchHandler(pool)
	api.Get("/search", auth.RequireUser(q), searchH.Search)

	// Notifications
	notifH := handlers.NewNotificationsHandler(q)
	api.Get("/notifications", auth.RequireUser(q), notifH.GetNotifications)
	api.Post("/notifications/read", auth.RequireUser(q), notifH.MarkRead)

	// Tasks
	taskH := handlers.NewTasksHandler(pool, q)
	api.Get("/me/tasks", auth.RequireUser(q), taskH.GetMyTasks)
	tasks := api.Group("/tasks", auth.RequireUser(q))
	tasks.Post("/", auth.RequireRole(q, db.MemberRoleMEMBER), taskH.CreateTask)
	tasks.Post("/bulk", auth.RequireRole(q, db.MemberRoleMEMBER), taskH.BulkTasks)
	tasks.Get("/:taskId", taskH.GetTask)
	tasks.Patch("/:taskId", auth.RequireRole(q, db.MemberRoleMEMBER), taskH.UpdateTask)
	tasks.Delete("/:taskId", auth.RequireRole(q, db.MemberRoleMEMBER), taskH.DeleteTask)

	// Comments & Reactions
	commentH := handlers.NewCommentsHandler(pool, q)
	tasks.Post("/:taskId/comments", commentH.CreateComment)
	comments := api.Group("/comments", auth.RequireUser(q))
	comments.Patch("/:commentId", commentH.UpdateComment)
	comments.Delete("/:commentId", commentH.DeleteComment)
	comments.Post("/:commentId/reactions", commentH.ToggleReaction)

	// Checklists
	checklistH := handlers.NewChecklistsHandler(pool, q)
	tasks.Post("/:taskId/checklists", checklistH.CreateChecklist)
	checklists := api.Group("/checklists", auth.RequireUser(q))
	checklists.Patch("/:checklistId", checklistH.UpdateChecklist)
	checklists.Delete("/:checklistId", checklistH.DeleteChecklist)
	checklists.Post("/:checklistId/items", checklistH.CreateItem)

	checklistItems := api.Group("/checklist-items", auth.RequireUser(q))
	checklistItems.Patch("/:itemId", checklistH.UpdateItem)
	checklistItems.Delete("/:itemId", checklistH.DeleteItem)

	// Docs & Doc Pages
	docH := handlers.NewDocsHandler(pool, q)
	docs := api.Group("/docs", auth.RequireUser(q))
	docs.Get("/", docH.ListDocs)
	docs.Post("/", auth.RequireRole(q, db.MemberRoleMEMBER), docH.CreateDoc)
	docs.Get("/:docId", docH.GetDoc)
	docs.Patch("/:docId", auth.RequireRole(q, db.MemberRoleMEMBER), docH.UpdateDoc)
	docs.Delete("/:docId", auth.RequireRole(q, db.MemberRoleMEMBER), docH.DeleteDoc)
	docs.Post("/:docId/pages", auth.RequireRole(q, db.MemberRoleMEMBER), docH.CreateDocPage)
	docs.Get("/:docId/pages/:pageId", docH.GetDocPage)
	docs.Patch("/:docId/pages/:pageId", auth.RequireRole(q, db.MemberRoleMEMBER), docH.UpdateDocPage)
	docs.Delete("/:docId/pages/:pageId", auth.RequireRole(q, db.MemberRoleMEMBER), docH.DeleteDocPage)
	docs.Post("/:docId/pages/:pageId/publish", auth.RequireRole(q, db.MemberRoleMEMBER), docH.PublishDocPage)
	docs.Post("/:docId/pages/:pageId/discard-draft", auth.RequireRole(q, db.MemberRoleMEMBER), docH.DiscardDocPageDraft)
	docs.Get("/:docId/pages/:pageId/comments", docH.ListDocComments)
	docs.Post("/:docId/pages/:pageId/comments", auth.RequireRole(q, db.MemberRoleMEMBER), docH.CreateDocComment)
	docs.Delete("/:docId/pages/:pageId/comments/:commentId", auth.RequireRole(q, db.MemberRoleMEMBER), docH.DeleteDocComment)

	// File Uploads
	uploadDir := "./data/uploads"
	_ = os.MkdirAll(uploadDir, 0755)
	uploadH := handlers.NewUploadHandler(uploadDir)
	api.Post("/upload", auth.RequireUser(q), uploadH.Upload)
	app.Static("/uploads", uploadDir)

	// In production, serve built SPA from ./dist
	if os.Getenv("NODE_ENV") == "production" {
		app.Static("/", "./dist")
		app.Get("*", func(c *fiber.Ctx) error {
			return c.SendFile("./dist/index.html")
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Open ClickUp Go Fiber server running on http://localhost:%s\n", port)
	log.Fatal(app.Listen(":" + port))
}
