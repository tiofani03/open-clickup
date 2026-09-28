import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "../auth";
import { readJson } from "../helpers";

export const checklistsRoutes = new Hono();

const patchSchema = z.object({ name: z.string().trim().min(1) });

checklistsRoutes.patch("/:checklistId", async (c) => {
  const checklistId = c.req.param("checklistId");
  await requireRole(c, "MEMBER");
  const { name } = await readJson(c, patchSchema);
  const checklist = await prisma.checklist.update({ where: { id: checklistId }, data: { name } });
  return c.json(checklist);
});

checklistsRoutes.delete("/:checklistId", async (c) => {
  const checklistId = c.req.param("checklistId");
  await requireRole(c, "MEMBER");
  await prisma.checklist.delete({ where: { id: checklistId } });
  return c.json({ ok: true });
});

const itemCreateSchema = z.object({ name: z.string().trim().min(1, "name is required") });

checklistsRoutes.post("/:checklistId/items", async (c) => {
  const checklistId = c.req.param("checklistId");
  await requireRole(c, "MEMBER");
  const { name } = await readJson(c, itemCreateSchema);
  const last = await prisma.checklistItem.findFirst({ where: { checklistId }, orderBy: { position: "desc" } });
  const item = await prisma.checklistItem.create({
    data: { checklistId, name, position: (last?.position ?? 0) + 1000 },
  });
  return c.json(item, 201);
});

export const checklistItemsRoutes = new Hono();

const itemPatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  resolved: z.boolean().optional(),
});

checklistItemsRoutes.patch("/:itemId", async (c) => {
  const itemId = c.req.param("itemId");
  await requireRole(c, "MEMBER");
  const data = await readJson(c, itemPatchSchema);
  const item = await prisma.checklistItem.update({ where: { id: itemId }, data });
  return c.json(item);
});

checklistItemsRoutes.delete("/:itemId", async (c) => {
  const itemId = c.req.param("itemId");
  await requireRole(c, "MEMBER");
  await prisma.checklistItem.delete({ where: { id: itemId } });
  return c.json({ ok: true });
});
