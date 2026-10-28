import { useParams } from "next/navigation";
import { SprintPage } from "@/components/sprint/sprint-page";

export function SprintRoute() {
  const { sprintId } = useParams<{ sprintId: string }>();
  return sprintId ? <SprintPage sprintId={sprintId} /> : null;
}
