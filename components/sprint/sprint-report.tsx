"use client";

import { ArrowDown, ArrowUp, BarChart3, TrendingUp } from "lucide-react";
import { useSprintFolderReport, useSprintReport } from "@/lib/hooks";
import type { SprintReportPoint } from "@/lib/queries";

export function SprintReportPanel({ sprintId }: { sprintId: string }) {
  const { data, isLoading } = useSprintReport(sprintId);
  if (isLoading) return <div className="mt-6 h-52 animate-pulse rounded-xl bg-cu-hover" />;
  if (!data) return null;
  return <section className="mt-7 border-t border-cu-border pt-6">
    <div className="mb-3"><h2 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-cu-purple" /> Sprint report</h2><p className="text-xs text-cu-text-tertiary">Forecast snapshots, delivery, and scope movement across the Sprint.</p></div>
    <div className="grid gap-3 sm:grid-cols-4">
      <ReportMetric label="Forecast" value={`${data.forecast.points} pts`} detail={`${data.forecast.tasks} tasks`} />
      <ReportMetric label="Scope added" value={`+${data.scopeChange.addedPoints} pts`} detail={`${data.scopeChange.addedTasks} tasks`} tone="warning" />
      <ReportMetric label="Scope removed" value={`−${data.scopeChange.removedPoints} pts`} detail={`${data.scopeChange.removedTasks} tasks`} />
      <ReportMetric label="Net scope" value={`${signed(data.scopeChange.addedPoints - data.scopeChange.removedPoints)} pts`} detail="after Sprint start" />
    </div>
    <div className="mt-3 grid gap-3 xl:grid-cols-2">
      <ChartCard title="Burndown" subtitle="Remaining points against the ideal line"><SprintChart points={data.series} lines={[{ key: "idealRemaining", color: "#aab0bb", dashed: true, label: "Ideal" }, { key: "remainingPoints", color: "#7b68ee", label: "Remaining" }]} /></ChartCard>
      <ChartCard title="Burnup" subtitle="Completed work and total scope"><SprintChart points={data.series} lines={[{ key: "scopePoints", color: "#aab0bb", label: "Scope" }, { key: "completedPoints", color: "#22a06b", label: "Completed" }]} /></ChartCard>
    </div>
    {data.changes.length > 0 && <div className="mt-3 overflow-hidden rounded-xl border border-cu-border bg-cu-panel"><div className="border-b border-cu-border px-4 py-3 text-sm font-semibold">Scope changes</div>{data.changes.map((change, index) => <div key={`${change.type}-${change.at}-${index}`} className="flex items-center gap-3 border-b border-cu-border px-4 py-2.5 last:border-0">{change.type === "ADDED" ? <ArrowUp className="h-4 w-4 text-amber-500" /> : <ArrowDown className="h-4 w-4 text-cu-text-tertiary" />}<div className="min-w-0 flex-1"><div className="truncate text-sm">{change.taskName}</div><div className="text-xs text-cu-text-tertiary">{change.listName} · {new Date(change.at).toLocaleString()}</div></div><span className="text-xs font-medium">{change.type === "ADDED" ? "+" : "−"}{change.points} pts</span></div>)}</div>}
  </section>;
}

