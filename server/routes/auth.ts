import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, destroySession, hashPassword } from "../auth";
import { colorFromString } from "@/lib/utils";
import { readJson } from "../helpers";
import { ApiError } from "@/lib/api-helpers";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const authRoutes = new Hono();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

authRoutes.post("/login", async (c) => {
  const ip = clientIp(c.req.raw);
  const rl = rateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.ok) {
    c.header("Retry-After", String(rl.retryAfter));
    return c.json({ error: "Too many login attempts. Please wait a moment and try again." }, 429);
  }
  const { email, password } = await readJson(c, loginSchema);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new ApiError(401, "Invalid email or password");
  }
  await createSession(c, user.id);
  return c.json({ id: user.id, name: user.name, email: user.email });
});

const signupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

authRoutes.post("/signup", async (c) => {
  const ip = clientIp(c.req.raw);
  const rl = rateLimit(`signup:${ip}`, 5, 60_000);
  if (!rl.ok) {
    c.header("Retry-After", String(rl.retryAfter));
    return c.json({ error: "Too many sign-up attempts. Please wait a moment and try again." }, 429);
  }
  const { name, email, password } = await readJson(c, signupSchema);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, "An account with that email already exists");

  const user = await prisma.user.create({
    data: { name, email, passwordHash: hashPassword(password), color: colorFromString(email) },
  });

  const workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (workspace) {
    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "MEMBER" },
    });
  }

  await createSession(c, user.id);
  return c.json({ id: user.id, name: user.name, email: user.email }, 201);
});

authRoutes.post("/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});
