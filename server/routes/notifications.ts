import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "../auth";
import { userSelect } from "@/lib/queries";
import { readJson } from "../helpers";

export const notificationsRoutes = new Hono();

notificationsRoutes.get("/", async (c) => {
  const user = await requireUser(c);
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        actor: { select: userSelect },
        task: { select: { id: true, name: true, listId: true } },
      },
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return c.json({ notifications, unread });
});

const schema = z.object({ ids: z.array(z.string()).optional() });

notificationsRoutes.post("/read", async (c) => {
  const user = await requireUser(c);
  const { ids } = await readJson(c, schema).catch(() => ({ ids: undefined }));
  await prisma.notification.updateMany({
    where: { userId: user.id, read: false, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { read: true },
  });
  return c.json({ ok: true });
});
