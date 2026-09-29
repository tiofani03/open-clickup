"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import {
  FileText,
  Plus,
  Star,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Check,
  Loader2,
  Eye,
  PanelLeftClose,
  PanelLeft,
  X,
  ArrowLeft,
} from "lucide-react";
import {
  useDoc,
  useDocPage,
  useUpdateDoc,
  useDeleteDoc,
  useCreateDocPage,
  useUpdateDocPage,
  useDeleteDocPage,
} from "@/lib/hooks";
import { DocEditor } from "@/components/doc/doc-editor";
import { cn } from "@/lib/utils";
import type { DocPageItem } from "@/lib/queries";

interface PageTreeNode extends DocPageItem {
  children: PageTreeNode[];
}

export default function DocViewPage() {
  const { docId, pageId } = useParams<{ docId: string; pageId?: string }>();
  const navigate = useNavigate();

  // Queries
  const { data: docDetail, isLoading: isDocLoading, error: docError } = useDoc(docId);
  const doc = docDetail?.doc;
  const pages = useMemo(() => docDetail?.pages ?? [], [docDetail?.pages]);

  // Determine active page
  const activePageId = useMemo(() => {
    if (pageId && pages.some((p) => p.id === pageId)) return pageId;
    const root = pages.find((p) => !p.parentPageId);
    return root ? root.id : pages[0]?.id;
  }, [pageId, pages]);

  // Redirect to active page URL if on /docs/:docId without pageId
  useEffect(() => {
    if (docDetail && pages.length > 0 && !pageId && activePageId && docId) {
      navigate(`/docs/${docId}/p/${activePageId}`, { replace: true });
    }
  }, [docDetail, pages, pageId, activePageId, docId, navigate]);

  // Fetch active page content
  const { data: activePageData, isLoading: isPageLoading } = useDocPage(docId, activePageId);

  // Mutations
  const updateDoc = useUpdateDoc(docId);
  const deleteDoc = useDeleteDoc(docId);
  const createDocPage = useCreateDocPage(docId);
  const updateDocPage = useUpdateDocPage(docId);
  const deleteDocPage = useDeleteDocPage(docId);

  // UI state
  const [treeSidebarOpen, setTreeSidebarOpen] = useState(true);
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});
  const [editorMode, setEditorMode] = useState<"visual" | "markdown">("visual");
  const [isSaving, setIsSaving] = useState(false);

  // Inline doc title state
  const [isEditingDocTitle, setIsEditingDocTitle] = useState(false);
  const [docTitleInput, setDocTitleInput] = useState("");

  // Page title state
  const [pageTitle, setPageTitle] = useState("");

  // Page rename dialog state
  const [renamingPage, setRenamingPage] = useState<DocPageItem | null>(null);
  const [renamePageTitle, setRenamePageTitle] = useState("");

  // Delete doc dialog state
  const [confirmDeleteDocOpen, setConfirmDeleteDocOpen] = useState(false);

  // Debounce timers
  const contentSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const titleSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<{ markdown: string; html: string } | null>(null);

  // Sync doc title
  useEffect(() => {
    if (doc?.title) {
      setDocTitleInput(doc.title);
    }
  }, [doc?.title]);

  // Sync page title
  useEffect(() => {
    if (activePageData?.title) {
      setPageTitle(activePageData.title);
    } else {
      setPageTitle("");
    }
  }, [activePageData?.id, activePageData?.title]);

  // Cleanup pending saves on unmount
  useEffect(() => {
    return () => {
      if (contentSaveTimerRef.current) clearTimeout(contentSaveTimerRef.current);
      if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    };
  }, []);

  // Page Tree hierarchy
  const pageTree = useMemo(() => {
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
  }, [pages]);

  const toggleBranch = (pageNodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedBranches((prev) => ({
      ...prev,
      [pageNodeId]: !prev[pageNodeId],
    }));
  };

  // Handlers for Doc operations
  const handleSaveDocTitle = () => {
    if (!docId || !docTitleInput.trim() || docTitleInput === doc?.title) {
      setIsEditingDocTitle(false);
      return;
    }
    updateDoc.mutate({
      docId,
      patch: { title: docTitleInput.trim() },
    });
    setIsEditingDocTitle(false);
  };

  const handleToggleDocPin = () => {
    if (!docId || !doc) return;
    updateDoc.mutate({
      docId,
      patch: { isPinned: !doc.isPinned },
    });
  };

  const handleDeleteDoc = () => {
    if (!docId) return;
    deleteDoc.mutate(docId, {
      onSuccess: () => {
        navigate("/docs");
      },
    });
  };

  // Handlers for Page operations
  const handleAddPage = (parentPageId?: string | null) => {
    if (!docId) return;
    createDocPage.mutate(
      {
        docId,
        payload: {
          parentPageId: parentPageId ?? null,
          title: parentPageId ? "Untitled Subpage" : "Untitled Page",
        },
      },
      {
        onSuccess: (newPage) => {
          if (parentPageId) {
            setCollapsedBranches((prev) => ({ ...prev, [parentPageId]: false }));
          }
          navigate(`/docs/${docId}/p/${newPage.id}`);
        },
      },
    );
  };

  const handleDeletePage = (pageToDeleteId: string) => {
    if (!docId || pages.length <= 1) return;
    deleteDocPage.mutate(
      { docId, pageId: pageToDeleteId },
      {
        onSuccess: () => {
          if (pageToDeleteId === activePageId) {
            const remaining = pages.filter((p) => p.id !== pageToDeleteId);
            if (remaining.length > 0) {
              navigate(`/docs/${docId}/p/${remaining[0].id}`);
            }
          }
        },
      },
    );
  };

  const handleStartRenamePage = (p: DocPageItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenamingPage(p);
    setRenamePageTitle(p.title);
  };

  const handleRenamePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docId || !renamingPage || !renamePageTitle.trim()) return;
    updateDocPage.mutate(
      {
        docId,
        pageId: renamingPage.id,
        patch: { title: renamePageTitle.trim() },
      },
      {
        onSuccess: () => {
          if (renamingPage.id === activePageId) {
            setPageTitle(renamePageTitle.trim());
          }
          setRenamingPage(null);
        },
      },
    );
  };

  // Debounced Page Title Change
  const handlePageTitleChange = (newTitle: string) => {
    setPageTitle(newTitle);
    if (!docId || !activePageId) return;

    setIsSaving(true);
    if (titleSaveTimerRef.current) {
      clearTimeout(titleSaveTimerRef.current);
    }

    titleSaveTimerRef.current = setTimeout(() => {
      updateDocPage.mutate(
        {
          docId,
          pageId: activePageId,
          patch: { title: newTitle.trim() || "Untitled" },
        },
        {
          onSettled: () => {
            setIsSaving(false);
          },
        },
      );
    }, 800);
  };

  const handlePageTitleBlur = () => {
    if (titleSaveTimerRef.current) {
      clearTimeout(titleSaveTimerRef.current);
    }
    if (!docId || !activePageId) return;

    updateDocPage.mutate(
      {
        docId,
        pageId: activePageId,
        patch: { title: pageTitle.trim() || "Untitled" },
      },
      {
        onSettled: () => {
          setIsSaving(false);
        },
      },
    );
  };

  // Debounced Page Content Change
  const handleContentChange = useCallback(
    (markdown: string, html: string) => {
      if (!docId || !activePageId) return;
      lastSavedContentRef.current = { markdown, html };

      setIsSaving(true);
      if (contentSaveTimerRef.current) {
        clearTimeout(contentSaveTimerRef.current);
      }

      contentSaveTimerRef.current = setTimeout(() => {
        updateDocPage.mutate(
          {
            docId,
            pageId: activePageId,
            patch: { contentMarkdown: markdown, contentHtml: html },
          },
          {
            onSettled: () => {
              setIsSaving(false);
            },
          },
        );
      }, 800);
    },
    [docId, activePageId, updateDocPage],
  );

  const handleContentBlur = useCallback(
    (markdown: string, html: string) => {
      if (!docId || !activePageId) return;
      if (contentSaveTimerRef.current) {
        clearTimeout(contentSaveTimerRef.current);
      }
      setIsSaving(true);
      updateDocPage.mutate(
        {
          docId,
          pageId: activePageId,
          patch: { contentMarkdown: markdown, contentHtml: html },
        },
        {
          onSettled: () => {
            setIsSaving(false);
          },
        },
      );
    },
    [docId, activePageId, updateDocPage],
  );

  // Render tree node recursively
  const renderTreeNode = (node: PageTreeNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = !!collapsedBranches[node.id];
    const isActive = node.id === activePageId;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => navigate(`/docs/${docId}/p/${node.id}`)}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={cn(
            "group relative flex items-center gap-1.5 rounded-md py-1 pr-2 text-xs transition cursor-pointer",
            isActive
              ? "bg-cu-sidebar-active font-medium text-cu-purple"
              : "text-cu-text hover:bg-cu-hover",
          )}
        >
          {/* Collapse/Expand chevron */}
          {hasChildren ? (
            <button
              onClick={(e) => toggleBranch(node.id, e)}
              className="rounded p-0.5 text-cu-text-tertiary hover:bg-cu-hover hover:text-cu-text"
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {/* Page Icon */}
          <FileText
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              isActive ? "text-cu-purple" : "text-cu-text-tertiary",
            )}
          />

          {/* Title */}
          <span className="truncate flex-1">{node.title || "Untitled"}</span>

          {/* Hover actions */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition"
          >
            {/* Add sub-page */}
            <button
              onClick={() => handleAddPage(node.id)}
              className="rounded p-0.5 text-cu-text-tertiary hover:bg-cu-hover hover:text-cu-text"
              title="Add sub-page"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            {/* Page menu */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="rounded p-0.5 text-cu-text-tertiary hover:bg-cu-hover hover:text-cu-text data-[state=open]:opacity-100 data-[state=open]:bg-cu-hover"
                  title="Page options"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  sideOffset={4}
                  align="end"
                  className="z-50 min-w-[140px] rounded-lg border border-cu-border bg-cu-panel p-1 shadow-lg text-cu-text text-xs"
                >
                  <DropdownMenu.Item
                    onSelect={() => handleStartRenamePage(node)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none hover:bg-cu-hover focus:bg-cu-hover"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Rename</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleAddPage(node.id)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none hover:bg-cu-hover focus:bg-cu-hover"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add sub-page</span>
                  </DropdownMenu.Item>
                  {pages.length > 1 && (
                    <>
                      <DropdownMenu.Separator className="my-1 h-px bg-cu-border" />
                      <DropdownMenu.Item
                        onSelect={() => handleDeletePage(node.id)}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-cu-urgent outline-none hover:bg-cu-hover focus:bg-cu-hover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete page</span>
                      </DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        {/* Children */}
        {hasChildren && !isCollapsed && (
          <div className="space-y-0.5">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isDocLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cu-purple" />
      </div>
    );
  }

  if (docError || !doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <FileText className="h-10 w-10 text-cu-text-tertiary" />
        <h2 className="text-lg font-semibold text-cu-text">Document not found</h2>
        <p className="text-xs text-cu-text-secondary">
          The document you are trying to view does not exist or may have been deleted.
        </p>
        <Link
          to="/docs"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-cu-purple px-3.5 py-1.5 text-xs font-medium text-white hover:bg-cu-purple-dark"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Docs Hub</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-cu-bg">
      {/* Top Header Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-cu-border bg-cu-panel px-4">
        {/* Left: Sidebar Toggle & Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setTreeSidebarOpen(!treeSidebarOpen)}
            className="rounded p-1 text-cu-text-tertiary hover:bg-cu-hover hover:text-cu-text transition"
            title={treeSidebarOpen ? "Collapse pages sidebar" : "Expand pages sidebar"}
          >
            {treeSidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </button>

          <div className="flex items-center gap-1.5 text-xs text-cu-text-secondary truncate">
            <Link
              to="/docs"
              className="flex items-center gap-1 hover:text-cu-text transition font-medium"
            >
              <FileText className="h-3.5 w-3.5 text-cu-purple" />
              <span>Docs</span>
            </Link>

            <ChevronRight className="h-3.5 w-3.5 text-cu-text-tertiary shrink-0" />

            {/* Doc Title (Inline Editable) */}
            {isEditingDocTitle ? (
              <input
                type="text"
                autoFocus
                value={docTitleInput}
                onChange={(e) => setDocTitleInput(e.target.value)}
                onBlur={handleSaveDocTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveDocTitle();
                  if (e.key === "Escape") setIsEditingDocTitle(false);
                }}
                className="rounded border border-cu-purple bg-cu-bg px-1.5 py-0.5 text-xs text-cu-text outline-none max-w-[200px]"
              />
            ) : (
              <button
                onClick={() => setIsEditingDocTitle(true)}
                className="group flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-cu-hover hover:text-cu-text font-medium text-cu-text truncate max-w-[180px]"
                title="Click to rename document"
              >
                <span className="truncate">{doc.title}</span>
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-cu-text-tertiary" />
              </button>
            )}

            {pageTitle && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-cu-text-tertiary shrink-0" />
                <span className="truncate max-w-[160px] text-cu-text font-semibold">
                  {pageTitle}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Status, Mode Switch, Pin, Delete */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Save Status Indicator */}
          <div className="flex items-center gap-1 text-[11px] text-cu-text-tertiary select-none">
            {isSaving || updateDocPage.isPending ? (
              <span className="flex items-center gap-1.5 text-cu-purple">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
                <Check className="h-3 w-3" />
                <span>Saved</span>
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-cu-border" />

          {/* Mode Switch Toggle: Visual / Markdown */}
          <div className="flex items-center rounded-md border border-cu-border bg-cu-bg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setEditorMode("visual")}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors",
                editorMode === "visual"
                  ? "bg-cu-purple text-white shadow-xs font-medium"
                  : "text-cu-text-secondary hover:text-cu-text",
              )}
              title="Visual WYSIWYG Mode"
            >
              <Eye className="h-3 w-3" />
              <span>Visual</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode("markdown")}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors",
                editorMode === "markdown"
                  ? "bg-cu-purple text-white shadow-xs font-medium"
                  : "text-cu-text-secondary hover:text-cu-text",
              )}
              title="Markdown Source Mode"
            >
              <FileText className="h-3 w-3" />
              <span>Markdown</span>
            </button>
          </div>

          <div className="h-4 w-px bg-cu-border" />

          {/* Pin Button */}
          <button
            onClick={handleToggleDocPin}
            className={cn(
              "rounded p-1.5 transition",
              doc.isPinned
                ? "text-amber-400 hover:bg-cu-hover"
                : "text-cu-text-tertiary hover:bg-cu-hover hover:text-cu-text",
            )}
            title={doc.isPinned ? "Unpin document" : "Pin document"}
          >
            <Star className={cn("h-4 w-4", doc.isPinned && "fill-amber-400")} />
          </button>

          {/* Delete Doc Button */}
          <button
            onClick={() => setConfirmDeleteDocOpen(true)}
            className="rounded p-1.5 text-cu-text-tertiary hover:bg-cu-hover hover:text-cu-urgent transition"
            title="Delete document"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Body: Tree Sidebar + Document Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Tree Sidebar */}
        {treeSidebarOpen && (
          <aside className="flex w-60 shrink-0 flex-col border-r border-cu-border bg-cu-sidebar select-none">
            {/* Tree Header */}
            <div className="flex items-center justify-between border-b border-cu-border px-3 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-cu-text-tertiary">
                Pages ({pages.length})
              </span>
              <button
                onClick={() => handleAddPage(null)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text transition"
                title="Add page"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Page</span>
              </button>
            </div>

            {/* Tree Pages List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {pageTree.map((node) => renderTreeNode(node))}

              {pages.length === 0 && (
                <div className="p-4 text-center text-xs text-cu-text-tertiary">
                  No pages in this doc.
                </div>
              )}
            </div>

            {/* Tree Footer: Add Page Button */}
            <div className="border-t border-cu-border p-2">
              <button
                onClick={() => handleAddPage(null)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-cu-border py-1.5 text-xs text-cu-text-secondary hover:border-cu-border-strong hover:bg-cu-hover hover:text-cu-text transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Page</span>
              </button>
            </div>
          </aside>
        )}

        {/* Page Content View Area */}
        <main className="flex-1 overflow-y-auto">
          {isPageLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-cu-purple" />
            </div>
          ) : activePageId ? (
            <div className="mx-auto max-w-4xl px-8 py-8 md:px-12">
              {/* Editable Page Title */}
              <div className="mb-6">
                <input
                  type="text"
                  value={pageTitle}
                  onChange={(e) => handlePageTitleChange(e.target.value)}
                  onBlur={handlePageTitleBlur}
                  placeholder="Untitled"
                  className="w-full bg-transparent text-3xl font-bold tracking-tight text-cu-text placeholder:text-cu-text-tertiary outline-none border-b border-transparent focus:border-cu-border/50 pb-2 transition"
                />
              </div>

              {/* Doc Editor Component */}
              <div className="rounded-xl border border-cu-border bg-cu-panel shadow-2xs overflow-hidden">
                <DocEditor
                  key={activePageId}
                  markdown={activePageData?.contentMarkdown ?? ""}
                  mode={editorMode}
                  onModeChange={setEditorMode}
                  onChange={handleContentChange}
                  onBlur={handleContentBlur}
                  placeholder="Type '/' for commands or start writing notes, specs, or guides..."
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <FileText className="h-10 w-10 text-cu-text-tertiary" />
              <p className="text-sm font-medium text-cu-text">No page selected</p>
              <button
                onClick={() => handleAddPage(null)}
                className="flex items-center gap-1.5 rounded-md bg-cu-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-cu-purple-dark"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create a page</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Rename Page Dialog */}
      {renamingPage && (
        <Dialog.Root open={!!renamingPage} onOpenChange={(open) => !open && setRenamingPage(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" />
            <Dialog.Content className="fixed inset-0 z-50 m-auto h-fit max-h-[85vh] w-[min(420px,92vw)] rounded-xl border border-cu-border bg-cu-panel p-5 shadow-2xl outline-none">
              <div className="flex items-center justify-between border-b border-cu-border pb-3">
                <Dialog.Title className="text-[14px] font-semibold text-cu-text">
                  Rename page
                </Dialog.Title>
                <Dialog.Close className="rounded p-1 text-cu-text-tertiary hover:bg-cu-hover">
                  <X className="h-4 w-4" />
                </Dialog.Close>
              </div>
              <form onSubmit={handleRenamePageSubmit} className="pt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-cu-text-secondary mb-1.5">
                    Page Title
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={renamePageTitle}
                    onChange={(e) => setRenamePageTitle(e.target.value)}
                    placeholder="Enter page title..."
                    className="w-full rounded-md border border-cu-border bg-cu-bg px-3 py-1.5 text-xs text-cu-text outline-none focus:border-cu-purple"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRenamingPage(null)}
                    className="rounded-md border border-cu-border px-3 py-1.5 text-xs font-medium text-cu-text-secondary hover:bg-cu-hover"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!renamePageTitle.trim() || updateDocPage.isPending}
                    className="rounded-md bg-cu-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-cu-purple-dark disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Delete Doc Confirmation Dialog */}
      {confirmDeleteDocOpen && (
        <Dialog.Root open={confirmDeleteDocOpen} onOpenChange={setConfirmDeleteDocOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" />
            <Dialog.Content className="fixed inset-0 z-50 m-auto h-fit max-h-[85vh] w-[min(420px,92vw)] rounded-xl border border-cu-border bg-cu-panel p-5 shadow-2xl outline-none">
              <Dialog.Title className="text-[14px] font-semibold text-cu-text">
                Delete document
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-xs leading-relaxed text-cu-text-secondary">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-cu-text">&quot;{doc.title}&quot;</span>? This
                action cannot be undone and will delete all pages in this document.
              </Dialog.Description>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteDocOpen(false)}
                  className="rounded-md border border-cu-border px-3 py-1.5 text-xs font-medium text-cu-text-secondary hover:bg-cu-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteDoc.isPending}
                  onClick={handleDeleteDoc}
                  className="rounded-md bg-cu-urgent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {deleteDoc.isPending ? "Deleting..." : "Delete Doc"}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
