import { describe, it, expect } from "vitest";
import type { DocPageItem, DocItem } from "../lib/queries";

// Helper replicated from doc-view for testing tree structure
interface PageTreeNode extends DocPageItem {
  children: PageTreeNode[];
}

function buildPageTree(pages: DocPageItem[]): PageTreeNode[] {
  const map = new Map<string, PageTreeNode>();
  const roots: PageTreeNode[] = [];

  for (const p of pages) {
    map.set(p.id, { ...p, children: [] });
  }

  for (const p of pages) {
    const node = map.get(p.id)!;
    if (p.parentPageId && map.has(p.parentPageId)) {
      map.get(p.parentPageId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: PageTreeNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

describe("docs hierarchy tree", () => {
  it("builds a nested tree from flat doc pages array", () => {
    const pages: DocPageItem[] = [
      {
        id: "p1",
        docId: "d1",
        parentPageId: null,
        title: "Root Page 1",
        position: 1,
        createdAt: "2026-09-29T10:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      },
      {
        id: "p2",
        docId: "d1",
        parentPageId: "p1",
        title: "Sub Page 1.1",
        position: 1,
        createdAt: "2026-09-29T10:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      },
      {
        id: "p3",
        docId: "d1",
        parentPageId: null,
        title: "Root Page 2",
        position: 2,
        createdAt: "2026-09-29T10:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      },
      {
        id: "p4",
        docId: "d1",
        parentPageId: "p2",
        title: "Sub-sub Page 1.1.1",
        position: 1,
        createdAt: "2026-09-29T10:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      },
    ];

    const tree = buildPageTree(pages);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe("p1");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe("p2");
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe("p4");
    expect(tree[1].id).toBe("p3");
    expect(tree[1].children).toHaveLength(0);
  });

  it("handles empty pages array", () => {
    expect(buildPageTree([])).toEqual([]);
  });

  it("correctly sorts siblings by position", () => {
    const pages: DocPageItem[] = [
      {
        id: "p2",
        docId: "d1",
        parentPageId: null,
        title: "Second",
        position: 2,
        createdAt: "2026-09-29T10:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      },
      {
        id: "p1",
        docId: "d1",
        parentPageId: null,
        title: "First",
        position: 1,
        createdAt: "2026-09-29T10:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      },
    ];

    const tree = buildPageTree(pages);
    expect(tree[0].id).toBe("p1");
    expect(tree[1].id).toBe("p2");
  });
});

describe("docs hub filtering", () => {
  const sampleDocs: DocItem[] = [
    {
      id: "d1",
      workspaceId: "w1",
      spaceId: "s1",
      folderId: null,
      listId: null,
      taskId: null,
      title: "API Documentation",
      createdById: "u1",
      isPinned: true,
      createdAt: "2026-09-28T10:00:00Z",
      updatedAt: "2026-09-29T10:00:00Z",
    },
    {
      id: "d2",
      workspaceId: "w1",
      spaceId: null,
      folderId: null,
      listId: null,
      taskId: null,
      title: "Project Roadmap",
      createdById: "u1",
      isPinned: false,
      createdAt: "2026-09-27T10:00:00Z",
      updatedAt: "2026-09-28T12:00:00Z",
    },
    {
      id: "d3",
      workspaceId: "w1",
      spaceId: "s1",
      folderId: null,
      listId: null,
      taskId: null,
      title: "Architecture Guide",
      createdById: "u2",
      isPinned: true,
      createdAt: "2026-09-26T10:00:00Z",
      updatedAt: "2026-09-27T15:00:00Z",
    },
  ];

  it("filters docs by search query case-insensitively", () => {
    const q = "api";
    const filtered = sampleDocs.filter((d) => d.title.toLowerCase().includes(q));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("d1");
  });

  it("identifies pinned docs correctly", () => {
    const pinned = sampleDocs.filter((d) => d.isPinned);
    expect(pinned).toHaveLength(2);
    expect(pinned.map((d) => d.id)).toEqual(["d1", "d3"]);
  });

  it("sorts recent docs by updatedAt descending", () => {
    const sorted = [...sampleDocs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    expect(sorted.map((d) => d.id)).toEqual(["d1", "d2", "d3"]);
  });
});
