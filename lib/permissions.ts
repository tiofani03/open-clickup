import { prisma } from "@/lib/db";

export type Role = "GUEST" | "MEMBER" | "ADMIN" | "OWNER";

export const ROLE_RANK: Record<Role, number> = { GUEST: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

/** The current user's membership in their (single) workspace, or null. */
export async function getMembership(userId: string) {
  return prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

