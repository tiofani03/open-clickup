import type { MemberRole, StatusType, Priority, CustomFieldType, ViewType } from "@/lib/enums";

// ----------------------------------------------------------------------------
// User & Status Shapes
// ----------------------------------------------------------------------------

export type UserLite = {
  id: string;
  name: string;
  email: string;
  color: string;
  avatarUrl: string | null;
};

export type StatusModel = {
  id: string;
  listId: string;
  name: string;
  color: string;
  type: StatusType;
  position: number;
  wipLimit?: number | null;
};

// ----------------------------------------------------------------------------
// Custom Field Shapes
// ----------------------------------------------------------------------------

export type CustomFieldOption = {
  id: string;
  fieldId: string;
  name: string;
  color: string;
  position: number;
};

export type CustomFieldWithOptions = {
  id: string;
  listId: string;
  name: string;
  type: CustomFieldType;
  position: number;
  config?: any;
  options: CustomFieldOption[];
};

// ----------------------------------------------------------------------------
// Task Shapes
// ----------------------------------------------------------------------------

export type SubtaskWithRelations = {
  id: string;
  name: string;
  statusId: string;
  position: number;
  status: StatusModel;
  assignees?: { user: UserLite; userId?: string }[];
};

export type TaskWithRelations = {
  id: string;
  listId: string;
  statusId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  priority: Priority | null;
  position: number;
  startDate: string | Date | null;
  dueDate: string | Date | null;
  timeEstimate: number | null;
  createdById: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  completedAt: string | Date | null;
  archived: boolean;
  recurrence: string | null;
  status: StatusModel;
  assignees: { user: UserLite; userId?: string }[];
  tags: { tag: { id: string; name: string; color: string }; tagId?: string }[];
  customFieldValues?: Array<{
    id: string;
    fieldId: string;
    value: string | number | boolean | null;
  }>;
  subtasks: SubtaskWithRelations[];
  _count: { comments: number; subtasks: number; checklists: number };
};

export type TaskPatch = {
  name?: string;
  description?: string | null;
  statusId?: string;
  priority?: Priority | null;
  position?: number;
  startDate?: string | null;
  dueDate?: string | null;
  timeEstimate?: number | null;
  recurrence?: string | null;
  archived?: boolean;
  assigneeIds?: string[];
  tagIds?: string[];
  watcherIds?: string[];
};

// ----------------------------------------------------------------------------
// Workspace Tree (for Sidebar)
// ----------------------------------------------------------------------------

export type ListNode = {
  id: string;
  spaceId: string;
  folderId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  _count?: { tasks: number };
};

export type FolderNode = {
  id: string;
  spaceId: string;
  name: string;
  color: string | null;
  position: number;
  lists: ListNode[];
};

export type SpaceNode = {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  icon: string | null;
  position: number;
  folders: FolderNode[];
  lists: ListNode[];
};

export type WorkspaceTree = {
  id: string;
  name: string;
  slug: string;
  members: { role: MemberRole; user: UserLite }[];
  spaces: SpaceNode[];
};

// ----------------------------------------------------------------------------
// List Detail
// ----------------------------------------------------------------------------

export type ListWithMeta = {
  id: string;
  spaceId: string;
  folderId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  createdAt: string;
  space: { id: string; name: string; color: string; icon: string | null };
  folder: { id: string; name: string } | null;
  statuses: StatusModel[];
  customFields: CustomFieldWithOptions[];
  views: Array<{
    id: string;
    listId: string;
    name: string;
    type: ViewType;
    position: number;
    config?: any;
  }>;
};

export type TaskDependencyItem = {
  id: string;
  blockerId: string;
  blockedId: string;
};

export type ListData = {
  list: ListWithMeta;
  tasks: TaskWithRelations[];
  dependencies: TaskDependencyItem[];
};

// ----------------------------------------------------------------------------
// Task Detail (for Task Modal)
// ----------------------------------------------------------------------------

export type TaskChecklistItem = {
  id: string;
  checklistId: string;
  name: string;
  resolved: boolean;
  position: number;
};

export type TaskChecklist = {
  id: string;
  name: string;
  position: number;
  items: TaskChecklistItem[];
};

export type CommentReaction = {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
  user: { name: string };
};

export type TaskComment = {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  parentId: string | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
  user: UserLite;
  reactions: CommentReaction[];
};

export type TaskActivity = {
  id: string;
  taskId: string;
  userId: string;
  type: string;
  data: any;
  createdAt: string;
  user: { name: string; color: string; avatarUrl: string | null };
};

export type TaskAttachment = {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  createdAt: string;
};

export type TaskTimeEntry = {
  id: string;
  taskId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  user: UserLite;
};

export type TaskDetail = TaskWithRelations & {
  createdBy: UserLite | null;
  watchers: { user: UserLite }[];
  attachments: TaskAttachment[];
  timeEntries: TaskTimeEntry[];
  blockedBy: Array<{
    blocker: { id: string; name: string; listId: string; status: { name: string; color: string; type: StatusType } };
  }>;
  blocking: Array<{
    blocked: { id: string; name: string; listId: string; status: { name: string; color: string; type: StatusType } };
  }>;
  checklists: TaskChecklist[];
  comments: TaskComment[];
  activities: TaskActivity[];
  list: {
    id: string;
    name: string;
    spaceId: string;
    statuses: StatusModel[];
    customFields: CustomFieldWithOptions[];
  };
};
