"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CircleDot, Clock3, Plus, Settings2, Target } from "lucide-react";
import { useSprintFolder } from "@/lib/hooks";
import { CreateSprintDialog } from "@/components/sprint/create-sprint-dialog";
import { SprintFolderDialog } from "@/components/sprint/sprint-folder-dialog";
import { cn } from "@/lib/utils";
import { VelocityPanel } from "@/components/sprint/sprint-report";

export function SprintFolderPage({ folderId }: { folderId: string }) {
  const { data, isLoading, error } = useSprintFolder(folderId);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  if (isLoading) return <div className="p-6 text-sm text-cu-text-secondary">Loading Sprint Folder…</div>;
  if (error || !data) return <div className="p-6 text-sm text-cu-urgent">Couldn&apos;t load this Sprint Folder.</div>;

  const ordered = [...data.sprints].sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  return (
    <div className="h-full overflow-y-auto bg-cu-bg p-4 md:p-7">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cu-purple-light text-cu-purple"><Target className="h-5 w-5" /></div>
          <div><p className="text-xs text-cu-text-tertiary">Sprint Folder</p><h1 className="text-2xl font-semibold">{data.settings.name}</h1><p className="mt-1 text-sm text-cu-text-secondary">{data.settings.durationDays}-day cadence · {data.settings.timezone} · {data.settings.estimationMetric === "POINTS" ? "Sprint Points" : "Time Estimate"}</p></div>
          <div className="ml-auto flex gap-2"><button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-md border border-cu-border px-3 py-2 text-sm hover:bg-cu-hover"><Settings2 className="h-4 w-4" /> Settings</button><button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-md bg-cu-purple px-3 py-2 text-sm font-medium text-white hover:bg-cu-purple-dark"><Plus className="h-4 w-4" /> Create Sprint</button></div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Summary icon={<CircleDot />} label="Active" value={data.sprints.filter((s) => s.status === "ACTIVE").length} />
          <Summary icon={<Clock3 />} label="Planned" value={data.sprints.filter((s) => s.status === "PLANNED").length} />
          <Summary icon={<CalendarDays />} label="Completed" value={data.sprints.filter((s) => s.status === "COMPLETED").length} />
        </div>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Sprints</h2><span className="text-xs text-cu-text-tertiary">{data.sourceLists.length} source Lists</span></div>
          <div className="overflow-hidden rounded-xl border border-cu-border bg-cu-panel">
            {ordered.length === 0 ? <div className="p-10 text-center"><Target className="mx-auto h-7 w-7 text-cu-text-tertiary" /><p className="mt-2 text-sm font-medium">No Sprints yet</p><p className="text-sm text-cu-text-tertiary">Create the first Sprint for this team.</p></div> : ordered.map((sprint) => (
              <button key={sprint.id} onClick={() => router.push(`/s/${sprint.id}`)} className="flex w-full items-center gap-3 border-b border-cu-border px-4 py-3 text-left last:border-0 hover:bg-cu-hover">
                <span className={cn("h-2.5 w-2.5 rounded-full", sprint.status === "ACTIVE" ? "bg-cu-purple" : sprint.status === "COMPLETED" ? "bg-cu-success" : sprint.status === "CANCELLED" ? "bg-cu-text-tertiary" : "bg-[#ffb020]")} />
                <div className="min-w-0 flex-1"><div className="font-medium">{sprint.name}</div><div className="truncate text-xs text-cu-text-tertiary">{sprint.goal || "No Sprint goal"}</div></div>
                <div className="hidden text-right text-xs text-cu-text-secondary sm:block"><div>{formatRange(sprint.startsAt, sprint.endsAt)}</div><div>{sprint.taskCount} tasks · {sprint.totalPoints} pts</div></div>
                <span className="rounded-full bg-cu-hover px-2 py-1 text-[10px] font-semibold">{sprint.status}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7"><h2 className="mb-3 font-semibold">Source Lists</h2><div className="flex flex-wrap gap-2">{data.sourceLists.length ? data.sourceLists.map((list) => <span key={list.id} className="flex items-center gap-2 rounded-lg border border-cu-border bg-cu-panel px-3 py-2 text-sm"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: list.color ?? "#87909e" }} />{list.name}</span>) : <span className="text-sm text-cu-text-tertiary">No source Lists configured.</span>}</div></section>
        <VelocityPanel folderId={folderId} />
      </div>
      {creating && <CreateSprintDialog folder={data} onClose={() => setCreating(false)} />}
      {editing && <SprintFolderDialog spaceId={data.settings.spaceId} existing={data} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="flex items-center gap-3 rounded-xl border border-cu-border bg-cu-panel p-4"><span className="text-cu-purple [&>svg]:h-5 [&>svg]:w-5">{icon}</span><div><div className="text-xl font-semibold">{value}</div><div className="text-xs text-cu-text-tertiary">{label}</div></div></div>; }
function formatRange(start: string, end: string) { return `${new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(end).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`; }
