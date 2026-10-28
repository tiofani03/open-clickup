import { useParams } from "next/navigation";
import { SprintFolderPage } from "@/components/sprint/sprint-folder-page";

export function SprintFolderRoute() {
  const { sprintFolderId } = useParams<{ sprintFolderId: string }>();
  return sprintFolderId ? <SprintFolderPage folderId={sprintFolderId} /> : null;
}
