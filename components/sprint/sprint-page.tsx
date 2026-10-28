"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CircleDot,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/api";
import { useSprint, useSprintBacklog, useSprintMutations } from "@/lib/hooks";
import type { SprintBacklogTask, SprintDetail, SprintTask } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { TaskModal } from "@/components/task/task-modal";
import { Avatar } from "@/components/ui/avatar";
import { CompleteSprintDialog } from "@/components/sprint/complete-sprint-dialog";
import { SprintReportPanel } from "@/components/sprint/sprint-report";

export function SprintPage({ sprintId }: { sprintId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useSprint(sprintId);
  const folderId = data?.sprint.sprintFolderId;
  const { data: backlog } = useSprintBacklog(folderId);
  const mutations = useSprintMutations(folderId, sprintId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [openTask, setOpenTask] = useState<{ id: string; listId: string } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [editing, setEditing] = useState(false);

  const updatePoints = useMutation({
    mutationFn: ({ taskId, points }: { taskId: string; points: number | null }) =>
      apiSend(`/api/tasks/${taskId}`, "PATCH", { sprintPoints: points }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprint", sprintId] });
      queryClient.invalidateQueries({ queryKey: ["sprint-backlog", folderId] });
    },
  });

  const filteredBacklog = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (backlog?.tasks ?? []).filter((task) => !needle || task.name.toLowerCase().includes(needle) || task.listName.toLowerCase().includes(needle));
  }, [backlog?.tasks, search]);

  if (isLoading) return <div className="p-6 text-sm text-cu-text-secondary">Loading Sprint…</div>;
  if (error || !data) return <div className="p-6 text-sm text-cu-urgent">Couldn&apos;t load this Sprint.</div>;

  const sprint = data.sprint;
  const progress = data.progress.totalPoints > 0
    ? Math.round((data.progress.completedPoints / data.progress.totalPoints) * 100)
    : data.progress.totalTasks > 0
      ? Math.round((data.progress.completedTasks / data.progress.totalTasks) * 100)
      : 0;

  async function addSelected() {
    if (!selected.size) return;
    await mutations.addTasks.mutateAsync({ taskIds: [...selected] });
    setSelected(new Set());
  }

  async function startSprint() {
    if (data!.progress.totalTasks === 0 && !window.confirm("Start an empty Sprint?")) return;
    await mutations.startSprint.mutateAsync();
  }

  async function deleteSprint() {
    if (!window.confirm(`Delete ${sprint.name}? This cannot be undone.`)) return;
    await mutations.deleteSprint.mutateAsync();
    router.push(`/sf/${sprint.sprintFolderId}`);
  }

  async function cancelSprint() {
    if (!window.confirm(`Cancel ${sprint.name}? Its task membership will be kept in history.`)) return;
    await mutations.cancelSprint.mutateAsync();
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-cu-bg">
      <header className="border-b border-cu-border bg-cu-panel px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => router.push(`/sf/${sprint.sprintFolderId}`)} className="rounded p-1.5 text-cu-text-tertiary hover:bg-cu-hover" aria-label="Back to Sprint Folder"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cu-purple-light text-cu-purple"><Target className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold">{sprint.name}</h1><StatusBadge status={sprint.status} /></div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-cu-text-tertiary"><span>{formatRange(sprint.startsAt, sprint.endsAt)}</span>{sprint.goal && <span className="truncate">Goal: {sprint.goal}</span>}</div>
          </div>
          {sprint.status === "PLANNED" && <><button onClick={() => setEditing(true)} className="rounded-md border border-cu-border px-3 py-1.5 text-sm hover:bg-cu-hover">Edit</button><button onClick={() => void startSprint()} disabled={mutations.startSprint.isPending} className="flex items-center gap-1.5 rounded-md bg-cu-purple px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"><Play className="h-4 w-4" /> Start Sprint</button></>}
          {sprint.status === "ACTIVE" && <button onClick={() => setCompleting(true)} className="flex items-center gap-1.5 rounded-md bg-cu-purple px-3 py-1.5 text-sm font-medium text-white"><Check className="h-4 w-4" /> Complete Sprint</button>}
          {(sprint.status === "PLANNED" || sprint.status === "ACTIVE") && <SprintActions status={sprint.status} onDelete={() => void deleteSprint()} onCancel={() => void cancelSprint()} />}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px border-b border-cu-border bg-cu-border sm:grid-cols-4">
        <Metric label="Progress" value={`${progress}%`} icon={<CircleDot />} />
        <Metric label="Tasks" value={`${data.progress.completedTasks}/${data.progress.totalTasks}`} icon={<Check />} />
        <Metric label="Points" value={`${data.progress.completedPoints}/${data.progress.totalPoints}`} icon={<Target />} />
        <Metric label="Ends" value={new Date(sprint.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} icon={<CalendarDays />} />
      </div>
      <div className="h-1 bg-cu-hover"><div className="h-full bg-cu-purple transition-[width]" style={{ width: `${progress}%` }} /></div>

      <div className={cn("grid min-h-0 flex-1", sprint.status === "PLANNED" && "lg:grid-cols-[minmax(0,1fr)_360px]") }>
        <main className="min-h-0 overflow-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <div><h2 className="font-semibold">Sprint tasks</h2><p className="text-xs text-cu-text-tertiary">Tasks stay in their original Lists.</p></div>
            <span className="text-xs text-cu-text-tertiary">{data.tasks.length} tasks</span>
          </div>
          <SprintTaskTable
            detail={data}
            editable={sprint.status === "PLANNED" || sprint.status === "ACTIVE"}
            onOpen={(task) => setOpenTask({ id: task.taskId, listId: task.listId })}
            onRemove={(taskId) => mutations.removeTask.mutate(taskId)}
            onPoints={(taskId, points) => updatePoints.mutate({ taskId, points })}
          />
          {sprint.status !== "PLANNED" && <SprintReportPanel sprintId={sprint.id} />}
        </main>

        {sprint.status === "PLANNED" && (
          <aside className="min-h-0 overflow-auto border-t border-cu-border bg-cu-panel p-4 lg:border-l lg:border-t-0">
            <h2 className="font-semibold">Backlog</h2>
            <p className="mt-0.5 text-xs text-cu-text-tertiary">Available tasks from this Sprint Folder&apos;s source Lists.</p>
            <div className="relative mt-3"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cu-text-tertiary" /><input className="cu-input pl-8" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search backlog…" /></div>
            <div className="mt-3 overflow-hidden rounded-lg border border-cu-border">
              {filteredBacklog.length === 0 ? <div className="p-7 text-center text-sm text-cu-text-tertiary">No available backlog tasks.</div> : filteredBacklog.map((task) => (
                <BacklogRow key={task.taskId} task={task} selected={selected.has(task.taskId)} onToggle={() => setSelected((current) => toggleSet(current, task.taskId))} onOpen={() => setOpenTask({ id: task.taskId, listId: task.listId })} />
              ))}
            </div>
            <button onClick={() => void addSelected()} disabled={!selected.size || mutations.addTasks.isPending} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-cu-purple px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" /> {mutations.addTasks.isPending ? "Adding…" : `Add ${selected.size || "selected"} to Sprint`}</button>
            {mutations.addTasks.error && <p className="mt-2 text-sm text-cu-urgent">{mutations.addTasks.error.message}</p>}
          </aside>
        )}
      </div>

      {openTask && <TaskModal taskId={openTask.id} listId={openTask.listId} onClose={() => setOpenTask(null)} onOpenTask={(id) => setOpenTask((current) => current ? { ...current, id } : null)} />}
      {completing && <CompleteSprintDialog detail={data} onClose={() => setCompleting(false)} />}
      {editing && <EditSprintDialog detail={data} onClose={() => setEditing(false)} />}
    </div>
  );
}

function SprintTaskTable({ detail, editable, onOpen, onRemove, onPoints }: { detail: SprintDetail; editable: boolean; onOpen: (task: SprintTask) => void; onRemove: (taskId: string) => void; onPoints: (taskId: string, points: number | null) => void }) {
  if (!detail.tasks.length) return <div className="rounded-xl border border-dashed border-cu-border p-10 text-center"><Target className="mx-auto h-7 w-7 text-cu-text-tertiary" /><p className="mt-2 text-sm font-medium">No tasks in this Sprint</p><p className="text-sm text-cu-text-tertiary">Select tasks from the backlog to begin planning.</p></div>;
  return <div className="overflow-hidden rounded-xl border border-cu-border bg-cu-panel"><div className="grid grid-cols-[minmax(220px,1fr)_120px_90px_90px_40px] items-center border-b border-cu-border bg-cu-sidebar/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-cu-text-tertiary"><span>Task</span><span>Status</span><span>Assignee</span><span>Points</span><span /></div>{detail.tasks.map((task) => <div key={task.membershipId} onClick={() => task.taskId && onOpen(task)} className={cn("grid grid-cols-[minmax(220px,1fr)_120px_90px_90px_40px] items-center border-b border-cu-border px-3 py-2 last:border-0", task.taskId && "cursor-pointer hover:bg-cu-hover/50")}><div className="min-w-0"><div className="truncate text-sm">{task.name}</div><div className="truncate text-xs text-cu-text-tertiary">{task.listName}{task.outcome ? ` · ${task.outcome.replaceAll("_", " ").toLowerCase()}` : ""}</div></div><span className="w-fit rounded px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ color: task.status.color, backgroundColor: `${task.status.color}1f` }}>{task.status.name}</span><div className="flex -space-x-1">{task.assignees.slice(0, 3).map((user) => <Avatar key={user.id} user={user} size="sm" ring />)}{!task.assignees.length && <span className="text-xs text-cu-text-tertiary">—</span>}</div><input type="number" min={0} value={task.sprintPoints ?? ""} disabled={!editable || !task.taskId} onClick={(event) => event.stopPropagation()} onChange={(event) => onPoints(task.taskId, event.target.value === "" ? null : Number(event.target.value))} className="w-16 rounded border border-transparent bg-transparent px-2 py-1 text-sm outline-none hover:border-cu-border focus:border-cu-purple disabled:opacity-60" placeholder="—" />{editable && task.taskId ? <button onClick={(event) => { event.stopPropagation(); onRemove(task.taskId); }} className="rounded p-1 text-cu-text-tertiary hover:bg-cu-hover hover:text-cu-urgent" aria-label={`Remove ${task.name} from Sprint`}><X className="h-4 w-4" /></button> : <span />}</div>)}</div>;
}

function BacklogRow({ task, selected, onToggle, onOpen }: { task: SprintBacklogTask; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  return <div className={cn("flex items-center gap-2 border-b border-cu-border px-3 py-2 last:border-0", selected && "bg-cu-purple-light/40")}><input type="checkbox" checked={selected} onChange={onToggle} className="accent-cu-purple" /><button onClick={onOpen} className="min-w-0 flex-1 text-left"><div className="truncate text-sm">{task.name}</div><div className="truncate text-xs text-cu-text-tertiary">{task.listName} · {task.status.name}</div></button><span className="text-xs text-cu-text-tertiary">{task.sprintPoints ?? "—"}</span></div>;
}

function EditSprintDialog({ detail, onClose }: { detail: SprintDetail; onClose: () => void }) {
  const sprint = detail.sprint;
  const mutations = useSprintMutations(sprint.sprintFolderId, sprint.id);
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(new Date(sprint.startsAt)));
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(sprint.endsAt)));
  async function save() { await mutations.updateSprint.mutateAsync({ name: name.trim(), goal: goal.trim() || null, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }); onClose(); }
  return <Dialog.Root open onOpenChange={(open) => !open && onClose()}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" /><Dialog.Content className="fixed inset-0 z-[60] m-auto h-fit w-[min(480px,94vw)] rounded-xl border border-cu-border bg-cu-panel p-5 shadow-2xl outline-none"><div className="flex items-center justify-between"><Dialog.Title className="text-lg font-semibold">Edit Sprint</Dialog.Title><Dialog.Close className="rounded p-1 hover:bg-cu-hover"><X className="h-4 w-4" /></Dialog.Close></div><Dialog.Description className="mt-1 text-sm text-cu-text-secondary">Dates and goal can be edited until the Sprint starts.</Dialog.Description><div className="mt-5 space-y-4"><label className="block"><span className="mb-1 block text-xs font-medium">Name</span><input className="cu-input" value={name} onChange={(e) => setName(e.target.value)} /></label><label className="block"><span className="mb-1 block text-xs font-medium">Goal</span><textarea className="cu-input min-h-20" value={goal} onChange={(e) => setGoal(e.target.value)} /></label><div className="grid grid-cols-2 gap-3"><label><span className="mb-1 block text-xs font-medium">Starts</span><input type="datetime-local" className="cu-input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label><label><span className="mb-1 block text-xs font-medium">Ends</span><input type="datetime-local" className="cu-input" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label></div></div>{mutations.updateSprint.error && <p className="mt-3 text-sm text-cu-urgent">{mutations.updateSprint.error.message}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-md border border-cu-border px-3 py-2 text-sm">Cancel</button><button disabled={!name.trim() || mutations.updateSprint.isPending} onClick={() => void save()} className="rounded-md bg-cu-purple px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{mutations.updateSprint.isPending ? "Saving…" : "Save"}</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function SprintActions({ status, onDelete, onCancel }: { status: string; onDelete: () => void; onCancel: () => void }) {
  return <Dialog.Root><Dialog.Trigger asChild><button className="rounded p-1.5 text-cu-text-tertiary hover:bg-cu-hover" aria-label="Sprint actions"><MoreHorizontal className="h-4 w-4" /></button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" /><Dialog.Content className="fixed inset-0 z-[60] m-auto h-fit w-[min(400px,92vw)] rounded-xl border border-cu-border bg-cu-panel p-5 shadow-2xl outline-none"><Dialog.Title className="font-semibold">Sprint actions</Dialog.Title><Dialog.Description className="mt-1 text-sm text-cu-text-secondary">Choose a destructive action carefully.</Dialog.Description><div className="mt-4 space-y-2">{status === "PLANNED" && <button onClick={onDelete} className="flex w-full items-center gap-2 rounded-md border border-cu-border px-3 py-2 text-sm text-cu-urgent hover:bg-cu-hover"><Trash2 className="h-4 w-4" /> Delete planned Sprint</button>}<button onClick={onCancel} className="flex w-full items-center gap-2 rounded-md border border-cu-border px-3 py-2 text-sm text-cu-urgent hover:bg-cu-hover"><X className="h-4 w-4" /> Cancel Sprint</button></div><Dialog.Close className="mt-4 w-full rounded-md border border-cu-border px-3 py-2 text-sm">Close</Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="flex items-center gap-3 bg-cu-panel px-4 py-3"><span className="text-cu-purple [&>svg]:h-4 [&>svg]:w-4">{icon}</span><div><div className="font-semibold">{value}</div><div className="text-[11px] text-cu-text-tertiary">{label}</div></div></div>; }
function StatusBadge({ status }: { status: string }) { const styles = status === "ACTIVE" ? "bg-cu-purple-light text-cu-purple" : status === "COMPLETED" ? "bg-green-500/15 text-cu-success" : status === "CANCELLED" ? "bg-cu-hover text-cu-text-tertiary" : "bg-amber-500/15 text-amber-600"; return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", styles)}>{status}</span>; }
function toggleSet(current: Set<string>, id: string) { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }
function formatRange(start: string, end: string) { const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }; return `${new Date(start).toLocaleDateString(undefined, options)} – ${new Date(end).toLocaleDateString(undefined, options)}`; }
function toLocalInput(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }
