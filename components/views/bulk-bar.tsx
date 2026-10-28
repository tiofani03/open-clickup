"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { X, Trash2, Flag, Target, Hash } from "lucide-react";
import type { StatusModel } from "@/lib/queries";
import { Priority } from "@/lib/enums";
import { PRIORITY_ORDER, PRIORITY_CONFIG } from "@/lib/constants";
import { PriorityFlag } from "@/components/ui/primitives";
import { StatusCircle } from "@/components/menus/status-control";
import { Avatar } from "@/components/ui/avatar";
import { useWorkspace } from "@/components/workspace-context";
import { cn } from "@/lib/utils";

export function BulkBar({
  count,
  statuses,
  onSetStatus,
  onSetPriority,
  onSetAssignees,
  onSetPoints,
  onAddSprint,
  onDelete,
  onClear,
}: {
  count: number;
  statuses: StatusModel[];
  onSetStatus: (statusId: string) => void;
  onSetPriority: (p: Priority | null) => void;
  onSetAssignees: (ids: string[]) => void;
  onSetPoints: (points: number | null) => void;
  onAddSprint: (sprintId: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const { workspace } = useWorkspace();
  const members = workspace.members.map((m) => m.user);
  const sprintFolders = workspace.spaces.flatMap((space) => space.folders).filter((folder) => folder.kind === "SPRINT");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-black/20 bg-[#23262f] px-2 py-1.5 text-white shadow-2xl">
        <span className="flex items-center gap-1.5 px-2 text-[13px] font-medium">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cu-purple px-1.5 text-[11px] font-bold">
            {count}
          </span>
          selected
        </span>
        <span className="mx-1 h-5 w-px bg-white/20" />

        <BarMenu label="Status">
          {statuses.map((s) => (
            <Item key={s.id} onSelect={() => onSetStatus(s.id)}>
              <StatusCircle status={s} size={14} />
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: s.color }}>{s.name}</span>
            </Item>
          ))}
        </BarMenu>

        <BarMenu label="Priority">
          {PRIORITY_ORDER.map((p) => (
            <Item key={p} onSelect={() => onSetPriority(p)}>
              <PriorityFlag priority={p} /> {PRIORITY_CONFIG[p].label}
            </Item>
          ))}
          <div className="my-1 h-px bg-cu-border" />
          <Item onSelect={() => onSetPriority(null)}>
            <X className="h-3.5 w-3.5" /> Clear
          </Item>
        </BarMenu>

        <BarMenu label="Assign">
          <AssignPicker members={members} onApply={onSetAssignees} />
        </BarMenu>

        <BarMenu label="Points" icon={<Hash className="h-4 w-4" />}>
          {[0, 1, 2, 3, 5, 8, 13, 21].map((points) => <Item key={points} onSelect={() => onSetPoints(points)}>{points} points</Item>)}
          <div className="my-1 h-px bg-cu-border" />
          <Item onSelect={() => onSetPoints(null)}><X className="h-3.5 w-3.5" /> Clear</Item>
        </BarMenu>

        {sprintFolders.length > 0 && <BarMenu label="Sprint" icon={<Target className="h-4 w-4" />}>
          {sprintFolders.map((folder) => <div key={folder.id}><div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cu-text-tertiary">{folder.name}</div>{folder.sprints.filter((sprint) => sprint.status === "PLANNED" || sprint.status === "ACTIVE").map((sprint) => <Item key={sprint.id} onSelect={() => onAddSprint(sprint.id)}><span className={cn("h-2 w-2 rounded-full", sprint.status === "ACTIVE" ? "bg-cu-purple" : "bg-amber-500")} />{sprint.name}</Item>)}</div>)}
        </BarMenu>}

        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-white/10"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>

        <span className="mx-1 h-5 w-px bg-white/20" />
        <button onClick={onClear} className="rounded-lg p-1.5 hover:bg-white/10" title="Clear selection">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BarMenu({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-white/10">
          {label === "Priority" ? <Flag className="h-4 w-4" /> : icon}
          {label}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          sideOffset={8}
          className="z-50 max-h-[300px] min-w-[200px] overflow-y-auto rounded-lg border border-cu-border bg-cu-panel p-1 text-cu-text shadow-lg"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Item({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] outline-none hover:bg-cu-hover focus:bg-cu-hover"
    >
      {children}
    </DropdownMenu.Item>
  );
}

function AssignPicker({
  members,
  onApply,
}: {
  members: { id: string; name: string; color: string; avatarUrl: string | null }[];
  onApply: (ids: string[]) => void;
}) {
  return (
    <>
      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-cu-text-tertiary">
        Set assignee
      </div>
      {members.map((u) => (
        <DropdownMenu.Item
          key={u.id}
          onSelect={() => onApply([u.id])}
          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] outline-none hover:bg-cu-hover focus:bg-cu-hover"
        >
          <Avatar user={u} size="sm" /> {u.name}
        </DropdownMenu.Item>
      ))}
      <div className="my-1 h-px bg-cu-border" />
      <DropdownMenu.Item
        onSelect={() => onApply([])}
        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-cu-text-secondary outline-none hover:bg-cu-hover"
      >
        <X className="h-3.5 w-3.5" /> Unassign all
      </DropdownMenu.Item>
    </>
  );
}
