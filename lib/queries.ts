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
  label: string;
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
  assignees: { user: UserLite; userId: string }[];
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
  sprintPoints: number | null;
  createdById: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  completedAt: string | Date | null;
  archived: boolean;
  recurrence: string | null;
  status: StatusModel;
  assignees: { user: UserLite; userId: string }[];
  tags: { tag: { id: string; name: string; color: string }; tagId: string }[];
  customFieldValues: Array<{
    id: string;
    customFieldId: string;
    value: string | number | boolean | null;
  }>;
  subtasks: SubtaskWithRelations[];
  _count: { comments: number; subtasks: number; checklists: number };
  sprintHistory?: TaskSprintHistory[];
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
  sprintPoints?: number | null;
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
  kind: "STANDARD" | "SPRINT";
  color: string | null;
  position: number;
  lists: ListNode[];
  sprints: SprintNode[];
};

export type SprintNode = {
  id: string;
  name: string;
  status: SprintStatus;
  startsAt: string;
  endsAt: string;
  taskCount: number;
};

export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type SprintSummary = {
  id: string;
  sprintFolderId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  forecastLockedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  taskCount: number;
  completedCount: number;
  totalPoints: number;
};

export type SprintFolderData = {
  settings: {
    folderId: string;
    spaceId: string;
    name: string;
    durationDays: number;
    startDayOfWeek: number;
    startTime: string;
    timezone: string;
    estimationMetric: "POINTS" | "TIME";
    pointScale: number[];
  };
  sourceLists: Array<{ id: string; spaceId: string; name: string; color: string | null }>;
  sprints: SprintSummary[];
};

export type SprintTask = {
  membershipId: string;
  taskId: string;
  name: string;
  listId: string;
  listName: string;
  listColor: string | null;
  statusId: string;
  status: { id: string; name: string; color: string; type: StatusType };
  priority: Priority | null;
  startDate: string | null;
  dueDate: string | null;
  timeEstimate: number | null;
  sprintPoints: number | null;
  parentId: string | null;
  assignees: UserLite[];
  addedAt: string;
  outcome: "COMPLETED" | "CARRIED_OVER" | "UNFINISHED" | "REMOVED" | "CANCELLED" | "DELETED" | null;
};

export type SprintDetail = {
  sprint: SprintSummary;
  tasks: SprintTask[];
  progress: {
    totalTasks: number;
    completedTasks: number;
    remainingTasks: number;
    unassignedTasks: number;
    unestimatedTasks: number;
    totalPoints: number;
    completedPoints: number;
    remainingPoints: number;
  };
};

export type SprintBacklogTask = Omit<SprintTask, "membershipId" | "assignees" | "addedAt" | "outcome">;

export type TaskSprintHistory = {
  membershipId: string;
  sprintId: string;
  sprintFolderId: string;
  sprintName: string;
  sprintFolderName: string;
  sprintStatus: SprintStatus;
  outcome: SprintTask["outcome"];
  startsAt: string;
  endsAt: string;
  addedAt: string;
  removedAt: string | null;
  pointsAtAdd: number | null;
  forecastPoints: number | null;
  pointsAtClose: number | null;
  carriedFromMembershipId: string | null;
};

export type SprintReportPoint = {
  date: string;
  idealRemaining: number;
  scopePoints?: number;
  completedPoints?: number;
  remainingPoints?: number;
  scopeTasks?: number;
  completedTasks?: number;
};

export type SprintReport = {
  forecast: { tasks: number; points: number };
  scopeChange: { addedTasks: number; addedPoints: number; removedTasks: number; removedPoints: number };
  series: SprintReportPoint[];
  changes: Array<{ type: "ADDED" | "REMOVED"; at: string; taskName: string; listName: string; points: number }>;
};

export type SprintFolderReport = {
  averageVelocity: number;
  sprints: Array<{
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    completedAt: string | null;
    committedTasks: number;
    completedTasks: number;
    carriedTasks: number;
    forecastPoints: number;
    completedPoints: number;
  }>;
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
  color: string;
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
    config: any;
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
  duration: number;
  description: string | null;
  user: UserLite;
};

export type TaskDetail = TaskWithRelations & {
  createdBy: UserLite | null;
  watchers: { user: UserLite }[];
  attachments: TaskAttachment[];
  timeEntries: TaskTimeEntry[];
  blockedBy: Array<{
    id: string;
    blocker: { id: string; name: string; listId: string; status: { name: string; color: string; type: StatusType } };
  }>;
  blocking: Array<{
    id: string;
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

// ----------------------------------------------------------------------------
// Doc & DocPage Shapes
// ----------------------------------------------------------------------------

export type DocItem = {
  id: string;
  workspaceId: string;
  spaceId: string | null;
  folderId: string | null;
  listId: string | null;
  taskId: string | null;
  title: string;
  createdById: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  creator?: UserLite;
};

export type DocPageItem = {
  id: string;
  docId: string;
  parentPageId: string | null;
  title: string;
  contentMarkdown?: string;
  contentHtml?: string;
  icon?: string | null;
  coverImage?: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  isPublished?: boolean;
  hasDraft?: boolean;
  draftMarkdown?: string | null;
  draftHtml?: string | null;
};

export type DocCommentItem = {
  id: string;
  docPageId: string;
  userId: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  user?: UserLite;
};

export type CreateDocCommentPayload = {
  body: string;
  parentId?: string | null;
};

export type DocDetail = {
  doc: DocItem;
  pages: DocPageItem[];
};

export type DocDetailResponse = DocDetail;

export type CreateDocPayload = {
  workspaceId?: string;
  spaceId?: string;
  folderId?: string;
  listId?: string;
  taskId?: string;
  title?: string;
};

export type UpdateDocPayload = {
  title?: string;
  isPinned?: boolean;
  spaceId?: string | null;
  folderId?: string | null;
  listId?: string | null;
};

export type CreateDocPagePayload = {
  title?: string;
  parentPageId?: string | null;
  position?: number;
  contentMarkdown?: string;
  contentHtml?: string;
  icon?: string | null;
  coverImage?: string | null;
};

export type UpdateDocPagePayload = {
  title?: string;
  contentMarkdown?: string;
  contentHtml?: string;
  icon?: string | null;
  coverImage?: string | null;
  position?: number;
  parentPageId?: string | null;
  isPublished?: boolean;
  hasDraft?: boolean;
  draftMarkdown?: string | null;
  draftHtml?: string | null;
};
