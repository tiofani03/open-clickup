import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "../auth";
import { readJson } from "../helpers";

export const viewsRoutes = new Hono();

const patchSchema = z.object({
  config: z.any().optional(),
  name: z.string().trim().min(1).optional(),
});

viewsRoutes.patch("/:viewId", async (c) => {
  const viewId = c.req.param("viewId");
  await requireRole(c, "MEMBER");
  const body = await readJson(c, patchSchema);
  const data: Record<string, unknown> = {};
  if (body.config !== undefined) data.config = body.config;
  if (body.name !== undefined) data.name = body.name;
  const view = await prisma.view.update({ where: { id: viewId }, data });
  return c.json(view);
});
