import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-helpers";
import type { Role } from "@/lib/permissions";

export { hashPassword, verifyPassword } from "@/lib/password";

export const SESSION_COOKIE = "cu_session";
const SESSION_DAYS = 30;

export async function createSession(c: Context, userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  const session = await prisma.session.create({ data: { userId, expiresAt } });
  setCookie(c, SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return session;
}

export async function getCurrentUser(c: Context) {
  const sid = getCookie(c, SESSION_COOKIE);
  if (!sid) return null;
  const session = await prisma.session.findUnique({
    where: { id: sid },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function requireUser(c: Context) {
  const user = await getCurrentUser(c);
  if (!user) throw new ApiError(401, "Not authenticated");
  return user;
}

export async function destroySession(c: Context) {
  const sid = getCookie(c, SESSION_COOKIE);
  if (sid) {
    await prisma.session.deleteMany({ where: { id: sid } });
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
  }
}

const ROLE_RANK: Record<Role, number> = { GUEST: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

export async function requireRole(c: Context, min: Role) {
  const user = await requireUser(c);
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!membership || ROLE_RANK[membership.role as Role] < ROLE_RANK[min]) {
    throw new ApiError(403, `This action requires ${min.toLowerCase()} access.`);
  }
  return { user, role: membership.role as Role, workspaceId: membership.workspaceId };
}