export function VelocityPanel({ folderId }: { folderId: string }) {
  const { data } = useSprintFolderReport(folderId);
  if (!data || !data.sprints.length) return null;
  const max = Math.max(1, ...data.sprints.flatMap((sprint) => [sprint.forecastPoints, sprint.completedPoints]));
  return <section className="mt-7"><div className="mb-3 flex items-end justify-between"><div><h2 className="flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-cu-purple" /> Velocity</h2><p className="text-xs text-cu-text-tertiary">Completed points across finished Sprints.</p></div><div className="text-right"><div className="text-xl font-semibold">{data.averageVelocity}</div><div className="text-[11px] text-cu-text-tertiary">average points</div></div></div><div className="overflow-x-auto rounded-xl border border-cu-border bg-cu-panel p-4"><div className="flex min-w-[420px] items-end gap-4" style={{ height: 180 }}>{data.sprints.map((sprint) => <div key={sprint.id} className="flex h-full min-w-20 flex-1 flex-col justify-end"><div className="flex flex-1 items-end justify-center gap-1"><div title={`${sprint.forecastPoints} forecast points`} className="w-5 rounded-t bg-cu-text-tertiary/30" style={{ height: `${Math.max(3, sprint.forecastPoints / max * 100)}%` }} /><div title={`${sprint.completedPoints} completed points`} className="w-5 rounded-t bg-cu-purple" style={{ height: `${Math.max(3, sprint.completedPoints / max * 100)}%` }} /></div><div className="mt-2 truncate text-center text-[11px] text-cu-text-secondary">{sprint.name}</div><div className="text-center text-[10px] text-cu-text-tertiary">{sprint.completedPoints} pts</div></div>)}</div><div className="mt-3 flex justify-end gap-4 text-[11px] text-cu-text-tertiary"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-cu-text-tertiary/30" /> Forecast</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-cu-purple" /> Completed</span></div></div></section>;
}

type ChartKey = "idealRemaining" | "remainingPoints" | "scopePoints" | "completedPoints";
function SprintChart({ points, lines }: { points: SprintReportPoint[]; lines: Array<{ key: ChartKey; color: string; label: string; dashed?: boolean }> }) {
  const values = points.flatMap((point) => lines.map((line) => point[line.key]).filter((value): value is number => typeof value === "number"));
  const max = Math.max(1, ...values);
  const width = 600, height = 180, padX = 28, padY = 16;
  const x = (index: number) => padX + (points.length <= 1 ? 0 : index / (points.length - 1) * (width - padX * 2));
  const y = (value: number) => height - padY - value / max * (height - padY * 2);
  return <div><svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="Sprint progress chart"><line x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} stroke="currentColor" className="text-cu-border" /><line x1={padX} x2={padX} y1={padY} y2={height - padY} stroke="currentColor" className="text-cu-border" />{lines.map((line) => { const usable = points.map((point, index) => ({ value: point[line.key], index })).filter((item): item is { value: number; index: number } => typeof item.value === "number"); const d = usable.map((item, index) => `${index ? "L" : "M"}${x(item.index)},${y(item.value)}`).join(" "); return <path key={line.key} d={d} fill="none" stroke={line.color} strokeWidth="3" strokeDasharray={line.dashed ? "7 6" : undefined} strokeLinecap="round" strokeLinejoin="round" />; })}<text x="2" y={padY + 4} className="fill-cu-text-tertiary text-[10px]">{max}</text><text x="8" y={height - padY + 3} className="fill-cu-text-tertiary text-[10px]">0</text></svg><div className="flex flex-wrap justify-center gap-4 text-[11px] text-cu-text-tertiary">{lines.map((line) => <span key={line.key} className="flex items-center gap-1.5"><span className="h-0.5 w-5" style={{ backgroundColor: line.color }} />{line.label}</span>)}</div>{points.length > 1 && <div className="mt-2 flex justify-between text-[10px] text-cu-text-tertiary"><span>{formatDay(points[0].date)}</span><span>{formatDay(points[points.length - 1].date)}</span></div>}</div>;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <div className="rounded-xl border border-cu-border bg-cu-panel p-4"><div className="text-sm font-semibold">{title}</div><div className="mb-2 text-xs text-cu-text-tertiary">{subtitle}</div>{children}</div>; }
function ReportMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "warning" }) { return <div className="rounded-xl border border-cu-border bg-cu-panel p-3"><div className="text-[11px] text-cu-text-tertiary">{label}</div><div className={tone === "warning" ? "font-semibold text-amber-600" : "font-semibold"}>{value}</div><div className="text-[11px] text-cu-text-tertiary">{detail}</div></div>; }
function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
function formatDay(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
