"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { useSprintMutations, type SprintFolderPayload } from "@/lib/hooks";
import type { SprintFolderData } from "@/lib/queries";

export function SprintFolderDialog({
  spaceId,
  existing,
  onClose,
}: {
  spaceId: string;
  existing?: SprintFolderData;
  onClose: () => void;
}) {
  const { workspace } = useWorkspace();
  const folderId = existing?.settings.folderId;
  const mutations = useSprintMutations(folderId);
  const sourceLists = useMemo(() => {
    const space = workspace.spaces.find((item) => item.id === spaceId);
    if (!space) return [];
    return [...space.lists, ...space.folders.flatMap((folder) => folder.lists)];
  }, [spaceId, workspace.spaces]);
  const [name, setName] = useState(existing?.settings.name ?? "Engineering Sprints");
  const [durationDays, setDurationDays] = useState(existing?.settings.durationDays ?? 14);
  const [startDayOfWeek, setStartDayOfWeek] = useState(existing?.settings.startDayOfWeek ?? 1);
  const [startTime, setStartTime] = useState(existing?.settings.startTime ?? "09:00");
  const [timezone, setTimezone] = useState(existing?.settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
  const [estimationMetric, setEstimationMetric] = useState<"POINTS" | "TIME">(existing?.settings.estimationMetric ?? "POINTS");
  const [pointScale, setPointScale] = useState((existing?.settings.pointScale ?? [1, 2, 3, 5, 8, 13]).join(", "));
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set(existing?.sourceLists.map((list) => list.id) ?? []));
  const mutation = existing ? mutations.updateFolder : mutations.createFolder;

  async function submit() {
    const points = pointScale
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0);
    const payload: SprintFolderPayload = {
      spaceId,
      name: name.trim(),
      durationDays,
      startDayOfWeek,
      startTime,
      timezone,
      estimationMetric,
      pointScale: points,
      sourceListIds: [...selectedLists],
    };
    await mutation.mutateAsync(payload);
    onClose();
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-0 z-50 m-auto h-fit max-h-[90vh] w-[min(560px,94vw)] overflow-y-auto rounded-xl border border-cu-border bg-cu-panel p-5 shadow-2xl outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">{existing ? "Sprint Folder settings" : "Create Sprint Folder"}</Dialog.Title>
            <Dialog.Close className="rounded p-1 text-cu-text-tertiary hover:bg-cu-hover"><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-sm text-cu-text-secondary">
            Configure the cadence and Lists your team will plan work from.
          </Dialog.Description>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Name" wide><input value={name} onChange={(event) => setName(event.target.value)} className="cu-input" /></Field>
            <Field label="Duration (days)"><input type="number" min={1} max={90} value={durationDays} onChange={(event) => setDurationDays(Number(event.target.value))} className="cu-input" /></Field>
            <Field label="Start day">
              <select value={startDayOfWeek} onChange={(event) => setStartDayOfWeek(Number(event.target.value))} className="cu-input">
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </Field>
            <Field label="Start time"><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="cu-input" /></Field>
            <Field label="Timezone"><input value={timezone} onChange={(event) => setTimezone(event.target.value)} className="cu-input" /></Field>
            <Field label="Estimation">
              <select value={estimationMetric} onChange={(event) => setEstimationMetric(event.target.value as "POINTS" | "TIME")} className="cu-input">
                <option value="POINTS">Sprint Points</option><option value="TIME">Time Estimate</option>
              </select>
            </Field>
            <Field label="Point scale"><input value={pointScale} onChange={(event) => setPointScale(event.target.value)} className="cu-input" /></Field>
          </div>

          <div className="mt-5">
            <div className="text-sm font-medium">Source Lists</div>
            <p className="mb-2 text-xs text-cu-text-tertiary">Tasks remain in these Lists when added to a Sprint.</p>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-cu-border p-2">
              {sourceLists.length === 0 ? <p className="p-2 text-sm text-cu-text-tertiary">Create a regular List first.</p> : sourceLists.map((list) => (
                <label key={list.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-cu-hover">
                  <input
                    type="checkbox"
                    checked={selectedLists.has(list.id)}
                    onChange={() => setSelectedLists((current) => {
                      const next = new Set(current);
                      if (next.has(list.id)) next.delete(list.id); else next.add(list.id);
                      return next;
                    })}
                  />
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: list.color ?? "#87909e" }} />
                  {list.name}
                </label>
              ))}
            </div>
          </div>

          {mutation.error && <p className="mt-3 text-sm text-cu-urgent">{mutation.error.message}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-cu-border px-3 py-2 text-sm hover:bg-cu-hover">Cancel</button>
            <button disabled={!name.trim() || mutation.isPending} onClick={() => void submit()} className="rounded-md bg-cu-purple px-3 py-2 text-sm font-medium text-white hover:bg-cu-purple-dark disabled:opacity-50">
              {mutation.isPending ? "Saving…" : existing ? "Save settings" : "Create Sprint Folder"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1 block text-xs font-medium text-cu-text-secondary">{label}</span>{children}</label>;
}
