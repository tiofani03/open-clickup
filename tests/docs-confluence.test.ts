import { describe, it, expect } from "vitest";
import type { DocPageItem } from "../lib/queries";

function resolvePageEditorContent(page: DocPageItem, isEditing: boolean): string {
  if (isEditing) {
    if (page.hasDraft && page.draftMarkdown !== undefined && page.draftMarkdown !== null) {
      return page.draftMarkdown;
    }
    return page.contentMarkdown ?? "";
  }
  return page.contentMarkdown ?? "";
}

function publishDraft(page: DocPageItem): DocPageItem {
  return {
    ...page,
    contentMarkdown: page.draftMarkdown ?? page.contentMarkdown,
    contentHtml: page.draftHtml ?? page.contentHtml,
    draftMarkdown: null,
    draftHtml: null,
    hasDraft: false,
    isPublished: true,
  };
}

function discardDraft(page: DocPageItem): DocPageItem {
  return {
    ...page,
    draftMarkdown: null,
    draftHtml: null,
    hasDraft: false,
  };
}

describe("Confluence Drafts Workflow", () => {
  it("resolves published content in view mode and draft content in edit mode", () => {
    const page: DocPageItem = {
      id: "page-1",
      docId: "doc-1",
      parentPageId: null,
      title: "System Architecture",
      contentMarkdown: "# Published Architecture\n\nLive version for readers.",
      contentHtml: "<h1>Published Architecture</h1><p>Live version for readers.</p>",
      draftMarkdown: "# Draft Architecture\n\nWIP changes being authored.",
      draftHtml: "<h1>Draft Architecture</h1><p>WIP changes being authored.</p>",
      hasDraft: true,
      isPublished: true,
      position: 65535,
      createdAt: "2026-09-29T00:00:00Z",
      updatedAt: "2026-09-29T01:00:00Z",
    };

    expect(resolvePageEditorContent(page, false)).toBe("# Published Architecture\n\nLive version for readers.");
    expect(resolvePageEditorContent(page, true)).toBe("# Draft Architecture\n\nWIP changes being authored.");
  });

  it("publishes draft content to live view and clears draft state", () => {
    const pageWithDraft: DocPageItem = {
      id: "page-1",
      docId: "doc-1",
      parentPageId: null,
      title: "System Architecture",
      contentMarkdown: "# Old Live Content",
      contentHtml: "<h1>Old Live Content</h1>",
      draftMarkdown: "# New Polished Content",
      draftHtml: "<h1>New Polished Content</h1>",
      hasDraft: true,
      isPublished: true,
      position: 65535,
      createdAt: "2026-09-29T00:00:00Z",
      updatedAt: "2026-09-29T01:00:00Z",
    };

    const published = publishDraft(pageWithDraft);
    expect(published.contentMarkdown).toBe("# New Polished Content");
    expect(published.draftMarkdown).toBeNull();
    expect(published.hasDraft).toBe(false);
    expect(published.isPublished).toBe(true);
  });

  it("discards draft content leaving live content untouched", () => {
    const pageWithDraft: DocPageItem = {
      id: "page-1",
      docId: "doc-1",
      parentPageId: null,
      title: "System Architecture",
      contentMarkdown: "# Safe Live Content",
      contentHtml: "<h1>Safe Live Content</h1>",
      draftMarkdown: "# Incomplete experimental draft",
      draftHtml: "<h1>Incomplete experimental draft</h1>",
      hasDraft: true,
      isPublished: true,
      position: 65535,
      createdAt: "2026-09-29T00:00:00Z",
      updatedAt: "2026-09-29T01:00:00Z",
    };

    const discarded = discardDraft(pageWithDraft);
    expect(discarded.contentMarkdown).toBe("# Safe Live Content");
    expect(discarded.draftMarkdown).toBeNull();
    expect(discarded.hasDraft).toBe(false);
  });
});
