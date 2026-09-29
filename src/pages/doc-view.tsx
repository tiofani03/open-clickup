"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
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
  Smile,
  Image as ImageIcon,
  Palette,
  MessageSquare,
} from "lucide-react";
import {
  useDoc,
  useDocPage,
  useUpdateDoc,
  useDeleteDoc,
  useCreateDocPage,
  useUpdateDocPage,
  useDeleteDocPage,
  usePublishDocPage,
  useDiscardDocDraft,
} from "@/lib/hooks";
import { DocEditor } from "@/components/doc/doc-editor";
import { DocComments } from "@/components/doc/doc-comments";
import { cn } from "@/lib/utils";
import type { DocPageItem } from "@/lib/queries";

interface PageTreeNode extends DocPageItem {
  children: PageTreeNode[];
}

const COVER_PRESETS = [
  { id: "purple", label: "Cosmic", class: "bg-gradient-to-r from-violet-600/40 via-purple-600/40 to-pink-500/40" },
  { id: "ocean", label: "Ocean", class: "bg-gradient-to-r from-blue-600/40 via-cyan-600/40 to-teal-500/40" },
  { id: "emerald", label: "Forest", class: "bg-gradient-to-r from-emerald-600/40 via-teal-600/40 to-lime-500/40" },
  { id: "sunset", label: "Sunset", class: "bg-gradient-to-r from-amber-600/40 via-orange-600/40 to-rose-500/40" },
  { id: "slate", label: "Slate", class: "bg-gradient-to-r from-slate-700/50 via-zinc-700/50 to-neutral-700/50" },
];

