import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "../auth";
import { readJson } from "../helpers";
import { ApiError } from "@/lib/api-helpers";

export const templatesRoutes = new Hono();

templatesRoutes.get("/", async (c) => {
  const { workspaceId } = await requireRole(c, "MEMBER");
  const templates = await prisma.taskTemplate.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  return c.json(templates);
});

const schema = z.object({
  fromTaskId: z.string().min(1),
  name: z.string().trim().min(1, "Template name is required"),
});

templatesRoutes.post("/", async (c) => {
  const { workspaceId } = await requireRole(c, "MEMBER");
  const { fromTaskId, name } = await readJson(c, schema);

  const task = await prisma.task.findUnique({
    where: { id: fromTaskId },
    include: { checklists: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" } } } } },
  });
  if (!task) throw new ApiError(404, "Source task not found");

  const checklists = task.checklists.map((c) => ({
    name: c.name,
    items: c.items.map((i) => i.name),
  }));

  const template = await prisma.taskTemplate.create({
    data: {
      workspaceId,
      name,
      taskName: task.name,
      description: task.description,
      priority: task.priority,
      checklists,
    },
  });
  return c.json(template, 201);
});

templatesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await requireRole(c, "MEMBER");
  await prisma.taskTemplate.delete({ where: { id } });
  return c.json({ ok: true });
});
