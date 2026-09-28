# Vite Full Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the project from Next.js 16 to a high-performance **Vite + React 19 SPA** frontend paired with a lightweight **Hono (Node.js)** backend, preserving all features (5 views, hierarchy, real-time SSE, drag-and-drop, rich text) with faster HMR and lower memory footprint.

**Architecture:** 
- **Frontend:** Pure Vite SPA with React 19, Tailwind CSS 4, React Router v7 (or TanStack Router), TanStack Query v5, and Radix UI.
- **Backend:** Standalone Node.js server powered by [Hono](https://hono.dev) using `@hono/node-server`, mounting Prisma 7, SSE event streams, and existing business logic (`lib/tasks.ts`, `lib/hierarchy.ts`).
- **Production Runtime:** Single lightweight Node.js process where Hono serves API routes at `/api/*` and serves the pre-compiled Vite SPA static assets from `dist/` on port 3000.

**Tech Stack:** 
- Vite 6+
- React 19 + React DOM 19
- React Router v7 (`react-router`)
- Tailwind CSS 4 (`@tailwindcss/vite`)
- Hono (`hono`, `@hono/node-server`)
- Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`)
- TanStack Query v5, `@dnd-kit`, Tiptap 3

**Spec:** [docs/vision.md](docs/vision.md) and [CLAUDE.md](CLAUDE.md)

## Global Constraints
- Preserve exact UX, colors (`--cu-*` design tokens), keyboard shortcuts (⌘K), and feature parity.
- Zero loss of functionality in all 5 views (List, Board, Calendar, Gantt, Table) and Task Modal.
- Maintain existing database schema (`prisma/schema.prisma`) without data migration breaking changes.
- Eliminate all Next.js dependencies (`next`, `next/navigation`, `next/link`, `next/server`, `next/headers`).
- Preserve single-container production deployment capability (`docker-compose.prod.yml` mapping to `:3000`).

---

## File Structure Map

```
├── server/                    # New: Standalone Backend (Hono)
│   ├── index.ts               # Hono app entrypoint, middleware, static file serving
│   ├── routes/                # Ported from app/api/**
│   │   ├── auth.ts
│   │   ├── tasks.ts
│   │   ├── lists.ts
│   │   ├── spaces.ts
│   │   ├── folders.ts
│   │   ├── comments.ts
│   │   ├── checklists.ts
│   │   ├── views.ts
│   │   ├── templates.ts
│   │   ├── stream.ts          # SSE stream
│   │   └── me.ts
│   └── context.ts             # Auth context & session helpers
├── src/                       # New: Vite Frontend Root
│   ├── main.tsx               # Client entrypoint
│   ├── App.tsx                # App routing & providers
│   ├── index.html             # Moved to root or src/
│   ├── components/            # Migrated from root components/
│   └── lib/                   # Client-safe utilities & TanStack Query hooks
├── lib/                       # Shared business logic & DB (lib/db.ts, lib/tasks.ts)
├── vite.config.ts             # New: Vite config with React, Tailwind, and /api proxy
└── Dockerfile                 # Revamped: Multi-stage build for Vite + Hono
```

---

## Tasks

### Task 1: Scaffolding Vite Tooling & Dependencies

**Files:**
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Modify: `package.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: Tailwind 4 CSS config and React 19
- Produces: Working Vite dev server with proxy to API

- [ ] **Step 1: Install Vite, Hono, and React Router dependencies**
  Remove `next`, `eslint-config-next`.
  Add `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `hono`, `@hono/node-server`, `react-router`, and `@types/react-router`.

- [ ] **Step 2: Configure `vite.config.ts`**
  Set up React plugin, Tailwind CSS plugin, path aliases (`@/` -> `./src` and `@shared/` -> `./lib`), and development proxy:
  ```ts
  import { defineConfig } from "vite";
  import react from "@vitejs/plugin-react";
  import tailwindcss from "@tailwindcss/vite";
  import path from "path";

  export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@shared": path.resolve(__dirname, "./lib"),
      },
    },
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
  });
  ```

- [ ] **Step 3: Create `index.html` and `src/main.tsx` entrypoint**
  Create root HTML shell with `<div id="root"></div>` and script tag pointing to `src/main.tsx`.

- [ ] **Step 4: Verify Vite build and dev server startup**
  Run: `pnpm vite build`
  Expected: Clean compilation into `dist/`.

- [ ] **Step 5: Commit scaffolding**
  `git commit -m "feat(vite): scaffold vite, react router, and hono dependencies"`

---

### Task 2: Backend API Engine Migration (Hono Server)

**Files:**
- Create: `server/index.ts`
- Create: `server/auth.ts`
- Create: `server/routes/*.ts` (tasks, lists, spaces, stream, auth, me, health)
- Test: `tests/api-hono.test.ts`

**Interfaces:**
- Consumes: `lib/tasks.ts`, `lib/hierarchy.ts`, `lib/db.ts`, `lib/events.ts`
- Produces: Full REST API + SSE endpoint on port 3001

- [ ] **Step 1: Create Hono server core and cookie auth helper**
  Replace `cookies()` from `next/headers` with Hono's `getCookie(c, 'cu_session')` and `setCookie(c, ...)`:
  ```ts
  import { Hono } from "hono";
  import { getCookie, setCookie } from "hono/cookie";
  // Session validation and RBAC middleware
  ```

- [ ] **Step 2: Port route handlers from `app/api/**` to Hono routes**
  Translate Next.js `NextResponse.json(...)` to Hono `return c.json(...)`.
  Since both Next.js App Router and Hono use standard Web `Request`/`Response`, query params and JSON bodies map directly:
  - `await req.json()` $\rightarrow$ `await c.req.json()`
  - `new URL(req.url).searchParams` $\rightarrow$ `c.req.query()`

- [ ] **Step 3: Port SSE realtime stream (`server/routes/stream.ts`)**
  Use Hono's `streamSSE`:
  ```ts
  import { streamSSE } from "hono/streaming";

  app.get("/api/stream", async (c) => {
    return streamSSE(c, async (stream) => {
      const listener = (event: TaskEvent) => {
        stream.writeSSE({ data: JSON.stringify(event) });
      };
      eventBus.on("task", listener);
      stream.onAbort(() => eventBus.off("task", listener));
      while (true) { await stream.sleep(15000); await stream.writeSSE({ comment: "ping" }); }
    });
  });
  ```

- [ ] **Step 4: Run integration test against Hono endpoints**
  Verify login, bootstrap, and task listing endpoints return expected JSON.
  Run: `pnpm test:api`
  Expected: PASS.

- [ ] **Step 5: Commit backend migration**
  `git commit -m "feat(server): migrate next.js route handlers to hono server"`

---

### Task 3: Client Routing & App Shell Migration

**Files:**
- Create: `src/App.tsx`
- Move/Adapt: `components/app-shell.tsx` -> `src/components/app-shell.tsx`
- Move/Adapt: `app/(app)/l/[listId]/page.tsx` -> `src/pages/list-page-route.tsx`
- Move/Adapt: `app/(app)/home/page.tsx` -> `src/pages/home-page-route.tsx`
- Move/Adapt: `app/login/page.tsx` -> `src/pages/login-page-route.tsx`

**Interfaces:**
- Consumes: `react-router` (`useNavigate`, `useLocation`, `useParams`, `useSearchParams`, `Link`)
- Produces: SPA route tree replacing Next.js App Router file routing

- [ ] **Step 1: Replace Next.js navigation hooks**
  Across all UI components, replace:
  - `import { useRouter, usePathname, useSearchParams } from "next/navigation"` $\rightarrow$ `useNavigate`, `useLocation`, `useSearchParams` from `react-router`.
  - `import Link from "next/link"` $\rightarrow$ `import { Link } from "react-router"`.

- [ ] **Step 2: Construct the SPA Route Hierarchy in `src/App.tsx`**
  ```tsx
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<AppShell />}>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/l/:listId" element={<ListPageRoute />} />
    </Route>
  </Routes>
  ```

- [ ] **Step 3: Connect Task Modal URL Parameter Query Sync**
  Ensure clicking a task updates search params `?task=<id>` via `setSearchParams` and renders `<TaskModal>` transparently without full reload.

- [ ] **Step 4: Commit client routing**
  `git commit -m "feat(client): implement react-router v7 app shell and routes"`

---

### Task 4: Move Components, Views, and Styling

**Files:**
- Move: `components/*` -> `src/components/*`
- Move: `app/globals.css` -> `src/globals.css`
- Adapt: `src/components/views/*` (list, board, calendar, gantt, table)
- Adapt: `src/components/task/task-modal.tsx` and Tiptap rich-editor

**Interfaces:**
- Consumes: `@dnd-kit`, `@tiptap`, Radix UI primitives
- Produces: Interactive ClickUp views running in pure browser runtime

- [ ] **Step 1: Relocate and verify CSS design tokens**
  Import `@tailwindcss/vite` and `--cu-*` variables in `src/globals.css`. Ensure dark mode class selector works properly.

- [ ] **Step 2: Adapt Tiptap rich editor**
  Remove SSR workaround (`immediatelyRender: false`), as Vite runs entirely as a client-side SPA where standard browser DOM is guaranteed.

- [ ] **Step 3: Verify DnD Kit in List & Board Views**
  Confirm collision detection and drag sensors work without hydration mismatches.

- [ ] **Step 4: Clean up old Next.js files**
  Safely remove `app/` directory and `next.config.ts`.

- [ ] **Step 5: Commit view migration**
  `git commit -m "refactor(views): migrate all views and components to vite SPA"`

---

### Task 5: Production Server & Dockerfile Revamp

**Files:**
- Modify: `server/index.ts` (add static serving from `dist/`)
- Modify: `Dockerfile`
- Modify: `docker-compose.prod.yml`
- Modify: `package.json` (`scripts: { "dev", "build", "start" }`)

**Interfaces:**
- Consumes: Built `dist/` directory and Hono server
- Produces: Production Docker container running on port 3000

- [ ] **Step 1: Add SPA fallback static serving to Hono**
  ```ts
  import { serveStatic } from "@hono/node-server/serve-static";

  // API routes mounted under /api
  app.route("/api", api);

  // Serve static assets from Vite build
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
  ```

- [ ] **Step 2: Update `Dockerfile` to multi-stage build**
  - Stage 1 (`deps`): Install dependencies with pnpm.
  - Stage 2 (`build`): Run `pnpm prisma generate` and `pnpm vite build`.
  - Stage 3 (`runner`): Alpine Node 22, copy `server/`, `lib/`, `dist/`, and `node_modules/`.
  - Start command: `CMD ["sh", "-c", "pnpm prisma migrate deploy && tsx server/index.ts"]`.

- [ ] **Step 3: Test production build locally and via Docker**
  Run: `docker compose -f docker-compose.prod.yml up -d --build`
  Verify: Container starts in <2 seconds and responds to `http://localhost:3000`.

- [ ] **Step 4: Commit Docker & production configuration**
  `git commit -m "feat(docker): update dockerfile and prod compose for vite + hono"`

---

### Task 6: Testing & Quality Assurance

**Files:**
- Modify: `vitest.config.ts`
- Modify: `playwright.config.ts`
- Run: `tests/**/*.test.ts`
- Run: `e2e/app.spec.ts`

**Interfaces:**
- Consumes: Test runner configs
- Produces: Green CI test reports

- [ ] **Step 1: Update Vitest configuration for Vite**
  Align aliases and ensure DOM unit tests pass under `vitest run`.

- [ ] **Step 2: Run end-to-end tests with Playwright**
  Run: `pnpm test:e2e`
  Expected: All user flows (login, task creation, view switching, drag-and-drop) pass.

- [ ] **Step 3: Commit final verification**
  `git commit -m "test: verify all unit and e2e suites on vite architecture"`