const ICON_PRESETS = ["📄", "🚀", "💡", "📝", "🎯", "⚡", "📚", "🛠️", "📌", "🌟", "🎨", "💻", "📊", "📋", "✨", "🔥"];

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
  const publishDocPage = usePublishDocPage(docId);
  const discardDocDraft = useDiscardDocDraft(docId);

  // UI state
  const [treeSidebarOpen, setTreeSidebarOpen] = useState(true);
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});
  const [isEditing, setIsEditing] = useState(false);
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
          setIsEditing(true);
          navigate(`/docs/${docId}/p/${newPage.id}`);
        },
      },
    );
  };

  // Reset editing mode when page changes
  useEffect(() => {
    setIsEditing(false);
    lastSavedContentRef.current = null;
  }, [activePageId]);

  const handleDeletePage = (pageToDeleteId: string) => {
    if (!docId || pages.length <= 1) return;
    deleteDocPage.mutate(
      { docId, pageId: pageToDeleteId },
      {
        onSuccess: () => {
          const isDescendant = (pageId: string, parentId: string): boolean => {
            let curr = pages.find((p) => p.id === pageId);
            while (curr && curr.parentPageId) {
              const currentParentId: string = curr.parentPageId;
              if (currentParentId === parentId) return true;
              curr = pages.find((p) => p.id === currentParentId);
            }
            return false;
          };

          const isTargetActiveOrDescendant =
            activePageId === pageToDeleteId ||
            (activePageId ? isDescendant(activePageId, pageToDeleteId) : false);

          if (isTargetActiveOrDescendant) {
            const remaining = pages.filter(
              (p) => p.id !== pageToDeleteId && !isDescendant(p.id, pageToDeleteId),
            );
            const nextTarget =
              pages.find((p) => !p.parentPageId && p.id !== pageToDeleteId) ?? remaining[0];
            if (nextTarget) {
              navigate(`/docs/${docId}/p/${nextTarget.id}`);
            } else {
              navigate(`/docs`);
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

  // Debounced Page Content Change (auto-saves draft while editing)
  const handleContentChange = useCallback(
    (markdown: string, html: string) => {
      if (!docId || !activePageId || !isEditing) return;
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
            patch: {
              draftMarkdown: markdown,
              draftHtml: html,
              hasDraft: true,
            },
          },
          {
            onSettled: () => {
              setIsSaving(false);
            },
          },
        );
      }, 800);
    },
    [docId, activePageId, isEditing, updateDocPage],
  );

  const handleContentBlur = useCallback(
    (markdown: string, html: string) => {
      if (!docId || !activePageId || !isEditing) return;
      if (contentSaveTimerRef.current) {
        clearTimeout(contentSaveTimerRef.current);
      }
      setIsSaving(true);
      updateDocPage.mutate(
        {
          docId,
          pageId: activePageId,
          patch: {
            draftMarkdown: markdown,
            draftHtml: html,
            hasDraft: true,
          },
        },
        {
          onSettled: () => {
            setIsSaving(false);
          },
        },
      );
    },
    [docId, activePageId, isEditing, updateDocPage],
  );

  // Publish active page draft to live content
  const handlePublish = useCallback(async () => {
    if (!docId || !activePageId || publishDocPage.isPending) return;
    if (contentSaveTimerRef.current) {
      clearTimeout(contentSaveTimerRef.current);
    }
    if (lastSavedContentRef.current) {
      await updateDocPage.mutateAsync({
        docId,
        pageId: activePageId,
        patch: {
          draftMarkdown: lastSavedContentRef.current.markdown,
          draftHtml: lastSavedContentRef.current.html,
          hasDraft: true,
        },
      });
    }
    await publishDocPage.mutateAsync({
      docId,
      pageId: activePageId,
    });
    setIsEditing(false);
    setIsSaving(false);
    lastSavedContentRef.current = null;
  }, [docId, activePageId, publishDocPage, updateDocPage]);

  // Discard working draft back to last published content
  const handleDiscardDraft = useCallback(async () => {
    if (!docId || !activePageId || discardDocDraft.isPending) return;
    if (contentSaveTimerRef.current) {
      clearTimeout(contentSaveTimerRef.current);
    }
    lastSavedContentRef.current = null;
    await discardDocDraft.mutateAsync({
      docId,
      pageId: activePageId,
    });
    setIsEditing(false);
    setIsSaving(false);
  }, [docId, activePageId, discardDocDraft]);

  // Keyboard shortcut listener: 'e' for edit, Cmd+Enter for publish
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (!isEditing && e.key.toLowerCase() === "e" && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsEditing(true);
      } else if (isEditing && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handlePublish();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, handlePublish]);

  const handleSelectCover = (coverClass: string) => {
    if (!docId || !activePageId) return;
    updateDocPage.mutate({
      docId,
      pageId: activePageId,
      patch: { coverImage: coverClass },
    });
  };

  const handleRemoveCover = () => {
    if (!docId || !activePageId) return;
    updateDocPage.mutate({
      docId,
      pageId: activePageId,
      patch: { coverImage: null },
    });
  };

  const handleSelectIcon = (iconChar: string) => {
    if (!docId || !activePageId) return;
    updateDocPage.mutate({
      docId,
      pageId: activePageId,
      patch: { icon: iconChar },
    });
  };

  const handleRemoveIcon = () => {
    if (!docId || !activePageId) return;
    updateDocPage.mutate({
      docId,
      pageId: activePageId,
      patch: { icon: null },
    });
  };

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
          {node.icon ? (
            <span className="text-xs shrink-0 select-none">{node.icon}</span>
          ) : (
            <FileText
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                isActive ? "text-cu-purple" : "text-cu-text-tertiary",
              )}
            />
          )}

          {/* Title */}
          <span className="truncate flex-1">{node.title || "Untitled"}</span>

          {/* Draft badge */}
          {node.hasDraft && (
            <span className="shrink-0 text-[9px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded uppercase tracking-wide">
              Draft
            </span>
          )}

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

        {/* Right: Confluence Workflow (Draft / Edit / Publish), Pin, Delete */}
        <div className="flex items-center gap-2.5 shrink-0">
          {!isEditing ? (
            /* View Mode Controls */
            <div className="flex items-center gap-2">
              {activePageData?.hasDraft && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Unpublished changes
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("doc-comments");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-1.5 rounded-md bg-cu-panel border border-cu-border hover:bg-cu-hover px-2.5 py-1 text-xs font-medium text-cu-text-secondary hover:text-cu-text transition shadow-xs cursor-pointer"
                title="Scroll down to comments"
              >
                <MessageSquare className="h-3.5 w-3.5 text-cu-purple" />
                <span>Comments</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 rounded-md bg-cu-panel border border-cu-border hover:bg-cu-hover px-2.5 py-1 text-xs font-medium text-cu-text transition shadow-xs cursor-pointer"
                title="Edit page (Press 'e')"
              >
                <Pencil className="h-3.5 w-3.5 text-cu-purple" />
                <span>Edit</span>
                <kbd className="hidden sm:inline-block ml-1 text-[10px] text-cu-text-tertiary font-mono bg-cu-subtle/50 px-1 rounded border border-cu-border/50">
                  e
                </kbd>
              </button>
            </div>
          ) : (
            /* Edit Mode Controls */
            <div className="flex items-center gap-2">
              {/* Draft Save Status Indicator */}
              <div className="flex items-center gap-1 text-[11px] text-cu-text-tertiary select-none mr-1">
                {isSaving || updateDocPage.isPending ? (
                  <span className="flex items-center gap-1.5 text-amber-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Saving draft...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
                    <Check className="h-3 w-3" />
                    <span>Draft saved</span>
                  </span>
                )}
              </div>

              {activePageData?.hasDraft && (
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  disabled={discardDocDraft.isPending}
                  className="rounded-md px-2.5 py-1 text-xs text-cu-text-tertiary hover:text-cu-urgent hover:bg-cu-hover transition cursor-pointer"
                  title="Revert draft back to last published version"
                >
                  Discard
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-md px-2.5 py-1 text-xs text-cu-text-secondary hover:text-cu-text hover:bg-cu-hover transition cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handlePublish}
                disabled={publishDocPage.isPending}
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3.5 py-1 text-xs font-semibold shadow-xs transition cursor-pointer"
                title="Publish page to live view (Cmd+Enter)"
              >
                {publishDocPage.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>{activePageData?.isPublished ? "Update" : "Publish"}</span>
              </button>
            </div>
          )}

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
            <div className="relative min-h-full pb-28">
              {/* Cover Banner if set */}
              {activePageData?.coverImage ? (
                <div className={cn("group relative h-44 w-full transition-all", activePageData.coverImage)}>
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="absolute bottom-3 right-6 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <button className="flex items-center gap-1 rounded-md bg-black/50 backdrop-blur-md px-2.5 py-1 text-xs font-medium text-white hover:bg-black/70 transition">
                          <Palette className="h-3.5 w-3.5" />
                          <span>Change cover</span>
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                          sideOffset={6}
                          align="end"
                          className="z-50 w-64 rounded-xl border border-cu-border bg-cu-panel p-2 shadow-2xl text-cu-text"
                        >
                          <div className="text-[11px] font-semibold text-cu-text-tertiary px-1 pb-1.5 uppercase tracking-wider">
                            Select Gradient
                          </div>
                          <div className="grid grid-cols-5 gap-1.5 py-1">
                            {COVER_PRESETS.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => handleSelectCover(c.class)}
                                className={cn("h-8 rounded-lg border border-white/20 transition hover:scale-105", c.class)}
                                title={c.label}
                              />
                            ))}
                          </div>
                          <div className="border-t border-cu-border mt-2 pt-1.5">
                            <button
                              onClick={handleRemoveCover}
                              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cu-urgent hover:bg-cu-urgent/10"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Remove cover</span>
                            </button>
                          </div>
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>

                    <button
                      onClick={handleRemoveCover}
                      className="rounded-md bg-black/50 backdrop-blur-md p-1 text-white hover:bg-black/70 transition"
                      title="Remove cover"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mx-auto max-w-4xl px-8 md:px-14">
                {/* Notion Header Actions (Icon, Cover buttons) */}
                <div className={cn("group/header relative pt-6", activePageData?.coverImage && "-mt-10")}>
                  {/* Icon badge if exists */}
                  {activePageData?.icon ? (
                    <div className="mb-3 flex items-center gap-2">
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button
                            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cu-panel text-3xl shadow-md border border-cu-border transition hover:bg-cu-hover hover:scale-105 select-none"
                            title="Change icon"
                          >
                            <span>{activePageData.icon}</span>
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            sideOffset={8}
                            align="start"
                            className="z-50 w-64 rounded-xl border border-cu-border bg-cu-panel p-2.5 shadow-2xl text-cu-text"
                          >
                            <div className="text-[11px] font-semibold text-cu-text-tertiary px-1 pb-1.5 uppercase tracking-wider">
                              Choose an icon
                            </div>
                            <div className="grid grid-cols-6 gap-1 py-1">
                              {ICON_PRESETS.map((ic) => (
                                <button
                                  key={ic}
                                  onClick={() => handleSelectIcon(ic)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-cu-hover transition"
                                >
                                  {ic}
                                </button>
                              ))}
                            </div>
                            <div className="border-t border-cu-border mt-2 pt-1.5">
                              <button
                                onClick={handleRemoveIcon}
                                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cu-urgent hover:bg-cu-urgent/10"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Remove icon</span>
                              </button>
                            </div>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                  ) : null}

                  {/* Hover buttons for Add icon & Add cover when in edit mode */}
                  {isEditing && (
                    <div className="flex items-center gap-2 opacity-0 group-hover/header:opacity-100 transition-opacity mb-2">
                      {!activePageData?.icon && (
                        <Popover.Root>
                          <Popover.Trigger asChild>
                            <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cu-text-tertiary hover:bg-cu-hover hover:text-cu-text transition cursor-pointer">
                              <Smile className="h-3.5 w-3.5" />
                              <span>Add icon</span>
                            </button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content
                              sideOffset={6}
                              align="start"
                              className="z-50 w-64 rounded-xl border border-cu-border bg-cu-panel p-2.5 shadow-2xl text-cu-text"
                            >
                              <div className="text-[11px] font-semibold text-cu-text-tertiary px-1 pb-1.5 uppercase tracking-wider">
                                Choose an icon
                              </div>
                              <div className="grid grid-cols-6 gap-1 py-1">
                                {ICON_PRESETS.map((ic) => (
                                  <button
                                    key={ic}
                                    onClick={() => handleSelectIcon(ic)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-cu-hover transition cursor-pointer"
                                  >
                                    {ic}
                                  </button>
                                ))}
                              </div>
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                      )}

                      {!activePageData?.coverImage && (
                        <button
                          onClick={() => handleSelectCover(COVER_PRESETS[0].class)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cu-text-tertiary hover:bg-cu-hover hover:text-cu-text transition cursor-pointer"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span>Add cover</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Page Title: Editable Input in Edit Mode, Readonly Heading in View Mode */}
                  <div className="mb-6">
                    {isEditing ? (
                      <input
                        type="text"
                        value={pageTitle}
                        onChange={(e) => handlePageTitleChange(e.target.value)}
                        onBlur={handlePageTitleBlur}
                        placeholder="Untitled"
                        className="w-full bg-transparent text-4xl font-extrabold tracking-tight text-cu-text placeholder:text-cu-text-tertiary outline-none border-none py-1 transition leading-tight"
                      />
                    ) : (
                      <h1 className="w-full text-4xl font-extrabold tracking-tight text-cu-text py-1 leading-tight select-text">
                        {pageTitle || "Untitled"}
                      </h1>
                    )}
                  </div>
                </div>

                {/* Seamless Doc Editor Component */}
                <DocEditor
                  key={`${activePageId}-${isEditing ? "edit" : "view"}`}
                  markdown={
                    isEditing
                      ? (activePageData?.hasDraft && activePageData.draftMarkdown !== undefined && activePageData.draftMarkdown !== null
                          ? activePageData.draftMarkdown
                          : (activePageData?.contentMarkdown ?? ""))
                      : (activePageData?.contentMarkdown ?? "")
                  }
                  readOnly={!isEditing}
                  onChange={handleContentChange}
                  onBlur={handleContentBlur}
                  placeholder="Type '/' for commands, or start writing notes, specs, or guides..."
                />

                {/* Threaded Doc Comments at Bottom of Document */}
                {docId && activePageId && (
                  <DocComments docId={docId} pageId={activePageId} />
                )}
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
