import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { StatusType } from "@/lib/generated/prisma/client";
import { requireRole } from "../auth";
import { readJson } from "../helpers";
import { ApiError } from "@/lib/api-helpers";

export const statusesRoutes = new Hono();

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: z.string().optional(),
  type: z.enum(["NOT_STARTED", "ACTIVE", "DONE", "CLOSED"]).optional(),
  wipLimit: z.number().int().positive().nullish(),
});

statusesRoutes.patch("/:statusId", async (c) => {
  const statusId = c.req.param("statusId");
  await requireRole(c, "MEMBER");
  const body = await readJson(c, patchSchema);
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.color !== undefined) data.color = body.color;
  if (body.type !== undefined) data.type = body.type as StatusType;
  if (body.wipLimit !== undefined) data.wipLimit = body.wipLimit;
  const status = await prisma.status.update({ where: { id: statusId }, data });
  return c.json(status);
});

statusesRoutes.delete("/:statusId", async (c) => {
  const statusId = c.req.param("statusId");
  await requireRole(c, "MEMBER");
  const status = await prisma.status.findUnique({ where: { id: statusId } });
  if (!status) throw new ApiError(404, "Status not found");

  const siblings = await prisma.status.findMany({
    where: { listId: status.listId, id: { not: statusId } },
    orderBy: { position: "asc" },
  });
  if (siblings.length === 0) {
    throw new ApiError(400, "Cannot delete the only status");
  }
  const fallback = siblings[0];
  await prisma.task.updateMany({ where: { statusId }, data: { statusId: fallback.id } });
  await prisma.status.delete({ where: { id: statusId } });
  return c.json({ ok: true, movedTo: fallback.id });
});
