import { useParams } from "react-router";
import { ListPage } from "@/components/views/list-page";

export function ListRoute() {
  const { listId } = useParams<{ listId: string }>();
  if (!listId) return null;
  return <ListPage listId={listId} />;
}
