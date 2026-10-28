package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgresql://clickuppp:clickuppp@localhost:5544/clickuppp?sslmode=disable"
	}
	directory := os.Getenv("MIGRATIONS_DIR")
	if directory == "" {
		directory = "db/migrations"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS public."_go_migrations" (
			name text PRIMARY KEY,
			"appliedAt" timestamptz NOT NULL DEFAULT now()
		)
	`); err != nil {
		log.Fatal(err)
	}
	if err := baselineExistingSchema(ctx, pool); err != nil {
		log.Fatal(err)
	}

	entries, err := filepath.Glob(filepath.Join(directory, "*.up.sql"))
	if err != nil {
		log.Fatal(err)
	}
	sort.Strings(entries)
	for _, path := range entries {
		name := filepath.Base(path)
		var applied bool
		if err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM public."_go_migrations" WHERE name = $1)`, name).Scan(&applied); err != nil {
			log.Fatal(err)
		}
		if applied {
			fmt.Printf("skip %s\n", name)
			continue
		}
		sql, err := os.ReadFile(path)
		if err != nil {
			log.Fatal(err)
		}
		tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			log.Fatal(err)
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("apply %s: %v", name, err)
		}
		// The legacy initial schema dump clears search_path. Restore it before
		// recording the migration and before this pooled connection is reused.
		if _, err := tx.Exec(ctx, `SELECT pg_catalog.set_config('search_path', 'public', false)`); err != nil {
			_ = tx.Rollback(ctx)
			log.Fatal(err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO public."_go_migrations" (name) VALUES ($1)`, name); err != nil {
			_ = tx.Rollback(ctx)
			log.Fatal(err)
		}
		if err := tx.Commit(ctx); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("applied %s\n", name)
	}
	if len(entries) == 0 {
		log.Fatalf("no .up.sql migrations found in %s", strings.TrimSpace(directory))
	}
}

// Older checkouts applied SQL files directly before _go_migrations existed.
// Record only migrations whose terminal schema artifact is already present so
// adopting the runner does not try to recreate production objects.
func baselineExistingSchema(ctx context.Context, pool *pgxpool.Pool) error {
	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM public."_go_migrations"`).Scan(&count); err != nil || count > 0 {
		return err
	}
	checks := []struct {
		name  string
		query string
	}{
		{"000001_init.up.sql", `SELECT to_regclass('public."Workspace"') IS NOT NULL`},
		{"000002_create_docs.up.sql", `SELECT to_regclass('public."DocPage"') IS NOT NULL`},
		{"000003_add_doc_drafts_and_comments.up.sql", `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DocPage' AND column_name = 'draft_markdown')`},
		{"000004_add_sprints.up.sql", `SELECT to_regclass('public."SprintTask"') IS NOT NULL`},
	}
	for _, check := range checks {
		var exists bool
		if err := pool.QueryRow(ctx, check.query).Scan(&exists); err != nil {
			return err
		}
		if exists {
			if _, err := pool.Exec(ctx, `INSERT INTO public."_go_migrations" (name) VALUES ($1) ON CONFLICT DO NOTHING`, check.name); err != nil {
				return err
			}
			fmt.Printf("baselined %s\n", check.name)
		}
	}
	return nil
}
