import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "../auth";
import { readJson } from "../helpers";

export const foldersRoutes = new Hono();

const createSchema = z.object({
  spaceId: z.string().min(1),
  name: z.string().trim().min(1, "name is required"),
});

foldersRoutes.post("/", async (c) => {
  await requireRole(c, "MEMBER");
  const { spaceId, name } = await readJson(c, createSchema);
  const last = await prisma.folder.findFirst({ where: { spaceId }, orderBy: { position: "desc" } });
  const folder = await prisma.folder.create({
    data: { spaceId, name, position: (last?.position ?? 0) + 1000 },
  });
  return c.json(folder, 201);
});

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  collapsed: z.boolean().optional(),
});

foldersRoutes.patch("/:folderId", async (c) => {
  const folderId = c.req.param("folderId");
  await requireRole(c, "MEMBER");
  const data = await readJson(c, patchSchema);
  const folder = await prisma.folder.update({ where: { id: folderId }, data });
  return c.json(folder);
});

foldersRoutes.delete("/:folderId", async (c) => {
  const folderId = c.req.param("folderId");
  await requireRole(c, "MEMBER");
  await prisma.folder.delete({ where: { id: folderId } });
  return c.json({ ok: true });
});
