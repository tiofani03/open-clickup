"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { apiGet, apiSend } from "@/lib/api";
import type {
  ListData,
  TaskWithRelations,
  UserLite,
  WorkspaceTree,
  TaskPatch,
  DocItem,
  DocPageItem,
  DocDetail,
  CreateDocPayload,
  UpdateDocPayload,
  CreateDocPagePayload,
  UpdateDocPagePayload,
} from "@/lib/queries";

export type Bootstrap = { currentUser: UserLite; workspace: WorkspaceTree; favorites: string[] };

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => apiSend<{ favorited: boolean }>(`/api/lists/${listId}/favorite`, "POST"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bootstrap"] }),
  });
}

// ----------------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------------

/** Subscribe to the SSE stream and invalidate caches so collaborators' changes appear live. */
export function useRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as { type: string; listId?: string };
        if (event.type === "list" && event.listId) {
          qc.invalidateQueries({ queryKey: ["list", event.listId] });
          qc.invalidateQueries({ queryKey: ["task"] });
          qc.invalidateQueries({ queryKey: ["my-tasks"] });
        } else if (event.type === "bootstrap") {
          qc.invalidateQueries({ queryKey: ["bootstrap"] });
        } else if (event.type === "doc") {
          qc.invalidateQueries({ queryKey: ["docs"] });
          qc.invalidateQueries({ queryKey: ["doc"] });
          qc.invalidateQueries({ queryKey: ["doc-page"] });
        }
        qc.invalidateQueries({ queryKey: ["notifications"] });
      } catch {
        /* ignore malformed event */
      }
    };
    return () => es.close();
  }, [qc]);
}

