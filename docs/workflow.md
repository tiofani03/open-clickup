# Working on Open ClickUp — the workflow

## Get it running

```bash
docker compose up -d        # Postgres on :5544
pnpm install
(cd server-go && go run ./cmd/migrate)
(cd server-go && go run ./cmd/seed) # sample workspace "Acme Inc.", 5 users, tasks…
pnpm dev:all                # Vite :3000 + Go Fiber :8080
```

Demo login: `santiago@clickuppp.dev` / `password` (all seeded users use
`password`). Full command list is in [CLAUDE.md](../CLAUDE.md).

## Pick something to do

The roadmap is GitHub Issues labeled `roadmap`:

```bash
gh issue list --label roadmap
gh issue list --label "good first issue"
```

Comment on / assign the issue you take. New ideas → file an issue, don't build ad
hoc.

## The end-to-end feature recipe

Most features touch the whole stack in this order:

1. **Schema** — add paired SQL migrations under `server-go/db/migrations/`,
   update `server-go/db/schema.sql`, update queries under
   `server-go/db/queries/`, then run `sqlc generate` and restart the Go server.
2. **Query shape / types** — add include-shapes + payload types in
   `lib/queries.ts` (single source of truth for API↔client).
3. **Service** — transactional business logic in `server-go/internal/service/`;
   emit history records for state that reports must preserve.
4. **Route** — Fiber handlers in `server-go/internal/handlers/` and route wiring
   in `server-go/cmd/server/main.go`; require authentication and resource-scoped
   role checks for every mutation.
5. **Hook** — a TanStack Query hook in `lib/hooks.ts` (`apiGet`/`apiSend`),
   optimistic if it helps.
6. **UI** — components under `components/**`, using `--cu-*` tokens and existing
   primitives/menus.
7. **Test** — unit test for pure logic; integration test for core mutations.
8. **Verify** — `pnpm exec tsc --noEmit`, `pnpm test`, `go test ./...`, build,
   and exercise it with curl plus Playwright/browser.
9. **Commit & push**, then **check CI** (`gh run list`).

## Verifying like we do

- **API:** `curl` the happy path, an auth failure (no cookie → 401), and a
  permission failure (wrong role → 403). Log in via
  `POST /api/auth/login`, reuse the cookie jar.
- **UI:** open the page in a browser, take a screenshot, actually look at it. This
  has caught real bugs (e.g. a flex-collapsed task title) that typecheck missed.
- **dnd-kit drags in tests:** synthetic `PointerEvent`s need `isPrimary: true`
  plus several spaced `pointermove`s, or the sensor ignores them.

## Commits & PRs

- Branch off `main`; conventional, imperative commit subjects with a short body
  explaining *what changed and why* (look at `git log` for the house style).
- Keep commits scoped to one change; include the verification you did.
- CI (`.github/workflows/ci.yml`) runs lint + tsc + unit tests + build, and a
  Playwright e2e job, both against a Postgres service.

## Where progress and decisions are recorded

- **Decisions** (why we chose X over Y) → an ADR in
  [decisions/](decisions/).
- **Gotchas / conventions** → the conventions section of [CLAUDE.md](../CLAUDE.md).
- **Roadmap / future work** → GitHub Issues (`roadmap`).
- **Product/scope** → [vision.md](vision.md). **User-facing** → README.
- If you're a Claude agent with persistent memory, also keep your working notes
  there — but anything a *future* contributor needs belongs in the repo docs
  above, not only in private memory.
