import { Hono } from "hono";
import { prisma } from "@/lib/db";

export const searchRoutes = new Hono();

searchRoutes.get("/", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.json({ tasks: [], lists: [] });

  const [tasks, lists] = await Promise.all([
    prisma.task.findMany({
      where: { name: { contains: q, mode: "insensitive" }, archived: false },
      take: 12,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        listId: true,
        status: { select: { name: true, color: true, type: true } },
        list: { select: { name: true } },
      },
    }),
    prisma.list.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 6,
      select: {
        id: true,
        name: true,
        color: true,
        space: { select: { name: true } },
      },
    }),
  ]);

  return c.json({ tasks, lists });
});
