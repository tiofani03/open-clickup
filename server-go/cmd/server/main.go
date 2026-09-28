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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Open ClickUp Go Fiber server running on http://localhost:%s\n", port)
	log.Fatal(app.Listen(":" + port))
}
