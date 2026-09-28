import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "../auth";
import { readJson } from "../helpers";
import { ApiError } from "@/lib/api-helpers";

export const spacesRoutes = new Hono();

const COLORS = ["#7b68ee", "#fd71af", "#ff5722", "#ff7800", "#2ecd6f", "#1bbc9c", "#0ab1e8", "#9b59b6"];
const ICONS = ["🚀", "📣", "⚙️", "🎯", "💡", "📊", "🛠️", "🌱"];
const PALETTE = ["#3d8df5", "#2ecd6f", "#fd71af", "#f50000", "#ff5722", "#ff7800", "#f9d900", "#9b59b6", "#1bbc9c", "#0ab1e8"];

const createSchema = z.object({ name: z.string().trim().min(1, "name is required") });

spacesRoutes.post("/", async (c) => {
  await requireRole(c, "ADMIN");
  const { name } = await readJson(c, createSchema);
  const workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!workspace) throw new ApiError(404, "No workspace");

  const count = await prisma.space.count({ where: { workspaceId: workspace.id } });
  const space = await prisma.space.create({
    data: {
      workspaceId: workspace.id,
      name,
      color: COLORS[count % COLORS.length],
      icon: ICONS[count % ICONS.length],
      position: count,
    },
  });
  return c.json(space, 201);
});

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: z.string().optional(),
  icon: z.string().nullish(),
});

spacesRoutes.patch("/:spaceId", async (c) => {
  const spaceId = c.req.param("spaceId");
  await requireRole(c, "MEMBER");
  const data = await readJson(c, patchSchema);
  const space = await prisma.space.update({ where: { id: spaceId }, data });
  return c.json(space);
});

spacesRoutes.delete("/:spaceId", async (c) => {
  const spaceId = c.req.param("spaceId");
  await requireRole(c, "ADMIN");
  await prisma.space.delete({ where: { id: spaceId } });
  return c.json({ ok: true });
});

spacesRoutes.get("/:spaceId/tags", async (c) => {
  const spaceId = c.req.param("spaceId");
  const tags = await prisma.tag.findMany({ where: { spaceId }, orderBy: { name: "asc" } });
  return c.json(tags);
});

const tagSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  color: z.string().optional(),
});

spacesRoutes.post("/:spaceId/tags", async (c) => {
  const spaceId = c.req.param("spaceId");
  await requireRole(c, "MEMBER");
  const { name, color } = await readJson(c, tagSchema);
  const count = await prisma.tag.count({ where: { spaceId } });
  const tag = await prisma.tag.upsert({
    where: { spaceId_name: { spaceId, name } },
    create: { spaceId, name, color: color ?? PALETTE[count % PALETTE.length] },
    update: {},
  });
  return c.json(tag, 201);
});
