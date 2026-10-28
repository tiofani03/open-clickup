import { describe, it, expect } from "vitest";
import type { DocCommentItem } from "../lib/queries";

describe("doc comments grouping", () => {
  it("correctly groups comments into top-level and nested replies", () => {
    const comments: DocCommentItem[] = [
      {
        id: "c1",
        docPageId: "page-1",
        userId: "u1",
        body: "Top level comment 1",
        parentId: null,
        createdAt: "2026-09-29T10:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
        user: { id: "u1", name: "Alice", email: "alice@test.dev", color: "#ff0000", avatarUrl: null },
      },
      {
        id: "c2",
        docPageId: "page-1",
        userId: "u2",
        body: "Reply to comment 1",
        parentId: "c1",
        createdAt: "2026-09-29T10:05:00Z",
        updatedAt: "2026-09-29T10:05:00Z",
        user: { id: "u2", name: "Bob", email: "bob@test.dev", color: "#00ff00", avatarUrl: null },
      },
      {
        id: "c3",
        docPageId: "page-1",
        userId: "u3",
        body: "Top level comment 2",
        parentId: null,
        createdAt: "2026-09-29T10:10:00Z",
        updatedAt: "2026-09-29T10:10:00Z",
        user: { id: "u3", name: "Charlie", email: "charlie@test.dev", color: "#0000ff", avatarUrl: null },
      },
    ];

    const repliesByParent = new Map<string, DocCommentItem[]>();
    for (const c of comments) {
      if (c.parentId) {
        const arr = repliesByParent.get(c.parentId) ?? [];
        arr.push(c);
        repliesByParent.set(c.parentId, arr);
      }
    }
    const topLevel = comments.filter((c) => !c.parentId);

    expect(topLevel).toHaveLength(2);
    expect(topLevel[0].id).toBe("c1");
    expect(topLevel[1].id).toBe("c3");

    const c1Replies = repliesByParent.get("c1") ?? [];
    expect(c1Replies).toHaveLength(1);
    expect(c1Replies[0].id).toBe("c2");
    expect(c1Replies[0].body).toBe("Reply to comment 1");
  });
});
