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

type TaskListMetaResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type TaskDetailResponse struct {
	TaskResponse
	List       TaskListMetaResponse   `json:"list"`
	Space      SpaceMetaResponse      `json:"space"`
	Checklists []ChecklistResponse    `json:"checklists"`
	Comments   []CommentResponse      `json:"comments"`
	Activities []TaskActivityResponse `json:"activities"`
}
