import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ApiError } from "@/lib/api-helpers";

import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { bootstrapRoutes } from "./routes/bootstrap";
import { streamRoutes } from "./routes/stream";
import { tasksRoutes } from "./routes/tasks";
import { spacesRoutes } from "./routes/spaces";
import { foldersRoutes } from "./routes/folders";
import { listsRoutes } from "./routes/lists";
import { statusesRoutes } from "./routes/statuses";
import { viewsRoutes } from "./routes/views";
import { checklistsRoutes, checklistItemsRoutes } from "./routes/checklists";
import { commentsRoutes } from "./routes/comments";
import { timeEntriesRoutes, dependenciesRoutes, attachmentsRoutes } from "./routes/misc";
import { notificationsRoutes } from "./routes/notifications";
import { templatesRoutes } from "./routes/templates";
import { meRoutes } from "./routes/me";
import { searchRoutes } from "./routes/search";

export const app = new Hono();

// Global error handler
app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: err.message }, err.status as any);
  }
  const code = (err as { code?: string })?.code;
  if (code === "P2025") {
    return c.json({ error: "Not found" }, 404);
  }
  console.error("[server error]", err);
  return c.json({ error: "Internal server error" }, 500);
});

// Middleware
app.use("*", cors({
  origin: (origin) => origin || "*",
  credentials: true,
}));

// API sub-app
const api = new Hono();
api.route("/health", healthRoutes);
api.route("/auth", authRoutes);
api.route("/bootstrap", bootstrapRoutes);
api.route("/stream", streamRoutes);
api.route("/tasks", tasksRoutes);
api.route("/spaces", spacesRoutes);
api.route("/folders", foldersRoutes);
api.route("/lists", listsRoutes);
api.route("/statuses", statusesRoutes);
api.route("/views", viewsRoutes);
api.route("/checklists", checklistsRoutes);
api.route("/checklist-items", checklistItemsRoutes);
api.route("/comments", commentsRoutes);
api.route("/time-entries", timeEntriesRoutes);
api.route("/dependencies", dependenciesRoutes);
api.route("/attachments", attachmentsRoutes);
api.route("/notifications", notificationsRoutes);
api.route("/templates", templatesRoutes);
api.route("/me", meRoutes);
api.route("/search", searchRoutes);

app.route("/api", api);

// Serve uploads
app.use("/uploads/*", serveStatic({ root: "./public" }));

// In production, serve built SPA from dist/
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001));

if (process.env.NODE_ENV !== "test") {
  console.log(`🚀 Open ClickUp server running on http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
}
