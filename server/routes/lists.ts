import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createListWithDefaults } from "@/lib/hierarchy";
import { getListData, taskInclude } from "@/lib/queries";
import { requireRole, requireUser } from "../auth";
import { readJson } from "../helpers";
import { ApiError } from "@/lib/api-helpers";
import { publish } from "@/lib/events";
import { StatusType, CustomFieldType } from "@/lib/generated/prisma/client";

export const listsRoutes = new Hono();

// POST /api/lists
const createSchema = z.object({
  spaceId: z.string().min(1),
  folderId: z.string().nullish(),
  name: z.string().trim().min(1, "name is required"),
});

listsRoutes.post("/", async (c) => {
  await requireRole(c, "MEMBER");
  const { spaceId, folderId, name } = await readJson(c, createSchema);
  const list = await createListWithDefaults({ spaceId, folderId: folderId ?? null, name });
  return c.json(list, 201);
});

// GET /api/lists/:listId
listsRoutes.get("/:listId", async (c) => {
  const listId = c.req.param("listId");
  await requireUser(c);
  const data = await getListData(listId);
  if (!data) throw new ApiError(404, "List not found");
  return c.json(data);
});

// PATCH /api/lists/:listId
const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: z.string().nullish(),
});

listsRoutes.patch("/:listId", async (c) => {
  const listId = c.req.param("listId");
  await requireRole(c, "MEMBER");
  const data = await readJson(c, patchSchema);
  const list = await prisma.list.update({ where: { id: listId }, data });
  return c.json(list);
});

// DELETE /api/lists/:listId
listsRoutes.delete("/:listId", async (c) => {
  const listId = c.req.param("listId");
  await requireRole(c, "MEMBER");
  await prisma.list.delete({ where: { id: listId } });
  return c.json({ ok: true });
});

// POST /api/lists/:listId/favorite
listsRoutes.post("/:listId/favorite", async (c) => {
  const listId = c.req.param("listId");
  const user = await requireUser(c);

  const existing = await prisma.favorite.findUnique({
    where: { userId_listId: { userId: user.id, listId } },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
  } else {
    await prisma.favorite.create({ data: { userId: user.id, listId } });
  }
  publish({ type: "bootstrap" });
  return c.json({ favorited: !existing });
});

// POST /api/lists/:listId/statuses
const statusCreateSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  color: z.string().optional(),
  type: z.enum(["NOT_STARTED", "ACTIVE", "DONE", "CLOSED"]).optional(),
});

listsRoutes.post("/:listId/statuses", async (c) => {
  const listId = c.req.param("listId");
  await requireRole(c, "MEMBER");
  const { name, color, type } = await readJson(c, statusCreateSchema);
  const last = await prisma.status.findFirst({ where: { listId }, orderBy: { position: "desc" } });
  const status = await prisma.status.create({
    data: {
      listId,
      name,
      color: color ?? "#87909e",
      type: (type as StatusType) ?? StatusType.NOT_STARTED,
      position: (last?.position ?? 0) + 1,
    },
  });
  return c.json(status, 201);
});

// PUT /api/lists/:listId/statuses (reorder)
const reorderSchema = z.object({ ids: z.array(z.string()).min(1) });
listsRoutes.put("/:listId/statuses", async (c) => {
  const listId = c.req.param("listId");
  await requireRole(c, "MEMBER");
  const { ids } = await readJson(c, reorderSchema);
  await prisma.$transaction(
    ids.map((id, i) => prisma.status.update({ where: { id }, data: { position: i } })),
  );
  const statuses = await prisma.status.findMany({ where: { listId }, orderBy: { position: "asc" } });
  return c.json(statuses);
});

// POST /api/lists/:listId/custom-fields
const OPTION_COLORS = ["#3d8df5", "#2ecd6f", "#ff7800", "#fd71af", "#9b59b6", "#f50000"];
const fieldSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  type: z.enum([
    "TEXT", "TEXTAREA", "NUMBER", "MONEY", "DROPDOWN", "LABELS",
    "DATE", "CHECKBOX", "URL", "EMAIL", "PHONE", "RATING", "PROGRESS",
  ]),
  options: z.array(z.string()).optional(),
});

listsRoutes.post("/:listId/custom-fields", async (c) => {
  const listId = c.req.param("listId");
  await requireRole(c, "MEMBER");
  const { name, type, options } = await readJson(c, fieldSchema);
  const last = await prisma.customField.findFirst({ where: { listId }, orderBy: { position: "desc" } });
  const needsOptions = type === "DROPDOWN" || type === "LABELS";

  const field = await prisma.customField.create({
    data: {
      listId,
      name,
      type: type as CustomFieldType,
      position: (last?.position ?? 0) + 1,
      options:
        needsOptions && options?.length
          ? {
              create: options
                .filter((o) => o.trim())
                .map((label, i) => ({
                  label: label.trim(),
                  color: OPTION_COLORS[i % OPTION_COLORS.length],
                  position: i,
                })),
            }
          : undefined,
    },
    include: { options: { orderBy: { position: "asc" } } },
  });
  return c.json(field, 201);
});

// POST /api/lists/:listId/apply-template
type ChecklistSnap = { name: string; items: string[] };
const templateApplySchema = z.object({ templateId: z.string().min(1) });

listsRoutes.post("/:listId/apply-template", async (c) => {
  const listId = c.req.param("listId");
  const { user } = await requireRole(c, "MEMBER");
  const { templateId } = await readJson(c, templateApplySchema);

  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new ApiError(404, "Template not found");

  const firstStatus = await prisma.status.findFirst({ where: { listId }, orderBy: { position: "asc" } });
  if (!firstStatus) throw new ApiError(400, "List has no statuses");

  const last = await prisma.task.findFirst({
    where: { listId, parentId: null },
    orderBy: { position: "desc" },
  });

  const checklists = (template.checklists as ChecklistSnap[] | null) ?? [];

  const task = await prisma.task.create({
    data: {
      listId,
      statusId: firstStatus.id,
      name: template.taskName,
      description: template.description,
      priority: template.priority,
      position: (last?.position ?? 0) + 1000,
      createdById: user.id,
      checklists: {
        create: checklists.map((snap, ci) => ({
          name: snap.name,
          position: ci,
          items: { create: snap.items.map((name, ii) => ({ name, position: ii })) },
        })),
      },
    },
    include: taskInclude,
  });

  await prisma.activity.create({
    data: { taskId: task.id, userId: user.id, type: "created", data: { fromTemplate: template.name } },
  });
  publish({ type: "list", listId });
  return c.json(task, 201);
});
