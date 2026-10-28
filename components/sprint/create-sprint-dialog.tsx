"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useSprintMutations } from "@/lib/hooks";
import type { SprintFolderData } from "@/lib/queries";

export function CreateSprintDialog({ folder, onClose }: { folder: SprintFolderData; onClose: () => void }) {
  const mutations = useSprintMutations(folder.settings.folderId);
  const latestEnd = folder.sprints
    .filter((sprint) => sprint.status !== "CANCELLED")
    .map((sprint) => +new Date(sprint.endsAt))
    .sort((a, b) => b - a)[0];
  const defaultStart = latestEnd && latestEnd > Date.now() ? new Date(latestEnd) : new Date();
  const defaultEnd = new Date(defaultStart.getTime() + folder.settings.durationDays * 86_400_000);
  const [name, setName] = useState(`Sprint ${folder.sprints.length + 1}`);
  const [goal, setGoal] = useState("");
  const [startsAt, setStartsAt] = useState(toLocalInput(defaultStart));
  const [endsAt, setEndsAt] = useState(toLocalInput(defaultEnd));

  async function submit() {
    await mutations.createSprint.mutateAsync({
      name: name.trim(), goal: goal.trim() || null,
      startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(),
    });
    onClose();
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-0 z-50 m-auto h-fit w-[min(480px,94vw)] rounded-xl border border-cu-border bg-cu-panel p-5 shadow-2xl outline-none">
          <div className="flex items-center justify-between"><Dialog.Title className="text-lg font-semibold">Create Sprint</Dialog.Title><Dialog.Close className="rounded p-1 hover:bg-cu-hover"><X className="h-4 w-4" /></Dialog.Close></div>
          <Dialog.Description className="mt-1 text-sm text-cu-text-secondary">Plan a Sprint using this folder&apos;s default cadence.</Dialog.Description>
          <div className="mt-5 space-y-4">
            <label><span className="mb-1 block text-xs font-medium text-cu-text-secondary">Name</span><input className="cu-input" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label><span className="mb-1 block text-xs font-medium text-cu-text-secondary">Sprint goal</span><textarea className="cu-input min-h-20" value={goal} onChange={(event) => setGoal(event.target.value)} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="mb-1 block text-xs font-medium text-cu-text-secondary">Starts</span><input type="datetime-local" className="cu-input" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
              <label><span className="mb-1 block text-xs font-medium text-cu-text-secondary">Ends</span><input type="datetime-local" className="cu-input" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
            </div>
          </div>
          {mutations.createSprint.error && <p className="mt-3 text-sm text-cu-urgent">{mutations.createSprint.error.message}</p>}
          <div className="mt-5 flex justify-end gap-2"><button className="rounded-md border border-cu-border px-3 py-2 text-sm" onClick={onClose}>Cancel</button><button disabled={!name.trim() || mutations.createSprint.isPending} className="rounded-md bg-cu-purple px-3 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={() => void submit()}>{mutations.createSprint.isPending ? "Creating…" : "Create Sprint"}</button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function toLocalInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
