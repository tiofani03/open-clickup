import { Hono } from "hono";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { createTask, updateTask } from "@/lib/tasks";
import { getTaskDetail, taskInclude, userSelect } from "@/lib/queries";
import { requireRole, requireUser } from "../auth";
import { readJson } from "../helpers";
import { ApiError } from "@/lib/api-helpers";
import { publish } from "@/lib/events";
import { extractMentionIds, createNotifications } from "@/lib/notifications";
import type { Priority } from "@/lib/generated/prisma/client";

export const tasksRoutes = new Hono();

// POST /api/tasks (create task)
const createSchema = z.object({
  listId: z.string().min(1),
  name: z.string().trim().min(1, "name is required"),
  statusId: z.string().optional(),
  parentId: z.string().nullish(),
  priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]).nullish(),
  assigneeIds: z.array(z.string()).optional(),
});

tasksRoutes.post("/", async (c) => {
  const body = await readJson(c, createSchema);
  const { user } = await requireRole(c, "MEMBER");
  const task = await createTask({
    listId: body.listId,
    name: body.name,
    statusId: body.statusId,
    parentId: body.parentId ?? null,
    priority: body.priority ?? null,
    assigneeIds: body.assigneeIds ?? [],
    createdById: user.id,
  });
  return c.json(task, 201);
});

// POST /api/tasks/bulk
const bulkSchema = z.object({
  ids: z.array(z.string()).min(1, "ids[] required"),
  delete: z.boolean().optional(),
  patch: z
    .object({
      statusId: z.string().optional(),
      priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]).nullish(),
      assigneeIds: z.array(z.string()).optional(),
    })
    .optional(),
});

async function notifyLists(ids: string[]) {
  const tasks = await prisma.task.findMany({ where: { id: { in: ids } }, select: { listId: true } });
  for (const listId of new Set(tasks.map((t) => t.listId))) publish({ type: "list", listId });
}

tasksRoutes.post("/bulk", async (c) => {
  await requireRole(c, "MEMBER");
  const { ids, patch, delete: del } = await readJson(c, bulkSchema);

  if (del) {
    await notifyLists(ids);
    await prisma.task.deleteMany({ where: { id: { in: ids } } });
    return c.json({ ok: true, deleted: ids.length });
  }

  if (patch?.statusId || patch?.priority !== undefined) {
    const data: Record<string, unknown> = {};
    if (patch.statusId) {
      data.statusId = patch.statusId;
      const st = await prisma.status.findUnique({ where: { id: patch.statusId } });
      data.completedAt = st?.type === "DONE" ? new Date() : null;
    }
    if (patch.priority !== undefined) data.priority = patch.priority as Priority | null;
    await prisma.task.updateMany({ where: { id: { in: ids } }, data });
  }

  if (patch?.assigneeIds) {
    await prisma.$transaction([
      prisma.taskAssignee.deleteMany({ where: { taskId: { in: ids } } }),
      prisma.taskAssignee.createMany({
        data: ids.flatMap((taskId) =>
          patch.assigneeIds!.map((userId) => ({ taskId, userId })),
        ),
        skipDuplicates: true,
      }),
    ]);
  }

  await notifyLists(ids);
  return c.json({ ok: true, updated: ids.length });
});

// GET /api/tasks/:taskId
tasksRoutes.get("/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  const task = await getTaskDetail(taskId);
  if (!task) throw new ApiError(404, "Task not found");
  return c.json(task);
});

// PATCH /api/tasks/:taskId
const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().nullish(),
  statusId: z.string().optional(),
  priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]).nullish(),
  position: z.number().optional(),
  startDate: z.string().datetime().nullish(),
  dueDate: z.string().datetime().nullish(),
  timeEstimate: z.number().int().nullish(),
  recurrence: z.enum(["DAILY", "WEEKDAYS", "WEEKLY", "BIWEEKLY", "MONTHLY"]).nullish(),
  archived: z.boolean().optional(),
  assigneeIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  watcherIds: z.array(z.string()).optional(),
});

