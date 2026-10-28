"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, X } from "lucide-react";
import { useSprintFolder, useSprintMutations } from "@/lib/hooks";
import type { SprintDetail } from "@/lib/queries";

export function CompleteSprintDialog({ detail, onClose }: { detail: SprintDetail; onClose: () => void }) {
  const { data: folder } = useSprintFolder(detail.sprint.sprintFolderId);
  const mutations = useSprintMutations(detail.sprint.sprintFolderId, detail.sprint.id);
  const unfinished = detail.tasks.filter((task) => task.status.type !== "DONE" && task.status.type !== "CLOSED");
  const planned = folder?.sprints.filter((sprint) => sprint.status === "PLANNED" && sprint.id !== detail.sprint.id) ?? [];
  const [action, setAction] = useState<"CARRY_OVER" | "NO_SPRINT">(planned.length ? "CARRY_OVER" : "NO_SPRINT");
  const [targetSprintId, setTargetSprintId] = useState(planned[0]?.id ?? "");
  const [withoutSprint, setWithoutSprint] = useState<Set<string>>(new Set());
  const points = useMemo(() => unfinished.reduce((sum, task) => sum + (task.sprintPoints ?? 0), 0), [unfinished]);

  async function complete() {
    await mutations.completeSprint.mutateAsync({
      defaultAction: action,
      targetSprintId: action === "CARRY_OVER" ? targetSprintId : undefined,
      overrides: [...withoutSprint].map((taskId) => ({ taskId, action: "NO_SPRINT" as const })),
    });
    onClose();
  }

  return <Dialog.Root open onOpenChange={(open) => !open && onClose()}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" /><Dialog.Content className="fixed inset-0 z-[60] m-auto h-fit max-h-[90vh] w-[min(620px,94vw)] overflow-y-auto rounded-xl border border-cu-border bg-cu-panel p-5 shadow-2xl outline-none">
    <div className="flex items-center justify-between"><Dialog.Title className="text-lg font-semibold">Complete {detail.sprint.name}</Dialog.Title><Dialog.Close className="rounded p-1 hover:bg-cu-hover"><X className="h-4 w-4" /></Dialog.Close></div>
    <Dialog.Description className="mt-1 text-sm text-cu-text-secondary">Completed work is frozen in this Sprint&apos;s history. Choose what happens to unfinished tasks.</Dialog.Description>
    <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-lg bg-cu-hover p-3"><div className="text-xl font-semibold text-cu-success">{detail.progress.completedTasks}</div><div className="text-xs text-cu-text-tertiary">Completed tasks</div></div><div className="rounded-lg bg-cu-hover p-3"><div className="text-xl font-semibold">{unfinished.length}</div><div className="text-xs text-cu-text-tertiary">Unfinished · {points} points</div></div></div>
    {unfinished.length > 0 && <><div className="mt-5 text-sm font-medium">Default action</div><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="flex cursor-pointer gap-2 rounded-lg border border-cu-border p-3"><input type="radio" checked={action === "CARRY_OVER"} disabled={!planned.length} onChange={() => setAction("CARRY_OVER")} /><span><span className="block text-sm font-medium">Carry over</span><span className="text-xs text-cu-text-tertiary">Add to the next planned Sprint.</span></span></label><label className="flex cursor-pointer gap-2 rounded-lg border border-cu-border p-3"><input type="radio" checked={action === "NO_SPRINT"} onChange={() => setAction("NO_SPRINT")} /><span><span className="block text-sm font-medium">No Sprint</span><span className="text-xs text-cu-text-tertiary">Keep only in the original List.</span></span></label></div>
    {action === "CARRY_OVER" && <label className="mt-3 block"><span className="mb-1 block text-xs font-medium text-cu-text-secondary">Target Sprint</span><select className="cu-input" value={targetSprintId} onChange={(event) => setTargetSprintId(event.target.value)}>{planned.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></label>}
    <div className="mt-4 overflow-hidden rounded-lg border border-cu-border">{unfinished.map((task) => <label key={task.taskId} className="flex items-center gap-3 border-b border-cu-border px-3 py-2 last:border-0"><input type="checkbox" checked={withoutSprint.has(task.taskId)} onChange={() => setWithoutSprint((current) => { const next = new Set(current); if (next.has(task.taskId)) next.delete(task.taskId); else next.add(task.taskId); return next; })} /><span className="min-w-0 flex-1 truncate text-sm">{task.name}</span><span className="text-xs text-cu-text-tertiary">{withoutSprint.has(task.taskId) ? "No Sprint" : action === "CARRY_OVER" ? "Carry over" : "No Sprint"}</span></label>)}</div></>}
    {mutations.completeSprint.error && <p className="mt-3 text-sm text-cu-urgent">{mutations.completeSprint.error.message}</p>}
    <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-md border border-cu-border px-3 py-2 text-sm">Cancel</button><button disabled={mutations.completeSprint.isPending || (action === "CARRY_OVER" && !targetSprintId)} onClick={() => void complete()} className="flex items-center gap-1.5 rounded-md bg-cu-purple px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{mutations.completeSprint.isPending ? "Completing…" : <>Complete Sprint <ArrowRight className="h-4 w-4" /></>}</button></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
