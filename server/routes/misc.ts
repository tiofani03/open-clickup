import { Hono } from "hono";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { requireUser } from "../auth";
import { ApiError } from "@/lib/api-helpers";
import { publish } from "@/lib/events";

export const timeEntriesRoutes = new Hono();

timeEntriesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await requireUser(c);

  const entry = await prisma.timeEntry.findUnique({
    where: { id },
    include: { task: { select: { listId: true } } },
  });
  if (!entry) throw new ApiError(404, "Time entry not found");

  await prisma.timeEntry.delete({ where: { id } });
  publish({ type: "list", listId: entry.task.listId });
  return c.json({ ok: true });
});

export const dependenciesRoutes = new Hono();

dependenciesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await requireUser(c);

  const dep = await prisma.taskDependency.findUnique({
    where: { id },
    include: { blocker: { select: { listId: true } } },
  });
  if (!dep) throw new ApiError(404, "Dependency not found");

  await prisma.taskDependency.delete({ where: { id } });
  publish({ type: "list", listId: dep.blocker.listId });
  return c.json({ ok: true });
});

export const attachmentsRoutes = new Hono();

attachmentsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await requireUser(c);

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { task: { select: { listId: true } } },
  });
  if (!attachment) throw new ApiError(404, "Attachment not found");

  await prisma.attachment.delete({ where: { id } });

  if (attachment.url.startsWith("/uploads/")) {
    const fileName = attachment.url.replace("/uploads/", "");
    const filePath = path.join(process.cwd(), "public", "uploads", fileName);
    await unlink(filePath).catch(() => {});
  }

  publish({ type: "list", listId: attachment.task.listId });
  return c.json({ ok: true });
});
