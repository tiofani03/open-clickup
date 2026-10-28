@AGENTS.md

# Open ClickUp — a ClickUp clone

Feature-parity clone of ClickUp's project/task management (no AI features). UX aims to be identical to ClickUp.

## Commands

```bash
docker compose up -d      # start Postgres (localhost:5544)
pnpm dev                  # Vite frontend only on :3000
pnpm dev:all              # Vite :3000 + Go Fiber API :8080
(cd server-go && go run ./cmd/seed)  # reset and seed demo data
(cd server-go && go test ./...)      # backend tests
pnpm exec tsc --noEmit    # frontend typecheck
```

## Stack

Vite · React 19 · TypeScript · Tailwind 4 · Go Fiber · sqlc/pgx + Postgres · @dnd-kit · Radix UI · TanStack Query · tiptap (rich text) · date-fns · lucide-react.

## Architecture

- **SPA**: Vite serves React Router routes from `src/App.tsx`. TanStack Query handles REST state; Vite proxies `/api` and `/uploads` to Fiber.
- **Routing compatibility**: imports from `next/link` and `next/navigation` resolve to adapters in `src/lib/compat/`; Next.js is not installed.
- **Data layer**: SQL lives in `server-go/db/queries/`, generated sqlc code in `server-go/internal/db/`, transactions in `server-go/internal/service/`, handlers in `server-go/internal/handlers/`, and frontend contracts/hooks in `lib/queries.ts` + `lib/hooks.ts`.
- **Auth**: server-side sessions and RBAC live in `server-go/internal/auth/`; mutations also perform resource-scoped role checks.
- **View state**: `lib/view-state.ts` (filters/sort/groupBy applied client-side in `list-page.tsx` via `applyViewState`), `lib/grouping.ts` (`groupTasks` for List view group-by).
- **Components**: `components/views/*` (list/board/calendar/gantt/table + filter-sort + custom-field controls), `components/menus/*` (status/priority/assignee/date/tag controls), `components/task/*` (modal, checklists), `components/status/*` (status manager), `components/sidebar/*`.

## Data model (`server-go/db/schema.sql`)

Workspace → Space → Folder? → List → Task → Subtask(parentId). Per-List: Status (typed NOT_STARTED/ACTIVE/DONE/CLOSED), CustomField (+options/values), View. Task has assignees, tags (space-level), comments (threaded, rich HTML), checklists, activity, watchers. Positions are Floats (fractional indexing).

## Conventions & gotchas

- **Generated DB code**: never hand-edit `server-go/internal/db/*.go`; edit SQL in `server-go/db/queries/` and regenerate with sqlc.
- **Migrations**: keep paired `.up.sql`/`.down.sql` files and mirror the resulting schema in `server-go/db/schema.sql`.
- **lucide-react@1.x renamed icons**: Kanban (not Trello), ChartNoAxesGantt (not GanttChartSquare), List (not AlignJustify), Ellipsis (not MoreHorizontal), TextAlignStart (not AlignLeft), SquareCheckBig (not CheckSquare), House (not Home).
- **tiptap**: editor and custom node extensions live under `components/doc/` and `components/ui/rich-editor.tsx`.
- **Styling**: ClickUp design tokens are CSS vars in `src/globals.css` (`--cu-*`) exposed as Tailwind colors (`cu-purple`, `cu-sidebar`, etc.). Rich text uses the `.rich` class.
- **Sprints**: tasks keep their home List. Sprint history is an immutable `SprintTask` membership ledger; see ADR 0008.
