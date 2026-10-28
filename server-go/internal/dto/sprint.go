package dto

type SprintFolderSettingsResponse struct {
	FolderID         string  `json:"folderId"`
	SpaceID          string  `json:"spaceId"`
	Name             string  `json:"name"`
	DurationDays     int32   `json:"durationDays"`
	StartDayOfWeek   int32   `json:"startDayOfWeek"`
	StartTime        string  `json:"startTime"`
	Timezone         string  `json:"timezone"`
	EstimationMetric string  `json:"estimationMetric"`
	PointScale       []int32 `json:"pointScale"`
}

type SprintSourceListResponse struct {
	ID      string  `json:"id"`
	SpaceID string  `json:"spaceId"`
	Name    string  `json:"name"`
	Color   *string `json:"color"`
}

type SprintSummaryResponse struct {
	ID               string  `json:"id"`
	SprintFolderID   string  `json:"sprintFolderId"`
	Name             string  `json:"name"`
	Goal             *string `json:"goal"`
	Status           string  `json:"status"`
	StartsAt         string  `json:"startsAt"`
	EndsAt           string  `json:"endsAt"`
	Timezone         string  `json:"timezone"`
	ForecastLockedAt *string `json:"forecastLockedAt"`
	StartedAt        *string `json:"startedAt"`
	CompletedAt      *string `json:"completedAt"`
	TaskCount        int32   `json:"taskCount"`
	CompletedCount   int32   `json:"completedCount"`
	TotalPoints      int64   `json:"totalPoints"`
}

type SprintFolderResponse struct {
	Settings    SprintFolderSettingsResponse `json:"settings"`
	SourceLists []SprintSourceListResponse   `json:"sourceLists"`
	Sprints     []SprintSummaryResponse      `json:"sprints"`
}

type SprintTaskResponse struct {
	MembershipID string           `json:"membershipId"`
	TaskID       string           `json:"taskId"`
	Name         string           `json:"name"`
	ListID       string           `json:"listId"`
	ListName     string           `json:"listName"`
	ListColor    *string          `json:"listColor"`
	StatusID     string           `json:"statusId"`
	Status       SprintTaskStatus `json:"status"`
	Priority     *string          `json:"priority"`
	StartDate    *string          `json:"startDate"`
	DueDate      *string          `json:"dueDate"`
	TimeEstimate *int32           `json:"timeEstimate"`
	SprintPoints *int32           `json:"sprintPoints"`
	ParentID     *string          `json:"parentId"`
	Assignees    []UserResponse   `json:"assignees"`
	AddedAt      string           `json:"addedAt"`
	Outcome      *string          `json:"outcome"`
}

type SprintTaskStatus struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
	Type  string `json:"type"`
}

type SprintProgressResponse struct {
	TotalTasks       int   `json:"totalTasks"`
	CompletedTasks   int   `json:"completedTasks"`
	RemainingTasks   int   `json:"remainingTasks"`
	UnassignedTasks  int   `json:"unassignedTasks"`
	UnestimatedTasks int   `json:"unestimatedTasks"`
	TotalPoints      int32 `json:"totalPoints"`
	CompletedPoints  int32 `json:"completedPoints"`
	RemainingPoints  int32 `json:"remainingPoints"`
}

type SprintDetailResponse struct {
	Sprint   SprintSummaryResponse  `json:"sprint"`
	Tasks    []SprintTaskResponse   `json:"tasks"`
	Progress SprintProgressResponse `json:"progress"`
}

type SprintBacklogTaskResponse struct {
	TaskID       string           `json:"taskId"`
	Name         string           `json:"name"`
	ListID       string           `json:"listId"`
	ListName     string           `json:"listName"`
	ListColor    *string          `json:"listColor"`
	StatusID     string           `json:"statusId"`
	Status       SprintTaskStatus `json:"status"`
	Priority     *string          `json:"priority"`
	StartDate    *string          `json:"startDate"`
	DueDate      *string          `json:"dueDate"`
	TimeEstimate *int32           `json:"timeEstimate"`
	SprintPoints *int32           `json:"sprintPoints"`
	ParentID     *string          `json:"parentId"`
}

type TaskSprintHistoryResponse struct {
	MembershipID            string  `json:"membershipId"`
	SprintID                string  `json:"sprintId"`
	SprintFolderID          string  `json:"sprintFolderId"`
	SprintName              string  `json:"sprintName"`
	SprintFolderName        string  `json:"sprintFolderName"`
	SprintStatus            string  `json:"sprintStatus"`
	Outcome                 *string `json:"outcome"`
	StartsAt                string  `json:"startsAt"`
	EndsAt                  string  `json:"endsAt"`
	AddedAt                 string  `json:"addedAt"`
	RemovedAt               *string `json:"removedAt"`
	PointsAtAdd             *int32  `json:"pointsAtAdd"`
	ForecastPoints          *int32  `json:"forecastPoints"`
	PointsAtClose           *int32  `json:"pointsAtClose"`
	CarriedFromMembershipID *string `json:"carriedFromMembershipId"`
}

type CompleteSprintResult struct {
	Sprint      SprintSummaryResponse `json:"sprint"`
	Completed   int                   `json:"completed"`
	CarriedOver int                   `json:"carriedOver"`
	Unfinished  int                   `json:"unfinished"`
}
