import { Hono } from "hono";
import { prisma } from "@/lib/db";

export const healthRoutes = new Hono();

healthRoutes.get("/", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ status: "ok", db: true });
  } catch {
    return c.json({ status: "error", db: false }, 503);
  }
});