tasksRoutes.patch("/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  const patch = await readJson(c, patchSchema);
  const { user } = await requireRole(c, "MEMBER");
  const task = await updateTask(taskId, patch, user.id);
  return c.json(task);
});

// DELETE /api/tasks/:taskId
tasksRoutes.delete("/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  await requireRole(c, "MEMBER");
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { listId: true } });
  await prisma.task.delete({ where: { id: taskId } });
  if (task) publish({ type: "list", listId: task.listId });
  return c.json({ ok: true });
});

// POST /api/tasks/:taskId/move
const moveSchema = z.object({ listId: z.string().min(1) });
tasksRoutes.post("/:taskId/move", async (c) => {
  const taskId = c.req.param("taskId");
  const { user } = await requireRole(c, "MEMBER");
  const { listId: targetListId } = await readJson(c, moveSchema);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { listId: true, parentId: true },
  });
  if (!task) throw new ApiError(404, "Task not found");
  if (task.parentId) throw new ApiError(400, "Move the parent task instead of a subtask");
  if (task.listId === targetListId) return c.json({ ok: true, listId: targetListId });

  const target = await prisma.list.findUnique({ where: { id: targetListId }, select: { id: true, name: true } });
  if (!target) throw new ApiError(404, "Target list not found");
  const firstStatus = await prisma.status.findFirst({ where: { listId: targetListId }, orderBy: { position: "asc" } });
  if (!firstStatus) throw new ApiError(400, "Target list has no statuses");

  const last = await prisma.task.findFirst({
    where: { listId: targetListId, parentId: null },
    orderBy: { position: "desc" },
  });

  const oldListId = task.listId;
  await prisma.$transaction([
    prisma.customFieldValue.deleteMany({ where: { taskId } }),
    prisma.customFieldValue.deleteMany({ where: { task: { parentId: taskId } } }),
    prisma.task.update({
      where: { id: taskId },
      data: { listId: targetListId, statusId: firstStatus.id, position: (last?.position ?? 0) + 1000 },
    }),
    prisma.task.updateMany({
      where: { parentId: taskId },
      data: { listId: targetListId, statusId: firstStatus.id },
    }),
    prisma.activity.create({
      data: { taskId, userId: user.id, type: "moved", data: { toList: target.name } },
    }),
  ]);

  publish({ type: "list", listId: oldListId });
  publish({ type: "list", listId: targetListId });
  return c.json({ ok: true, listId: targetListId });
});

// POST /api/tasks/:taskId/duplicate
tasksRoutes.post("/:taskId/duplicate", async (c) => {
  const taskId = c.req.param("taskId");
  const { user } = await requireRole(c, "MEMBER");

  const src = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignees: true,
      tags: true,
      customFieldValues: true,
      checklists: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" } } } },
    },
  });
  if (!src) throw new ApiError(404, "Task not found");

  const last = await prisma.task.findFirst({
    where: { listId: src.listId, parentId: src.parentId },
    orderBy: { position: "desc" },
  });

  const copy = await prisma.task.create({
    data: {
      listId: src.listId,
      statusId: src.statusId,
      parentId: src.parentId,
      name: `${src.name} (copy)`,
      description: src.description,
      priority: src.priority,
      position: (last?.position ?? src.position) + 1000,
      startDate: src.startDate,
      dueDate: src.dueDate,
      timeEstimate: src.timeEstimate,
      recurrence: src.recurrence,
      createdById: user.id,
      assignees: { create: src.assignees.map((a) => ({ userId: a.userId })) },
      tags: { create: src.tags.map((t) => ({ tagId: t.tagId })) },
      customFieldValues: {
        create: src.customFieldValues.map((v) => ({ customFieldId: v.customFieldId, value: v.value as object })),
      },
      checklists: {
        create: src.checklists.map((c, ci) => ({
          name: c.name,
          position: ci,
          items: { create: c.items.map((i, ii) => ({ name: i.name, resolved: i.resolved, position: ii })) },
        })),
      },
    },
    include: taskInclude,
  });

  publish({ type: "list", listId: src.listId });
  return c.json(copy, 201);
});

