# 0008. Keep Sprint membership separate from a task's home List

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

A task must remain in its normal List while also participating in a Sprint. A
Sprint completion must preserve the committed forecast and final result even if
the task is later edited, deleted, or carried into another Sprint.

## Decision

`SprintTask` is an append-only membership ledger between a task and a Sprint;
adding a task never changes `Task.listId`. Only one open membership is allowed
per task and Sprint Folder, enforced by a partial unique index. Starting a
Sprint freezes forecast points/time. Completing it freezes the outcome, points,
task name, and home List snapshots.

Carry-over closes the source membership with `CARRIED_OVER` before creating a
new open membership linked by `carriedFromMembershipId`. Lifecycle and scope
changes are also written to `SprintEvent`, which powers stable history and
reports.

## Alternatives considered

- Moving tasks into a Sprint List: simpler hierarchy, but loses the task's real
  backlog/feature List and makes cross-List planning awkward.
- A single `Task.sprintId`: cannot represent history or carry-over without
  overwriting the previous Sprint.
- Calculating reports only from current task state: historical reports would
  change after a Sprint closes.

## Consequences

Lifecycle mutations require transactions and a strict close-before-carry order.
Queries are more involved, but task location, carry-over lineage, deleted-task
history, forecast accuracy, and historical reporting remain reliable.
