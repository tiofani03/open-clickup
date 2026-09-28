import { Hono } from "hono";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createSession, requireUser } from "../auth";
import { prisma } from "@/lib/db";
import { readJson } from "../helpers";
import { ApiError } from "@/lib/api-helpers";
import { publish } from "@/lib/events";

export const meRoutes = new Hono();

// POST /api/me (switch user for dev)
const switchSchema = z.object({ userId: z.string().min(1) });
meRoutes.post("/", async (c) => {
  const { userId } = await readJson(c, switchSchema);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");
  await createSession(c, userId);
  return c.json({ ok: true });
});

// GET /api/me/tasks
meRoutes.get("/tasks", async (c) => {
  const user = await requireUser(c);
  const tasks = await prisma.task.findMany({
    where: { archived: false, assignees: { some: { userId: user.id } } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      listId: true,
      priority: true,
      startDate: true,
      dueDate: true,
      status: { select: { name: true, color: true, type: true } },
      list: { select: { name: true, space: { select: { name: true, color: true } } } },
    },
  });
  return c.json({ tasks });
});

// PATCH /api/me/profile
const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

meRoutes.patch("/profile", async (c) => {
  const user = await requireUser(c);
  const body = await readJson(c, profileSchema);
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.color !== undefined) data.color = body.color;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, name: true, color: true, avatarUrl: true },
  });
  publish({ type: "bootstrap" });
  return c.json(updated);
});

// POST /api/me/avatar
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

meRoutes.post("/avatar", async (c) => {
  const user = await requireUser(c);
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) throw new ApiError(400, "No file provided");
  if (!file.type.startsWith("image/")) throw new ApiError(400, "Avatar must be an image");
  if (file.size > MAX_AVATAR_SIZE) throw new ApiError(413, "Image exceeds 5 MB limit");

  const ext = (path.extname(file.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "")) || ".png";
  const stored = `avatar-${randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: `/uploads/${stored}` },
    select: { id: true, avatarUrl: true },
  });
  publish({ type: "bootstrap" });
  return c.json(updated);
});