// POST /api/tasks/:taskId/checklists
const checklistSchema = z.object({ name: z.string().trim().min(1).optional() });
tasksRoutes.post("/:taskId/checklists", async (c) => {
  const taskId = c.req.param("taskId");
  await requireRole(c, "MEMBER");
  const { name } = await readJson(c, checklistSchema).catch(() => ({ name: undefined }));
  const last = await prisma.checklist.findFirst({ where: { taskId }, orderBy: { position: "desc" } });
  const checklist = await prisma.checklist.create({
    data: { taskId, name: name?.trim() || "Checklist", position: (last?.position ?? 0) + 1000 },
    include: { items: true },
  });
  return c.json(checklist, 201);
});

// POST /api/tasks/:taskId/comments
const commentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty"),
  parentId: z.string().nullish(),
});

tasksRoutes.post("/:taskId/comments", async (c) => {
  const taskId = c.req.param("taskId");
  const { body, parentId } = await readJson(c, commentSchema);
  const { user } = await requireRole(c, "MEMBER");
  const comment = await prisma.comment.create({
    data: { taskId, userId: user.id, body, parentId: parentId ?? null },
    include: { user: { select: userSelect }, reactions: true },
  });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      listId: true,
      assignees: { select: { userId: true } },
      watchers: { select: { userId: true } },
    },
  });
  if (task) publish({ type: "list", listId: task.listId });
  await prisma.activity.create({
    data: { taskId, userId: user.id, type: "commented", data: {} },
  });

  const mentioned = extractMentionIds(body);
  if (mentioned.length) {
    await createNotifications({
      recipientIds: mentioned,
      actorId: user.id,
      taskId,
      type: "mention",
      body: "mentioned you in a comment",
    });
  }

  if (task) {
    const followers = [...task.assignees, ...task.watchers].map((f) => f.userId);
    const recipients = [...new Set(followers)].filter((id) => !mentioned.includes(id));
    if (recipients.length) {
      await createNotifications({
        recipientIds: recipients,
        actorId: user.id,
        taskId,
        type: "comment",
        body: "commented on a task you follow",
      });
    }
  }
  return c.json(comment, 201);
});

// PUT /api/tasks/:taskId/fields/:fieldId
const fieldSchema = z.object({ value: z.any() });
tasksRoutes.put("/:taskId/fields/:fieldId", async (c) => {
  const taskId = c.req.param("taskId");
  const fieldId = c.req.param("fieldId");
  await requireRole(c, "MEMBER");
  const { value } = await readJson(c, fieldSchema);

  const isEmpty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (isEmpty) {
    await prisma.customFieldValue.deleteMany({ where: { taskId, customFieldId: fieldId } });
    return c.json({ ok: true, cleared: true });
  }

  const saved = await prisma.customFieldValue.upsert({
    where: { taskId_customFieldId: { taskId, customFieldId: fieldId } },
    create: { taskId, customFieldId: fieldId, value },
    update: { value },
  });
  return c.json(saved);
});

// POST /api/tasks/:taskId/time
const timeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("stop") }),
  z.object({
    action: z.literal("log"),
    durationSeconds: z.number().int().positive(),
    description: z.string().trim().max(500).optional(),
  }),
]);

