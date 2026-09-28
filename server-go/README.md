# Open ClickUp — Go Backend (Fiber + sqlc)

Blazing-fast, ultra-low-memory backend for Open ClickUp written in **Go 1.24**, **Go Fiber v2**, and **sqlc** (raw SQL queries with type-safe generated code).

- **Memory Usage:** ~2.5 MB RAM in production!
- **Framework:** Go Fiber v2
- **Database Access:** sqlc + pgx/v5 (no ORM overhead or lock-in)
- **Realtime:** Native SSE (`/api/stream`) with thread-safe Goroutines and channels
- **Auth:** Scrypt password hashing (100% byte-for-byte compatible with Node.js scrypt) + 30-day session cookies

---

## Directory Structure

```
server-go/
├── cmd/
│   ├── server/             # API server entrypoint
│   └── seed/               # Standalone database seeder
├── db/
│   ├── migrations/         # Standalone SQL migrations (.up.sql / .down.sql)
│   ├── queries/            # sqlc SQL query definitions
│   └── schema.sql          # PostgreSQL DDL schema definition
├── internal/
│   ├── auth/               # Password hashing (scrypt) & session / RBAC middleware
│   ├── db/                 # Auto-generated sqlc Go models and queries
│   ├── handlers/           # Fiber HTTP handlers (auth, bootstrap, tasks, lists, etc.)
│   ├── realtime/           # Thread-safe pub/sub hub for Server-Sent Events
│   └── service/            # Business logic (e.g. list creation with default statuses)
└── sqlc.yaml               # sqlc configuration file
```

---

## 🚀 Running on a VPS or Local Machine

### 1. Requirements
- Go 1.24+ (or run via Docker)
- PostgreSQL 15+

### 2. Database Setup & Migration

Set the `DATABASE_URL` environment variable:
```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/open_clickup?sslmode=disable"
```

Apply the initial database schema:
```bash
# Using psql:
psql "$DATABASE_URL" -f db/migrations/000001_init.up.sql

# Or using golang-migrate:
migrate -path db/migrations -database "$DATABASE_URL" up
```

### 3. Seed Demo Data

Run the standalone Go seeder to populate demo users, workspace, spaces, lists, statuses, and tasks:
```bash
go run ./cmd/seed
```

Demo Credentials:
- **Email:** `santiago@clickuppp.dev`
- **Password:** `password`

### 4. Run the Go Server

```bash
export PORT=8080
export STATIC_DIR="../dist" # Path to built Vite frontend assets
go run ./cmd/server
```

In development with Vite:
- Start the Go backend on port 8080: `go run ./cmd/server`
- Start the Vite dev server on port 3000: `pnpm dev` (Vite dev server will proxy `/api/*` to `http://localhost:8080`).

---

## 🐳 Production Deployment with Docker Compose

For a single-command production deployment running both the Go backend and Vite SPA on port 3000:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Check logs:
```bash
docker compose -f docker-compose.prod.yml logs -f app
```

Check resource usage:
```bash
docker stats open-clickup-app-1
```

---

## 🛠️ Code Generation with sqlc

When editing SQL queries in `db/queries/*.sql`:
```bash
sqlc generate
```
This updates the type-safe models and methods in `internal/db/`.
