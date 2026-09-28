import { Hono } from "hono";
import { prisma } from "@/lib/db";
import { getWorkspaceTree } from "@/lib/queries";
import { getCurrentUser } from "../auth";
import { ApiError } from "@/lib/api-helpers";

export const bootstrapRoutes = new Hono();

bootstrapRoutes.get("/", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) throw new ApiError(401, "Not authenticated");

  const workspace = await getWorkspaceTree();
  if (!workspace) throw new ApiError(404, "No workspace found");

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    select: { listId: true },
  });

  const currentUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    color: user.color,
    avatarUrl: user.avatarUrl,
  };
  return c.json({ currentUser, workspace, favorites: favorites.map((f) => f.listId) });
});
