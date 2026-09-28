import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "../auth";
import { userSelect } from "@/lib/queries";
import { readJson } from "../helpers";
import { ApiError } from "@/lib/api-helpers";
import { publish } from "@/lib/events";

export const commentsRoutes = new Hono();

const patchSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").optional(),
  resolved: z.boolean().optional(),
});

async function load(commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { task: { select: { listId: true } } },
  });
  if (!comment) throw new ApiError(404, "Comment not found");
  return comment;
}

commentsRoutes.patch("/:commentId", async (c) => {
  const commentId = c.req.param("commentId");
  const { user } = await requireRole(c, "MEMBER");
  const { body, resolved } = await readJson(c, patchSchema);
  const existing = await load(commentId);

  if (body !== undefined && existing.userId !== user.id) {
    throw new ApiError(403, "You can only edit your own comments");
  }

  const data: Record<string, unknown> = {};
  if (body !== undefined) data.body = body;
  if (resolved !== undefined) data.resolved = resolved;

  const comment = await prisma.comment.update({
    where: { id: commentId },
    data,
    include: { user: { select: userSelect }, reactions: true },
  });
  publish({ type: "list", listId: existing.task.listId });
  return c.json(comment);
});

commentsRoutes.delete("/:commentId", async (c) => {
  const commentId = c.req.param("commentId");
  const { user } = await requireRole(c, "MEMBER");
  const existing = await load(commentId);
  if (existing.userId !== user.id) throw new ApiError(403, "You can only delete your own comments");

  await prisma.comment.delete({ where: { id: commentId } });
  publish({ type: "list", listId: existing.task.listId });
  return c.json({ ok: true });
});

const reactionSchema = z.object({ emoji: z.string().trim().min(1).max(8) });

commentsRoutes.post("/:commentId/reactions", async (c) => {
  const commentId = c.req.param("commentId");
  const user = await requireUser(c);
  const { emoji } = await readJson(c, reactionSchema);

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { task: { select: { listId: true } } },
  });
  if (!comment) throw new ApiError(404, "Comment not found");

  const existing = await prisma.commentReaction.findUnique({
    where: { commentId_userId_emoji: { commentId, userId: user.id, emoji } },
  });

  if (existing) {
    await prisma.commentReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.commentReaction.create({ data: { commentId, userId: user.id, emoji } });
  }

  publish({ type: "list", listId: comment.task.listId });
  return c.json({ ok: true, reacted: !existing });
});
