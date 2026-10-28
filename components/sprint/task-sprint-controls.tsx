"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { apiSend } from "@/lib/api";
import type { TaskDetail } from "@/lib/queries";
import { useWorkspace } from "@/components/workspace-context";

export function TaskSprintControls({ task }: { task: TaskDetail }) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const folders = workspace.spaces.flatMap((space) => space.folders).filter((folder) => folder.kind === "SPRINT");
  const activeMemberships = (task.sprintHistory ?? []).filter((item) => item.outcome == null && item.removedAt == null);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    queryClient.invalidateQueries({ queryKey: ["sprint"] });
    queryClient.invalidateQueries({ queryKey: ["sprint-folder"] });
    queryClient.invalidateQueries({ queryKey: ["sprint-backlog"] });
    queryClient.invalidateQueries({ queryKey: ["list", task.listId] });
  };
  const membership = useMutation({
    mutationFn: async ({ currentSprintId, nextSprintId }: { currentSprintId?: string; nextSprintId?: string }) => {
      if (!nextSprintId && currentSprintId) return apiSend(`/api/sprints/${currentSprintId}/tasks/${task.id}`, "DELETE");
      if (nextSprintId) return apiSend(`/api/sprints/${nextSprintId}/tasks`, "POST", { taskIds: [task.id], replaceExisting: true });
    },
    onSuccess: refresh,
  });

  if (!folders.length) return null;
  return (
    <div className="mt-4 border-t border-cu-border pt-4">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cu-text-tertiary"><Target className="h-3.5 w-3.5" /> Sprints</div>
      <div className="space-y-2">
        {folders.map((folder) => {
          const current = activeMemberships.find((item) => item.sprintFolderId === folder.id);
          const choices = folder.sprints.filter((sprint) => sprint.status === "PLANNED" || sprint.status === "ACTIVE");
          return <label key={folder.id} className="block"><span className="mb-1 block truncate text-xs text-cu-text-secondary">{folder.name}</span><select value={current?.sprintId ?? ""} disabled={membership.isPending} onChange={(event) => membership.mutate({ currentSprintId: current?.sprintId, nextSprintId: event.target.value || undefined })} className="cu-input text-sm"><option value="">No Sprint</option>{choices.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name} ({sprint.status.toLowerCase()})</option>)}</select></label>;
        })}
      </div>
      {membership.error && <p className="mt-2 text-xs text-cu-urgent">{membership.error.message}</p>}
      {(task.sprintHistory ?? []).some((item) => item.outcome != null || item.removedAt != null) && <details className="mt-3 text-xs"><summary className="cursor-pointer text-cu-text-tertiary">Sprint history ({task.sprintHistory?.length})</summary><div className="mt-2 space-y-1">{task.sprintHistory?.map((item) => <div key={item.membershipId} className="flex items-center justify-between gap-2 rounded bg-cu-hover px-2 py-1.5"><span className="truncate">{item.sprintName}</span><span className="shrink-0 text-[10px] uppercase text-cu-text-tertiary">{item.outcome?.replaceAll("_", " ") ?? item.sprintStatus}</span></div>)}</div></details>}
    </div>
  );
}