export type NotificationItem = {
  id: string;
  type: string;
  body: string;
  read: boolean;
  createdAt: string;
  actor: UserLite | null;
  task: { id: string; name: string; listId: string } | null;
};

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<{ notifications: NotificationItem[]; unread: number }>("/api/notifications"),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => apiSend("/api/notifications/read", "POST", { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export type MyTask = {
  id: string;
  name: string;
  listId: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: { name: string; color: string; type: string };
  list: { name: string; space: { name: string; color: string } };
};

export function useMyTasks() {
  return useQuery({
    queryKey: ["my-tasks"],
    queryFn: () => apiGet<{ tasks: MyTask[] }>("/api/me/tasks"),
    placeholderData: keepPreviousData,
  });
}

export type TaskTemplate = {
  id: string;
  name: string;
  taskName: string;
  description: string | null;
  priority: string | null;
  checklists: { name: string; items: string[] }[] | null;
};

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () => apiGet<TaskTemplate[]>("/api/templates"),
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { fromTaskId: string; name: string }) =>
      apiSend<TaskTemplate>("/api/templates", "POST", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend(`/api/templates/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useApplyTemplate(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      apiSend<TaskWithRelations>(`/api/lists/${listId}/apply-template`, "POST", { templateId }),
    onSuccess: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}

export function useBootstrap() {
  return useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => apiGet<Bootstrap>("/api/bootstrap"),
    staleTime: 5 * 60_000,
  });
}

export function useList(listId: string | undefined) {
  return useQuery({
    queryKey: ["list", listId],
    queryFn: () => apiGet<ListData>(`/api/lists/${listId}`),
    enabled: !!listId,
    // keep the previous list visible while the next one loads (no skeleton flash)
    placeholderData: keepPreviousData,
  });
}

// ----------------------------------------------------------------------------
// Hierarchy CRUD (spaces / folders / lists) — all refresh the sidebar tree
// ----------------------------------------------------------------------------

type ListLite = { id: string; name: string; spaceId: string };

export function useHierarchy() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["bootstrap"] });

  const createSpace = useMutation({
    mutationFn: (name: string) => apiSend<{ id: string }>("/api/spaces", "POST", { name }),
    onSuccess: refresh,
  });
  const createFolder = useMutation({
    mutationFn: (v: { spaceId: string; name: string }) =>
      apiSend<{ id: string }>("/api/folders", "POST", v),
    onSuccess: refresh,
  });
  const createList = useMutation({
    mutationFn: (v: { spaceId: string; folderId?: string | null; name: string }) =>
      apiSend<ListLite>("/api/lists", "POST", v),
    onSuccess: refresh,
  });
  const rename = useMutation({
    mutationFn: (v: { kind: "spaces" | "folders" | "lists"; id: string; name: string }) =>
      apiSend(`/api/${v.kind}/${v.id}`, "PATCH", { name: v.name }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (v: { kind: "spaces" | "folders" | "lists"; id: string }) =>
      apiSend(`/api/${v.kind}/${v.id}`, "DELETE"),
    onSuccess: refresh,
  });

  return { createSpace, createFolder, createList, rename, remove };
}

export type TagModel = { id: string; spaceId: string; name: string; color: string };

export function useTags(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["tags", spaceId],
    queryFn: () => apiGet<TagModel[]>(`/api/spaces/${spaceId}/tags`),
    enabled: !!spaceId,
  });
}

export function useCreateTag(spaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiSend<TagModel>(`/api/spaces/${spaceId}/tags`, "POST", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags", spaceId] }),
  });
}

// ----------------------------------------------------------------------------
// Mutations (optimistic where it matters for UX feel)
// ----------------------------------------------------------------------------

export function useUpdateTask(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: TaskPatch }) =>
      apiSend<TaskWithRelations>(`/api/tasks/${taskId}`, "PATCH", patch),
    onMutate: async ({ taskId, patch }) => {
      if (!listId) return;
      await qc.cancelQueries({ queryKey: ["list", listId] });
      const prev = qc.getQueryData<ListData>(["list", listId]);
      if (prev) {
        qc.setQueryData<ListData>(["list", listId], {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? applyOptimistic(t, patch) : t,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev && listId) qc.setQueryData(["list", listId], ctx.prev);
    },
    onSettled: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}

export function useCreateTask(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      listId: string;
      name: string;
      statusId?: string;
      parentId?: string | null;
      priority?: string | null;
      assigneeIds?: string[];
    }) => apiSend<TaskWithRelations>("/api/tasks", "POST", input),
    onSettled: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}

export function useDuplicateTask(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiSend<TaskWithRelations>(`/api/tasks/${taskId}/duplicate`, "POST"),
    onSettled: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}

export function useBulk(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      ids: string[];
      patch?: { statusId?: string; priority?: string | null; assigneeIds?: string[] };
      delete?: boolean;
    }) => apiSend("/api/tasks/bulk", "POST", input),
    onSettled: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}

export function useSetFieldValue(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; fieldId: string; value: unknown }) =>
      apiSend(`/api/tasks/${v.taskId}/fields/${v.fieldId}`, "PUT", { value: v.value }),
    onSettled: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}

export function useDeleteTask(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiSend<{ ok: true }>(`/api/tasks/${taskId}`, "DELETE"),
    onMutate: async (taskId) => {
      if (!listId) return;
      await qc.cancelQueries({ queryKey: ["list", listId] });
      const prev = qc.getQueryData<ListData>(["list", listId]);
      if (prev) {
        qc.setQueryData<ListData>(["list", listId], {
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== taskId),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev && listId) qc.setQueryData(["list", listId], ctx.prev);
    },
    onSettled: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}

function applyOptimistic(task: TaskWithRelations, patch: TaskPatch): TaskWithRelations {
  return {
    ...task,
    name: patch.name ?? task.name,
    description: patch.description !== undefined ? patch.description : task.description,
    priority: patch.priority !== undefined ? (patch.priority as TaskWithRelations["priority"]) : task.priority,
    statusId: patch.statusId ?? task.statusId,
    position: patch.position ?? task.position,
    startDate: patch.startDate !== undefined ? (patch.startDate ? new Date(patch.startDate) : null) : task.startDate,
    dueDate: patch.dueDate !== undefined ? (patch.dueDate ? new Date(patch.dueDate) : null) : task.dueDate,
  };
}

// ----------------------------------------------------------------------------
// Docs & Doc Pages
// ----------------------------------------------------------------------------

export function useDocs(spaceId?: string) {
  return useQuery({
    queryKey: ["docs", { spaceId }],
    queryFn: () =>
      apiGet<DocItem[]>(spaceId ? `/api/docs?spaceId=${spaceId}` : "/api/docs"),
  });
}

export function useDoc(docId: string | null | undefined) {
  return useQuery({
    queryKey: ["doc", docId],
    queryFn: () => apiGet<DocDetail>(`/api/docs/${docId}`),
    enabled: !!docId,
  });
}

export function useDocPage(
  docId: string | null | undefined,
  pageId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["doc-page", docId, pageId],
    queryFn: () => apiGet<DocPageItem>(`/api/docs/${docId}/pages/${pageId}`),
    enabled: !!docId && !!pageId,
  });
}

export function useCreateDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDocPayload = {}) =>
      apiSend<DocDetail>("/api/docs", "POST", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
  });
}

export function useUpdateDoc(docId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      args: { docId: string; patch: UpdateDocPayload } | UpdateDocPayload,
    ) => {
      const targetDocId =
        "docId" in args && typeof args.docId === "string" ? args.docId : docId;
      if (!targetDocId) {
        throw new Error("docId is required to update doc");
      }
      const patch =
        "patch" in args && args.patch !== undefined
          ? args.patch
          : (args as UpdateDocPayload);
      return apiSend<DocItem>(`/api/docs/${targetDocId}`, "PATCH", patch);
    },
    onSuccess: (_data, variables) => {
      const targetDocId =
        typeof variables === "object" &&
        variables &&
        "docId" in variables &&
        typeof variables.docId === "string"
          ? variables.docId
          : docId;
      qc.invalidateQueries({ queryKey: ["docs"] });
      if (targetDocId) {
        qc.invalidateQueries({ queryKey: ["doc", targetDocId] });
      }
    },
  });
}

export function useDeleteDoc(docId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docIdArg?: string) => {
      const targetDocId = docIdArg || docId;
      if (!targetDocId) {
        throw new Error("docId is required to delete doc");
      }
      return apiSend<{ ok: boolean }>(`/api/docs/${targetDocId}`, "DELETE");
    },
    onSuccess: (_data, variables) => {
      const targetDocId = variables || docId;
      qc.invalidateQueries({ queryKey: ["docs"] });
      if (targetDocId) {
        qc.invalidateQueries({ queryKey: ["doc", targetDocId] });
      }
    },
  });
}

export function useCreateDocPage(docId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input:
        | { docId?: string; payload?: CreateDocPagePayload }
        | CreateDocPagePayload = {},
    ) => {
      const targetDocId =
        "docId" in input && typeof input.docId === "string"
          ? input.docId
          : docId;
      if (!targetDocId) {
        throw new Error("docId is required to create doc page");
      }
      const payload =
        "payload" in input && input.payload !== undefined
          ? input.payload
          : "docId" in input
            ? {}
            : (input as CreateDocPagePayload);
      return apiSend<DocPageItem>(
        `/api/docs/${targetDocId}/pages`,
        "POST",
        payload,
      );
    },
    onSuccess: (_data, variables) => {
      const targetDocId =
        typeof variables === "object" &&
        variables &&
        "docId" in variables &&
        typeof variables.docId === "string"
          ? variables.docId
          : docId;
      if (targetDocId) {
        qc.invalidateQueries({ queryKey: ["doc", targetDocId] });
      }
    },
  });
}

export function useUpdateDocPage(docId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pageId,
      patch,
      docId: inlineDocId,
    }: {
      pageId: string;
      patch: UpdateDocPagePayload;
      docId?: string;
    }) => {
      const targetDocId = inlineDocId || docId;
      if (!targetDocId) {
        throw new Error("docId is required to update doc page");
      }
      return apiSend<DocPageItem>(
        `/api/docs/${targetDocId}/pages/${pageId}`,
        "PATCH",
        patch,
      );
    },
    onSuccess: (_data, vars) => {
      const targetDocId = vars.docId || docId;
      if (targetDocId) {
        qc.invalidateQueries({ queryKey: ["doc", targetDocId] });
        qc.invalidateQueries({
          queryKey: ["doc-page", targetDocId, vars.pageId],
        });
      }
    },
  });
}

export function useDeleteDocPage(docId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: string | { docId?: string; pageId: string },
    ) => {
      const pageId = typeof input === "string" ? input : input.pageId;
      const targetDocId =
        typeof input === "object" && input.docId ? input.docId : docId;
      if (!targetDocId) {
        throw new Error("docId is required to delete doc page");
      }
      return apiSend<{ ok: boolean }>(
        `/api/docs/${targetDocId}/pages/${pageId}`,
        "DELETE",
      );
    },
    onSuccess: (_data, input) => {
      const targetDocId =
        typeof input === "object" && input.docId ? input.docId : docId;
      const pageId = typeof input === "string" ? input : input.pageId;
      if (targetDocId) {
        qc.invalidateQueries({ queryKey: ["doc", targetDocId] });
        qc.invalidateQueries({ queryKey: ["doc-page", targetDocId, pageId] });
      }
    },
  });
}

