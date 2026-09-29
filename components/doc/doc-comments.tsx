import { useState } from "react";
import { MessageSquare, Send, Reply, Trash2, CornerDownRight } from "lucide-react";
import { format } from "date-fns";
import { Avatar } from "@/components/ui/avatar";
import { useDocComments, useCreateDocComment, useDeleteDocComment } from "@/lib/hooks";
import { useWorkspace } from "@/components/workspace-context";
import type { DocCommentItem } from "@/lib/queries";

export function DocComments({
  docId,
  pageId,
}: {
  docId: string;
  pageId: string;
}) {
  const { currentUser } = useWorkspace();
  const { data: comments = [], isLoading } = useDocComments(docId, pageId);
  const createComment = useCreateDocComment(docId, pageId);
  const deleteComment = useDeleteDocComment(docId, pageId);

  const [newCommentBody, setNewCommentBody] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const handleCreateTopLevel = async () => {
    const text = newCommentBody.trim();
    if (!text || createComment.isPending) return;
    await createComment.mutateAsync({
      docId,
      pageId,
      payload: { body: text },
    });
    setNewCommentBody("");
  };

  const handleCreateReply = async (parentId: string) => {
    const text = replyBody.trim();
    if (!text || createComment.isPending) return;
    await createComment.mutateAsync({
      docId,
      pageId,
      payload: { body: text, parentId },
    });
    setReplyBody("");
    setReplyingToId(null);
  };

  const handleDelete = async (commentId: string) => {
    if (deleteComment.isPending) return;
    await deleteComment.mutateAsync({
      docId,
      pageId,
      commentId,
    });
  };

  // Group into top-level and replies
  const repliesByParent = new Map<string, DocCommentItem[]>();
  for (const c of comments) {
    if (c.parentId) {
      const arr = repliesByParent.get(c.parentId) ?? [];
      arr.push(c);
      repliesByParent.set(c.parentId, arr);
    }
  }
  const topLevel = comments.filter((c) => !c.parentId);

  return (
    <div className="mt-16 pt-8 border-t border-cu-border max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-6 text-cu-text">
        <MessageSquare className="h-4 w-4 text-cu-text-tertiary" />
        <h3 className="text-sm font-semibold">Comments</h3>
        <span className="text-xs text-cu-text-tertiary bg-cu-panel border border-cu-border px-2 py-0.5 rounded-full font-medium">
          {comments.length}
        </span>
      </div>

      {/* Main Comment Composer */}
      <div className="flex gap-3 mb-8">
        <Avatar
          user={{
            name: currentUser?.name ?? "Me",
            color: currentUser?.color ?? "#7b68ee",
            avatarUrl: currentUser?.avatarUrl ?? null,
          }}
          size="md"
        />
        <div className="flex-1 bg-cu-panel border border-cu-border rounded-lg shadow-sm focus-within:border-cu-primary focus-within:ring-1 focus-within:ring-cu-primary transition-all">
          <textarea
            value={newCommentBody}
            onChange={(e) => setNewCommentBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleCreateTopLevel();
              }
            }}
            placeholder="Write a comment... (Cmd+Enter to post)"
            rows={2}
            className="w-full bg-transparent px-3 py-2 text-sm text-cu-text placeholder:text-cu-text-tertiary focus:outline-none resize-none"
          />
          <div className="flex justify-end items-center px-3 py-1.5 border-t border-cu-border/50 bg-cu-subtle/30 rounded-b-lg">
            <button
              onClick={handleCreateTopLevel}
              disabled={!newCommentBody.trim() || createComment.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-cu-primary hover:bg-cu-primary-hover disabled:opacity-50 text-white rounded text-xs font-medium transition-colors cursor-pointer"
            >
              <Send className="h-3 w-3" />
              Comment
            </button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="text-xs text-cu-text-tertiary py-4 text-center">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-xs text-cu-text-tertiary py-4 text-center italic">
          No comments on this page yet. Be the first to start a conversation!
        </div>
      ) : (
        <div className="space-y-6">
          {topLevel.map((comment) => {
            const replies = repliesByParent.get(comment.id) ?? [];
            const isOwn = currentUser && comment.userId === currentUser.id;

            return (
              <div key={comment.id} className="space-y-3 group/item">
                <div className="flex gap-3">
                  <Avatar
                    user={{
                      name: comment.user?.name ?? "User",
                      color: comment.user?.color ?? "#7b68ee",
                      avatarUrl: comment.user?.avatarUrl ?? null,
                    }}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-cu-text">
                          {comment.user?.name ?? "User"}
                        </span>
                        <span className="text-[11px] text-cu-text-tertiary">
                          {comment.createdAt ? format(new Date(comment.createdAt), "MMM d, h:mm a") : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setReplyingToId(replyingToId === comment.id ? null : comment.id);
                            setReplyBody("");
                          }}
                          className="p-1 text-cu-text-tertiary hover:text-cu-text hover:bg-cu-hover rounded transition-colors text-xs inline-flex items-center gap-1 cursor-pointer"
                          title="Reply"
                        >
                          <Reply className="h-3 w-3" />
                          <span className="text-[11px]">Reply</span>
                        </button>
                        {isOwn && (
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="p-1 text-cu-text-tertiary hover:text-red-500 hover:bg-cu-hover rounded transition-colors text-xs cursor-pointer"
                            title="Delete comment"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-cu-text whitespace-pre-wrap leading-relaxed break-words">
                      {comment.body}
                    </div>

                    {/* Replies List */}
                    {replies.length > 0 && (
                      <div className="mt-3 pl-4 border-l-2 border-cu-border/70 space-y-3">
                        {replies.map((reply) => {
                          const isOwnReply = currentUser && reply.userId === currentUser.id;
                          return (
                            <div key={reply.id} className="flex gap-2.5 group/reply">
                              <Avatar
                                user={{
                                  name: reply.user?.name ?? "User",
                                  color: reply.user?.color ?? "#7b68ee",
                                  avatarUrl: reply.user?.avatarUrl ?? null,
                                }}
                                size="sm"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-cu-text">
                                      {reply.user?.name ?? "User"}
                                    </span>
                                    <span className="text-[10px] text-cu-text-tertiary">
                                      {reply.createdAt ? format(new Date(reply.createdAt), "MMM d, h:mm a") : ""}
                                    </span>
                                  </div>
                                  {isOwnReply && (
                                    <button
                                      onClick={() => handleDelete(reply.id)}
                                      className="opacity-0 group-hover/reply:opacity-100 p-0.5 text-cu-text-tertiary hover:text-red-500 rounded transition-colors cursor-pointer"
                                      title="Delete reply"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                                <div className="mt-0.5 text-xs text-cu-text whitespace-pre-wrap leading-relaxed break-words">
                                  {reply.body}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Inline Reply Composer */}
                    {replyingToId === comment.id && (
                      <div className="mt-3 flex gap-2 pl-4 border-l-2 border-cu-primary/50">
                        <CornerDownRight className="h-3.5 w-3.5 text-cu-primary shrink-0 mt-2" />
                        <div className="flex-1 bg-cu-panel border border-cu-border rounded-md focus-within:border-cu-primary">
                          <textarea
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            onKeyDown={(e) => {
                              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                e.preventDefault();
                                handleCreateReply(comment.id);
                              }
                            }}
                            placeholder="Write a reply... (Cmd+Enter to post)"
                            rows={1}
                            autoFocus
                            className="w-full bg-transparent px-2.5 py-1.5 text-xs text-cu-text placeholder:text-cu-text-tertiary focus:outline-none resize-none"
                          />
                          <div className="flex justify-end gap-1.5 px-2 py-1 border-t border-cu-border/50 bg-cu-subtle/20 rounded-b-md">
                            <button
                              onClick={() => {
                                setReplyingToId(null);
                                setReplyBody("");
                              }}
                              className="px-2 py-0.5 text-[11px] text-cu-text-tertiary hover:text-cu-text rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleCreateReply(comment.id)}
                              disabled={!replyBody.trim() || createComment.isPending}
                              className="px-2 py-0.5 bg-cu-primary hover:bg-cu-primary-hover disabled:opacity-50 text-white rounded text-[11px] font-medium cursor-pointer"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