tasksRoutes.post("/:taskId/time", async (c) => {
  const taskId = c.req.param("taskId");
  const user = await requireUser(c);
  const input = await readJson(c, timeSchema);

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { listId: true } });
  if (!task) throw new ApiError(404, "Task not found");

  if (input.action === "start") {
    const running = await prisma.timeEntry.findFirst({
      where: { userId: user.id, endedAt: null },
    });
    if (running) {
      const elapsed = Math.max(0, Math.round((Date.now() - running.startedAt.getTime()) / 1000));
      await prisma.timeEntry.update({
        where: { id: running.id },
        data: { endedAt: new Date(), duration: elapsed },
      });
    }
    const entry = await prisma.timeEntry.create({
      data: { taskId, userId: user.id },
      include: { user: { select: userSelect } },
    });
    publish({ type: "list", listId: task.listId });
    return c.json(entry, 201);
  }

  if (input.action === "stop") {
    const running = await prisma.timeEntry.findFirst({
      where: { taskId, userId: user.id, endedAt: null },
    });
    if (!running) throw new ApiError(400, "No running timer for this task");
    const elapsed = Math.max(0, Math.round((Date.now() - running.startedAt.getTime()) / 1000));
    const entry = await prisma.timeEntry.update({
      where: { id: running.id },
      data: { endedAt: new Date(), duration: elapsed },
      include: { user: { select: userSelect } },
    });
    publish({ type: "list", listId: task.listId });
    return c.json(entry);
  }

  const now = new Date();
  const entry = await prisma.timeEntry.create({
    data: {
      taskId,
      userId: user.id,
      duration: input.durationSeconds,
      description: input.description,
      startedAt: new Date(now.getTime() - input.durationSeconds * 1000),
      endedAt: now,
    },
    include: { user: { select: userSelect } },
  });
  publish({ type: "list", listId: task.listId });
  return c.json(entry, 201);
});

// POST /api/tasks/:taskId/dependencies
const depSchema = z.object({
  type: z.enum(["waiting_on", "blocking"]),
  otherTaskId: z.string().min(1),
});

tasksRoutes.post("/:taskId/dependencies", async (c) => {
  const taskId = c.req.param("taskId");
  await requireUser(c);
  const { type, otherTaskId } = await readJson(c, depSchema);

  if (otherTaskId === taskId) throw new ApiError(400, "A task can't depend on itself");

  const blockerId = type === "waiting_on" ? otherTaskId : taskId;
  const blockedId = type === "waiting_on" ? taskId : otherTaskId;

  const [task, other] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId }, select: { listId: true } }),
    prisma.task.findUnique({ where: { id: otherTaskId }, select: { id: true } }),
  ]);
  if (!task) throw new ApiError(404, "Task not found");
  if (!other) throw new ApiError(404, "Linked task not found");

  const reverse = await prisma.taskDependency.findUnique({
    where: { blockerId_blockedId: { blockerId: blockedId, blockedId: blockerId } },
  });
  if (reverse) throw new ApiError(409, "That would create a circular dependency");

  const existing = await prisma.taskDependency.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  if (existing) throw new ApiError(409, "Dependency already exists");

  const dep = await prisma.taskDependency.create({ data: { blockerId, blockedId } });
  publish({ type: "list", listId: task.listId });
  return c.json(dep, 201);
});

// POST /api/tasks/:taskId/attachments
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

tasksRoutes.post("/:taskId/attachments", async (c) => {
  const taskId = c.req.param("taskId");
  const user = await requireUser(c);

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { listId: true } });
  if (!task) throw new ApiError(404, "Task not found");

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) throw new ApiError(400, "No file provided");
  if (file.size === 0) throw new ApiError(400, "File is empty");
  if (file.size > MAX_ATTACHMENT_SIZE) throw new ApiError(413, "File exceeds 25 MB limit");

  const ext = path.extname(file.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "");
  const storedName = `${randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), bytes);

  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      name: file.name,
      url: `/uploads/${storedName}`,
      size: file.size,
      mime: file.type || "application/octet-stream",
      uploadedById: user.id,
    },
  });

  await prisma.activity.create({
    data: { taskId, userId: user.id, type: "attachment_added", data: { name: file.name } },
  });
  publish({ type: "list", listId: task.listId });

  return c.json(attachment, 201);
});
