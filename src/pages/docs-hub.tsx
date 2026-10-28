"use client";

import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import {
  FileText,
  Plus,
  Search,
  Star,
  MoreVertical,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  ExternalLink,
  X,
  Loader2,
  Folder,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useDocs, useCreateDoc, useUpdateDoc, useDeleteDoc } from "@/lib/hooks";
import { useWorkspace } from "@/components/workspace-context";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { DocItem } from "@/lib/queries";

export default function DocsHubPage() {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const { data: docs = [], isLoading } = useDocs();
  const createDoc = useCreateDoc();
  const updateDoc = useUpdateDoc();
  const deleteDoc = useDeleteDoc();

  const [search, setSearch] = useState("");
  const [renamingDoc, setRenamingDoc] = useState<DocItem | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deletingDoc, setDeletingDoc] = useState<DocItem | null>(null);

  const spacesMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color?: string }>();
    for (const s of workspace.spaces) {
      map.set(s.id, { id: s.id, name: s.name, color: s.color });
    }
    return map;
  }, [workspace.spaces]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => d.title.toLowerCase().includes(q));
  }, [docs, search]);

  const pinnedDocs = useMemo(() => {
    return filteredDocs.filter((d) => d.isPinned);
  }, [filteredDocs]);

  const recentDocs = useMemo(() => {
    return [...filteredDocs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [filteredDocs]);

  const handleCreateDoc = () => {
    createDoc.mutate(
      { title: "Untitled Doc" },
      {
        onSuccess: (res) => {
          const id = res?.doc?.id ?? (res as unknown as { id: string })?.id;
          if (id) {
            navigate(`/docs/${id}`);
          }
        },
      },
    );
  };

  const handleTogglePin = (doc: DocItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    updateDoc.mutate({
      docId: doc.id,
      patch: { isPinned: !doc.isPinned },
    });
  };

  const handleStartRename = (doc: DocItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenamingDoc(doc);
    setRenameTitle(doc.title);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingDoc || !renameTitle.trim()) return;
    updateDoc.mutate(
      {
        docId: renamingDoc.id,
        patch: { title: renameTitle.trim() },
      },
      {
        onSuccess: () => {
          setRenamingDoc(null);
        },
      },
    );
  };

  const handleDeleteConfirm = () => {
    if (!deletingDoc) return;
    deleteDoc.mutate(deletingDoc.id, {
      onSuccess: () => {
        setDeletingDoc(null);
      },
    });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cu-purple-light dark:bg-cu-purple/20 text-cu-purple">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-cu-text">Docs</h1>
              <p className="text-xs text-cu-text-secondary">
                Create, share, and organize documents and wikis across your workspace.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cu-text-tertiary" />
              <input
                type="text"
                placeholder="Search docs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-cu-border bg-cu-panel py-1.5 pl-8 pr-7 text-xs text-cu-text placeholder:text-cu-text-tertiary focus:border-cu-purple focus:outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2.5 rounded text-cu-text-tertiary hover:text-cu-text"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* New Doc Button */}
            <button
              onClick={handleCreateDoc}
              disabled={createDoc.isPending}
              className="flex items-center gap-1.5 rounded-md bg-cu-purple px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-cu-purple-dark transition disabled:opacity-50"
            >
              {createDoc.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>New Doc</span>
            </button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4 py-8">
            <div className="h-8 w-40 animate-pulse rounded bg-cu-hover" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl border border-cu-border bg-cu-panel p-4" />
              ))}
            </div>
          </div>
        )}

        {/* Empty state: No docs created yet */}
        {!isLoading && docs.length === 0 && (
          <div className="py-12">
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title="No documents yet"
              subtitle="Capture knowledge, create meeting notes, or build product wikis together."
              action={
                <button
                  onClick={handleCreateDoc}
                  disabled={createDoc.isPending}
                  className="mt-2 flex items-center gap-1.5 rounded-md bg-cu-purple px-4 py-2 text-xs font-medium text-white hover:bg-cu-purple-dark transition shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create your first document</span>
                </button>
              }
            />
          </div>
        )}

        {/* Empty state: Filter search mismatch */}
        {!isLoading && docs.length > 0 && filteredDocs.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-cu-text">No documents matching &quot;{search}&quot;</p>
            <p className="mt-1 text-xs text-cu-text-tertiary">Try adjusting your search query.</p>
            <button
              onClick={() => setSearch("")}
              className="mt-3 text-xs font-medium text-cu-purple hover:underline"
            >
              Clear search filter
            </button>
          </div>
        )}

        {!isLoading && filteredDocs.length > 0 && (
          <div className="space-y-8">
            {/* Pinned Section */}
            {pinnedDocs.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold uppercase tracking-wider text-cu-text-tertiary">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span>Pinned</span>
                  <span className="ml-1 rounded-full bg-cu-hover px-1.5 py-0.2 text-[10px] text-cu-text-secondary">
                    {pinnedDocs.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {pinnedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => navigate(`/docs/${doc.id}`)}
                      className="group relative flex flex-col justify-between rounded-xl border border-cu-border bg-cu-panel p-4 shadow-2xs hover:border-cu-border-strong hover:shadow-xs transition cursor-pointer"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cu-hover text-cu-text-secondary group-hover:text-cu-purple group-hover:bg-cu-purple-light/20 transition-colors">
                              <FileText className="h-4 w-4" />
                            </span>
                            <span className="truncate text-sm font-medium text-cu-text group-hover:text-cu-purple transition-colors">
                              {doc.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => handleTogglePin(doc, e)}
                              className="rounded p-1 text-amber-400 hover:bg-cu-hover transition"
                              title="Unpin document"
                            >
                              <Star className="h-4 w-4 fill-amber-400" />
                            </button>
                            <DocActionMenu
                              doc={doc}
                              onOpen={() => navigate(`/docs/${doc.id}`)}
                              onPinToggle={() => handleTogglePin(doc)}
                              onRename={() => handleStartRename(doc)}
                              onDelete={() => setDeletingDoc(doc)}
                            />
                          </div>
                        </div>

                        {doc.spaceId && spacesMap.has(doc.spaceId) && (
                          <div className="flex items-center gap-1.5 text-[11px] text-cu-text-tertiary">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: spacesMap.get(doc.spaceId)?.color || "#7c3aed" }}
                            />
                            <span className="truncate">{spacesMap.get(doc.spaceId)?.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-cu-border/50 pt-3 text-[11px] text-cu-text-tertiary">
                        <span>Updated {formatRelativeTime(doc.updatedAt)}</span>
                        {doc.creator && (
                          <Avatar
                            user={{
                              name: doc.creator.name,
                              color: doc.creator.color,
                              avatarUrl: doc.creator.avatarUrl,
                            }}
                            size="sm"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Docs Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cu-text-tertiary">
                  <FileText className="h-3.5 w-3.5" />
                  <span>All Documents</span>
                  <span className="ml-1 rounded-full bg-cu-hover px-1.5 py-0.2 text-[10px] text-cu-text-secondary">
                    {recentDocs.length}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-cu-border bg-cu-panel shadow-2xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-cu-border bg-cu-bg/50 text-cu-text-tertiary">
                    <tr>
                      <th className="py-2.5 pl-4 pr-3 font-semibold">Name</th>
                      <th className="hidden sm:table-cell py-2.5 px-3 font-semibold">Location</th>
                      <th className="hidden md:table-cell py-2.5 px-3 font-semibold">Author</th>
                      <th className="py-2.5 px-3 font-semibold">Updated</th>
                      <th className="py-2.5 pr-4 pl-3 w-10 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cu-border">
                    {recentDocs.map((doc) => {
                      const space = doc.spaceId ? spacesMap.get(doc.spaceId) : null;
                      return (
                        <tr
                          key={doc.id}
                          onClick={() => navigate(`/docs/${doc.id}`)}
                          className="group hover:bg-cu-hover cursor-pointer transition-colors"
                        >
                          {/* Name */}
                          <td className="py-3 pl-4 pr-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-cu-hover text-cu-text-secondary group-hover:text-cu-purple transition-colors">
                                <FileText className="h-3.5 w-3.5" />
                              </span>
                              <span className="font-medium text-cu-text group-hover:text-cu-purple transition-colors truncate max-w-[280px]">
                                {doc.title}
                              </span>
                              {doc.isPinned && (
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                              )}
                            </div>
                          </td>

                          {/* Location */}
                          <td className="hidden sm:table-cell py-3 px-3 text-cu-text-secondary">
                            <div className="flex items-center gap-1.5 truncate max-w-[160px]">
                              {space ? (
                                <>
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: space.color || "#7c3aed" }}
                                  />
                                  <span className="truncate">{space.name}</span>
                                </>
                              ) : (
                                <>
                                  <Folder className="h-3.5 w-3.5 text-cu-text-tertiary shrink-0" />
                                  <span className="truncate">Workspace</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Author */}
                          <td className="hidden md:table-cell py-3 px-3 text-cu-text-secondary">
                            {doc.creator ? (
                              <div className="flex items-center gap-2">
                                <Avatar
                                  user={{
                                    name: doc.creator.name,
                                    color: doc.creator.color,
                                    avatarUrl: doc.creator.avatarUrl,
                                  }}
                                  size="xs"
                                />
                                <span className="truncate max-w-[120px]">{doc.creator.name}</span>
                              </div>
                            ) : (
                              <span className="text-cu-text-tertiary">—</span>
                            )}
                          </td>

                          {/* Updated */}
                          <td className="py-3 px-3 text-cu-text-tertiary whitespace-nowrap">
                            {formatRelativeTime(doc.updatedAt)}
                          </td>

                          {/* Action Menu */}
                          <td className="py-3 pr-4 pl-3 text-right">
                            <div onClick={(e) => e.stopPropagation()}>
                              <DocActionMenu
                                doc={doc}
                                onOpen={() => navigate(`/docs/${doc.id}`)}
                                onPinToggle={() => handleTogglePin(doc)}
                                onRename={() => handleStartRename(doc)}
                                onDelete={() => setDeletingDoc(doc)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Rename Dialog */}
        {renamingDoc && (
          <Dialog.Root open={!!renamingDoc} onOpenChange={(open) => !open && setRenamingDoc(null)}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" />
              <Dialog.Content className="fixed inset-0 z-50 m-auto h-fit max-h-[85vh] w-[min(420px,92vw)] rounded-xl border border-cu-border bg-cu-panel p-5 shadow-2xl outline-none">
                <div className="flex items-center justify-between border-b border-cu-border pb-3">
                  <Dialog.Title className="text-[14px] font-semibold text-cu-text">
                    Rename document
                  </Dialog.Title>
                  <Dialog.Close className="rounded p-1 text-cu-text-tertiary hover:bg-cu-hover">
                    <X className="h-4 w-4" />
                  </Dialog.Close>
                </div>
                <form onSubmit={handleRenameSubmit} className="pt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-cu-text-secondary mb-1.5">
                      Document Title
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={renameTitle}
                      onChange={(e) => setRenameTitle(e.target.value)}
                      placeholder="Enter doc title..."
                      className="w-full rounded-md border border-cu-border bg-cu-bg px-3 py-1.5 text-xs text-cu-text outline-none focus:border-cu-purple"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setRenamingDoc(null)}
                      className="rounded-md border border-cu-border px-3 py-1.5 text-xs font-medium text-cu-text-secondary hover:bg-cu-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!renameTitle.trim() || updateDoc.isPending}
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

        {/* Delete Confirmation Dialog */}
        {deletingDoc && (
          <Dialog.Root open={!!deletingDoc} onOpenChange={(open) => !open && setDeletingDoc(null)}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" />
              <Dialog.Content className="fixed inset-0 z-50 m-auto h-fit max-h-[85vh] w-[min(420px,92vw)] rounded-xl border border-cu-border bg-cu-panel p-5 shadow-2xl outline-none">
                <Dialog.Title className="text-[14px] font-semibold text-cu-text">
                  Delete document
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-xs leading-relaxed text-cu-text-secondary">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-cu-text">&quot;{deletingDoc.title}&quot;</span>?
                  This action cannot be undone and will delete all pages in this document.
                </Dialog.Description>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingDoc(null)}
                    className="rounded-md border border-cu-border px-3 py-1.5 text-xs font-medium text-cu-text-secondary hover:bg-cu-hover"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteDoc.isPending}
                    onClick={handleDeleteConfirm}
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
    </div>
  );
}

function DocActionMenu({
  doc,
  onOpen,
  onPinToggle,
  onRename,
  onDelete,
}: {
  doc: DocItem;
  onOpen: () => void;
  onPinToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="rounded p-1 text-cu-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-cu-hover hover:text-cu-text data-[state=open]:opacity-100 data-[state=open]:bg-cu-hover transition"
          title="More actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          align="end"
          className="z-50 min-w-[150px] rounded-lg border border-cu-border bg-cu-panel p-1 shadow-lg text-cu-text text-[13px]"
        >
          <DropdownMenu.Item
            onSelect={onOpen}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none hover:bg-cu-hover focus:bg-cu-hover"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onPinToggle}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none hover:bg-cu-hover focus:bg-cu-hover"
          >
            {doc.isPinned ? (
              <>
                <PinOff className="h-3.5 w-3.5" />
                <span>Unpin</span>
              </>
            ) : (
              <>
                <Pin className="h-3.5 w-3.5" />
                <span>Pin to top</span>
              </>
            )}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onRename}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none hover:bg-cu-hover focus:bg-cu-hover"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Rename</span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-cu-border" />
          <DropdownMenu.Item
            onSelect={onDelete}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none text-cu-urgent hover:bg-cu-hover focus:bg-cu-hover"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return dateStr;
  }
}
