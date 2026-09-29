package dto

type TaskAssigneeResponse struct {
	UserID string       `json:"userId"`
	User   UserResponse `json:"user"`
}

type TagMetaResponse struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type TaskTagResponse struct {
	TagID string          `json:"tagId"`
	Tag   TagMetaResponse `json:"tag"`
}

type SubtaskResponse struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	StatusID  string                 `json:"statusId"`
	Position  float64                `json:"position"`
	Status    StatusResponse         `json:"status"`
	Assignees []TaskAssigneeResponse `json:"assignees,omitempty"`
}

type TaskCount struct {
	Comments   int `json:"comments"`
	Checklists int `json:"checklists"`
	Subtasks   int `json:"subtasks"`
}

type TaskResponse struct {
	ID                string                 `json:"id"`
	ListID            string                 `json:"listId"`
	StatusID          string                 `json:"statusId"`
	ParentID          *string                `json:"parentId"`
	Name              string                 `json:"name"`
	Description       *string                `json:"description"`
	Priority          *string                `json:"priority"`
	Position          float64                `json:"position"`
	StartDate         *string                `json:"startDate"`
	DueDate           *string                `json:"dueDate"`
	TimeEstimate      *int32                 `json:"timeEstimate"`
	CreatedByID       *string                `json:"createdById"`
	CreatedAt         string                 `json:"createdAt"`
	UpdatedAt         string                 `json:"updatedAt"`
	CompletedAt       *string                `json:"completedAt"`
	Archived          bool                   `json:"archived"`
	Recurrence        *string                `json:"recurrence"`
	Status            StatusResponse         `json:"status"`
	Assignees         []TaskAssigneeResponse `json:"assignees"`
	Tags              []TaskTagResponse      `json:"tags"`
	Subtasks          []SubtaskResponse      `json:"subtasks"`
	CustomFieldValues []interface{}          `json:"customFieldValues"`
	Count             TaskCount              `json:"_count"`
}

type ActivityUserMeta struct {
	Name      string  `json:"name"`
	Color     string  `json:"color"`
	AvatarURL *string `json:"avatarUrl"`
}

type TaskActivityResponse struct {
	ID        string           `json:"id"`
	TaskID    string           `json:"taskId"`
	UserID    *string          `json:"userId"`
	Type      string           `json:"type"`
	Data      interface{}      `json:"data"`
	CreatedAt string           `json:"createdAt"`
	User      ActivityUserMeta `json:"user"`
}

type TaskWatcherResponse struct {
	User UserResponse `json:"user"`
}

type TaskAttachmentResponse struct {
	ID        string `json:"id"`
	TaskID    string `json:"taskId"`
	FileName  string `json:"fileName"`
	FileSize  int64  `json:"fileSize"`
	MimeType  string `json:"mimeType"`
	URL       string `json:"url"`
	CreatedAt string `json:"createdAt"`
}

type TaskTimeEntryResponse struct {
	ID        string       `json:"id"`
	TaskID    string       `json:"taskId"`
	UserID    string       `json:"userId"`
	StartedAt string       `json:"startedAt"`
	EndedAt   *string      `json:"endedAt"`
	Duration  *int32       `json:"duration"`
	User      UserResponse `json:"user"`
}

type TaskDependencyBlockerItem struct {
	ID     string         `json:"id"`
	Name   string         `json:"name"`
	ListID string         `json:"listId"`
	Status StatusResponse `json:"status"`
}

type TaskBlockedByResponse struct {
	Blocker TaskDependencyBlockerItem `json:"blocker"`
}

type TaskBlockingResponse struct {
	Blocked TaskDependencyBlockerItem `json:"blocked"`
}

type TaskListDetailResponse struct {
	ID           string           `json:"id"`
	Name         string           `json:"name"`
	SpaceID      string           `json:"spaceId"`
	Statuses     []StatusResponse `json:"statuses"`
	CustomFields []interface{}    `json:"customFields"`
}

type TaskDetailResponse struct {
	TaskResponse
	CreatedBy   *UserResponse            `json:"createdBy"`
	Watchers    []TaskWatcherResponse    `json:"watchers"`
	Attachments []TaskAttachmentResponse `json:"attachments"`
	TimeEntries []TaskTimeEntryResponse  `json:"timeEntries"`
	BlockedBy   []TaskBlockedByResponse  `json:"blockedBy"`
	Blocking    []TaskBlockingResponse   `json:"blocking"`
	Checklists  []ChecklistResponse      `json:"checklists"`
	Comments    []CommentResponse        `json:"comments"`
	Activities  []TaskActivityResponse   `json:"activities"`
	List        TaskListDetailResponse   `json:"list"`
	Space       SpaceMetaResponse        `json:"space"`
}

type MyTaskStatusResponse struct {
	Name  string `json:"name"`
	Color string `json:"color"`
	Type  string `json:"type"`
}

type MyTaskSpaceResponse struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type MyTaskListResponse struct {
	Name  string              `json:"name"`
	Space MyTaskSpaceResponse `json:"space"`
}

type MyTaskResponse struct {
	ID        string               `json:"id"`
	Name      string               `json:"name"`
	ListID    string               `json:"listId"`
	Priority  *string              `json:"priority"`
	StartDate *string              `json:"startDate"`
	DueDate   *string              `json:"dueDate"`
	Status    MyTaskStatusResponse `json:"status"`
	List      MyTaskListResponse   `json:"list"`
}

