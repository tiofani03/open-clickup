package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/dto"
	"open-clickup-server/internal/realtime"
	"open-clickup-server/internal/service"
)

type SprintsHandler struct {
	pool    *pgxpool.Pool
	q       *db.Queries
	service *service.SprintService
}

func NewSprintsHandler(pool *pgxpool.Pool, q *db.Queries) *SprintsHandler {
	return &SprintsHandler{pool: pool, q: q, service: service.NewSprintService(pool)}
}

type sprintFolderRequest struct {
	SpaceID          string                    `json:"spaceId"`
	Name             string                    `json:"name"`
	DurationDays     int32                     `json:"durationDays"`
	StartDayOfWeek   int32                     `json:"startDayOfWeek"`
	StartTime        string                    `json:"startTime"`
	Timezone         string                    `json:"timezone"`
	EstimationMetric db.SprintEstimationMetric `json:"estimationMetric"`
	PointScale       []int32                   `json:"pointScale"`
	SourceListIDs    []string                  `json:"sourceListIds"`
}

type createSprintRequest struct {
	Name     string  `json:"name"`
	Goal     *string `json:"goal"`
	StartsAt string  `json:"startsAt"`
	EndsAt   string  `json:"endsAt"`
}

type updateSprintRequest struct {
	Name     *string `json:"name"`
	Goal     *string `json:"goal"`
	StartsAt *string `json:"startsAt"`
	EndsAt   *string `json:"endsAt"`
}

func (h *SprintsHandler) CreateSprintFolder(c *fiber.Ctx) error {
	var req sprintFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	user := currentUser(c)
	workspaceID, err := h.workspaceForSpace(c.Context(), req.SpaceID)
	if err != nil || !h.hasWorkspaceRole(c.Context(), user.UserId, workspaceID, db.MemberRoleADMIN) {
		return sendError(c, fiber.StatusForbidden, "Admin access is required for this workspace")
	}
	folderID, err := h.service.CreateSprintFolder(c.Context(), service.SprintFolderInput{
		SpaceID: req.SpaceID, Name: req.Name, DurationDays: req.DurationDays,
		StartDayOfWeek: req.StartDayOfWeek, StartTime: req.StartTime, Timezone: req.Timezone,
		EstimationMetric: req.EstimationMetric, PointScale: req.PointScale, SourceListIDs: req.SourceListIDs,
	})
	if err != nil {
		return sprintError(c, err)
	}
	realtime.DefaultHub.Broadcast(realtime.Event{Type: "bootstrap"})
	response, err := h.getFolderResponse(c.Context(), folderID)
	if err != nil {
		return sprintError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(response)
}

func (h *SprintsHandler) GetSprintFolder(c *fiber.Ctx) error {
	folderID := c.Params("folderId")
	settings, err := h.q.GetSprintFolderSettings(c.Context(), folderID)
	if err != nil {
		return sprintError(c, service.ErrSprintNotFound)
	}
	workspaceID, _ := h.workspaceForSpace(c.Context(), settings.SpaceId)
	if !h.hasWorkspaceRole(c.Context(), currentUser(c).UserId, workspaceID, db.MemberRoleGUEST) {
		return sendError(c, fiber.StatusForbidden, "You do not have access to this Sprint Folder")
	}
	response, err := h.getFolderResponse(c.Context(), folderID)
	if err != nil {
		return sprintError(c, err)
	}
	return c.JSON(response)
}

func (h *SprintsHandler) UpdateSprintFolder(c *fiber.Ctx) error {
	folderID := c.Params("folderId")
	var req sprintFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	settings, err := h.q.GetSprintFolderSettings(c.Context(), folderID)
	if err != nil {
		return sprintError(c, service.ErrSprintNotFound)
	}
	workspaceID, _ := h.workspaceForSpace(c.Context(), settings.SpaceId)
	if !h.hasWorkspaceRole(c.Context(), currentUser(c).UserId, workspaceID, db.MemberRoleADMIN) {
		return sendError(c, fiber.StatusForbidden, "Admin access is required for this workspace")
	}
	if req.SpaceID == "" {
		req.SpaceID = settings.SpaceId
	}
	if err := h.service.UpdateSprintFolder(c.Context(), folderID, service.SprintFolderInput{
		SpaceID: req.SpaceID, Name: req.Name, DurationDays: req.DurationDays,
		StartDayOfWeek: req.StartDayOfWeek, StartTime: req.StartTime, Timezone: req.Timezone,
		EstimationMetric: req.EstimationMetric, PointScale: req.PointScale, SourceListIDs: req.SourceListIDs,
	}); err != nil {
		return sprintError(c, err)
	}
	realtime.DefaultHub.Broadcast(realtime.Event{Type: "sprint-folder", SprintFolderID: folderID})
	realtime.DefaultHub.Broadcast(realtime.Event{Type: "bootstrap"})
	response, err := h.getFolderResponse(c.Context(), folderID)
	if err != nil {
		return sprintError(c, err)
	}
	return c.JSON(response)
}

func (h *SprintsHandler) DeleteSprintFolder(c *fiber.Ctx) error {
	folderID := c.Params("folderId")
	if !h.requireFolderRole(c, folderID, db.MemberRoleADMIN) {
		return nil
	}
	if err := h.service.DeleteSprintFolder(c.Context(), folderID); err != nil {
		return sprintError(c, err)
	}
	realtime.DefaultHub.Broadcast(realtime.Event{Type: "bootstrap"})
	return c.JSON(dto.OKResponse{OK: true})
}

func (h *SprintsHandler) CreateSprint(c *fiber.Ctx) error {
	folderID := c.Params("folderId")
	if !h.requireFolderRole(c, folderID, db.MemberRoleMEMBER) {
		return nil
	}
	var req createSprintRequest
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	startsAt, err := time.Parse(time.RFC3339, req.StartsAt)
	if err != nil {
		return sendError(c, fiber.StatusBadRequest, "startsAt must be RFC3339")
	}
	endsAt, err := time.Parse(time.RFC3339, req.EndsAt)
	if err != nil {
		return sendError(c, fiber.StatusBadRequest, "endsAt must be RFC3339")
	}
	sprint, err := h.service.CreateSprint(c.Context(), service.SprintInput{
		FolderID: folderID, Name: req.Name, Goal: req.Goal, StartsAt: startsAt, EndsAt: endsAt,
		UserID: currentUser(c).UserId,
	})
	if err != nil {
		return sprintError(c, err)
	}
	h.broadcastSprint(sprint.ID, folderID)
	return c.Status(fiber.StatusCreated).JSON(sprintModelToSummary(sprint, 0, 0, 0))
}

func (h *SprintsHandler) GetSprint(c *fiber.Ctx) error {
	sprintID := c.Params("sprintId")
	if !h.requireSprintRole(c, sprintID, db.MemberRoleGUEST) {
		return nil
	}
	response, err := h.getSprintDetail(c.Context(), sprintID)
	if err != nil {
		return sprintError(c, err)
	}
	return c.JSON(response)
}

func (h *SprintsHandler) UpdateSprint(c *fiber.Ctx) error {
	sprintID := c.Params("sprintId")
	if !h.requireSprintRole(c, sprintID, db.MemberRoleMEMBER) {
		return nil
	}
	var req updateSprintRequest
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	var startsAt, endsAt *time.Time
	if req.StartsAt != nil {
		parsed, err := time.Parse(time.RFC3339, *req.StartsAt)
		if err != nil {
			return sendError(c, fiber.StatusBadRequest, "startsAt must be RFC3339")
		}
		startsAt = &parsed
	}
	if req.EndsAt != nil {
		parsed, err := time.Parse(time.RFC3339, *req.EndsAt)
		if err != nil {
			return sendError(c, fiber.StatusBadRequest, "endsAt must be RFC3339")
		}
		endsAt = &parsed
	}
	sprint, err := h.service.UpdateSprint(c.Context(), service.UpdateSprintInput{
		SprintID: sprintID, Name: req.Name, Goal: req.Goal, SetGoal: req.Goal != nil,
		StartsAt: startsAt, EndsAt: endsAt,
	})
	if err != nil {
		return sprintError(c, err)
	}
	h.broadcastSprint(sprintID, sprint.SprintFolderId)
	return c.JSON(sprintModelToSummary(sprint, 0, 0, 0))
}

func (h *SprintsHandler) DeleteSprint(c *fiber.Ctx) error {
	sprintID := c.Params("sprintId")
	sprint, err := h.q.GetSprintByID(c.Context(), sprintID)
	if err != nil {
		return sprintError(c, service.ErrSprintNotFound)
	}
	if !h.requireSprintRole(c, sprintID, db.MemberRoleADMIN) {
		return nil
	}
	if err := h.service.DeleteSprint(c.Context(), sprintID); err != nil {
		return sprintError(c, err)
	}
	h.broadcastSprint(sprintID, sprint.SprintFolderId)
	return c.JSON(dto.OKResponse{OK: true})
}

func (h *SprintsHandler) AddTasks(c *fiber.Ctx) error {
	sprintID := c.Params("sprintId")
	if !h.requireSprintRole(c, sprintID, db.MemberRoleMEMBER) {
		return nil
	}
	var req struct {
		TaskIDs         []string `json:"taskIds"`
		ReplaceExisting bool     `json:"replaceExisting"`
	}
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	if err := h.service.AddTasks(c.Context(), service.AddSprintTasksInput{
		SprintID: sprintID, TaskIDs: req.TaskIDs, UserID: currentUser(c).UserId,
		ReplaceExisting: req.ReplaceExisting,
	}); err != nil {
		return sprintError(c, err)
	}
	sprint, _ := h.q.GetSprintByID(c.Context(), sprintID)
	for _, taskID := range req.TaskIDs {
		h.broadcastTaskMembership(sprintID, sprint.SprintFolderId, taskID)
	}
	response, err := h.getSprintDetail(c.Context(), sprintID)
	if err != nil {
		return sprintError(c, err)
	}
	return c.JSON(response)
}

func (h *SprintsHandler) RemoveTask(c *fiber.Ctx) error {
	sprintID, taskID := c.Params("sprintId"), c.Params("taskId")
	if !h.requireSprintRole(c, sprintID, db.MemberRoleMEMBER) {
		return nil
	}
	if err := h.service.RemoveTask(c.Context(), sprintID, taskID, currentUser(c).UserId); err != nil {
		return sprintError(c, err)
	}
	sprint, _ := h.q.GetSprintByID(c.Context(), sprintID)
	h.broadcastTaskMembership(sprintID, sprint.SprintFolderId, taskID)
	return c.JSON(dto.OKResponse{OK: true})
}

func (h *SprintsHandler) StartSprint(c *fiber.Ctx) error {
	sprintID := c.Params("sprintId")
	if !h.requireSprintRole(c, sprintID, db.MemberRoleMEMBER) {
		return nil
	}
	sprint, err := h.service.StartSprint(c.Context(), sprintID, currentUser(c).UserId)
	if err != nil {
		return sprintError(c, err)
	}
	h.broadcastSprint(sprintID, sprint.SprintFolderId)
	return c.JSON(sprintModelToSummary(sprint, 0, 0, 0))
}

func (h *SprintsHandler) CompleteSprint(c *fiber.Ctx) error {
	sprintID := c.Params("sprintId")
	if !h.requireSprintRole(c, sprintID, db.MemberRoleMEMBER) {
		return nil
	}
	var req struct {
		DefaultAction  string `json:"defaultAction"`
		TargetSprintID string `json:"targetSprintId"`
		Overrides      []struct {
			TaskID         string `json:"taskId"`
			Action         string `json:"action"`
			TargetSprintID string `json:"targetSprintId"`
		} `json:"overrides"`
	}
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	overrides := make([]service.CompletionChoice, len(req.Overrides))
	for index, override := range req.Overrides {
		overrides[index] = service.CompletionChoice{
			TaskID: override.TaskID, Action: override.Action, TargetSprintID: override.TargetSprintID,
		}
	}
	result, err := h.service.CompleteSprint(c.Context(), service.CompleteSprintInput{
		SprintID: sprintID, UserID: currentUser(c).UserId, DefaultAction: req.DefaultAction,
		TargetSprintID: req.TargetSprintID, Overrides: overrides,
	})
	if err != nil {
		return sprintError(c, err)
	}
	h.broadcastSprint(sprintID, result.Sprint.SprintFolderId)
	summary := sprintModelToSummary(result.Sprint, int32(result.Completed+result.CarriedOver+result.Unfinished), int32(result.Completed), 0)
	if detail, detailErr := h.getSprintDetail(c.Context(), sprintID); detailErr == nil {
		summary = detail.Sprint
	}
	return c.JSON(dto.CompleteSprintResult{
		Sprint:    summary,
		Completed: result.Completed, CarriedOver: result.CarriedOver, Unfinished: result.Unfinished,
	})
}

func (h *SprintsHandler) CancelSprint(c *fiber.Ctx) error {
	sprintID := c.Params("sprintId")
	if !h.requireSprintRole(c, sprintID, db.MemberRoleADMIN) {
		return nil
	}
	sprint, err := h.service.CancelSprint(c.Context(), sprintID, currentUser(c).UserId)
	if err != nil {
		return sprintError(c, err)
	}
	h.broadcastSprint(sprintID, sprint.SprintFolderId)
	return c.JSON(sprintModelToSummary(sprint, 0, 0, 0))
}

func (h *SprintsHandler) GetBacklog(c *fiber.Ctx) error {
	folderID := c.Params("folderId")
	if !h.requireFolderRole(c, folderID, db.MemberRoleGUEST) {
		return nil
	}
	rows, err := h.q.ListSprintBacklogTasks(c.Context(), folderID)
	if err != nil {
		return sprintError(c, err)
	}
	result := make([]dto.SprintBacklogTaskResponse, len(rows))
	for index, row := range rows {
		result[index] = dto.SprintBacklogTaskResponse{
			TaskID: row.ID, Name: row.Name, ListID: row.ListId, ListName: row.ListName,
			ListColor: textOrNil(row.ListColor), StatusID: row.StatusId,
			Status:   dto.SprintTaskStatus{ID: row.StatusId, Name: row.StatusName, Color: row.StatusColor, Type: string(row.StatusType)},
			Priority: priorityOrNil(row.Priority), StartDate: timestampOrNil(row.StartDate), DueDate: timestampOrNil(row.DueDate),
			TimeEstimate: int4OrNil(row.TimeEstimate), SprintPoints: int4OrNil(row.SprintPoints), ParentID: textOrNil(row.ParentId),
		}
	}
	return c.JSON(fiber.Map{"tasks": result})
}

func (h *SprintsHandler) GetTaskSprintHistory(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	var workspaceID string
	if err := h.pool.QueryRow(c.Context(), `
		SELECT sp."workspaceId"
		FROM "Task" t JOIN "List" l ON l.id = t."listId" JOIN "Space" sp ON sp.id = l."spaceId"
		WHERE t.id = $1
	`, taskID).Scan(&workspaceID); errors.Is(err, pgx.ErrNoRows) {
		return sendError(c, fiber.StatusNotFound, "Task not found")
	} else if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}
	if !h.hasWorkspaceRole(c.Context(), currentUser(c).UserId, workspaceID, db.MemberRoleGUEST) {
		return sendError(c, fiber.StatusForbidden, "You do not have access to this task")
	}
	rows, err := h.q.ListTaskSprintHistory(c.Context(), pgtype.Text{String: taskID, Valid: true})
	if err != nil {
		return sprintError(c, err)
	}
	result := make([]dto.TaskSprintHistoryResponse, len(rows))
	for index, row := range rows {
		var outcome *string
		if row.Outcome.Valid {
			value := string(row.Outcome.SprintTaskOutcome)
			outcome = &value
		}
		result[index] = dto.TaskSprintHistoryResponse{
			MembershipID: row.ID, SprintID: row.SprintId, SprintFolderID: row.SprintFolderId,
			SprintName: row.SprintName, SprintFolderName: row.FolderName, SprintStatus: string(row.SprintStatus),
			Outcome: outcome, StartsAt: formatTime(row.StartsAt.Time), EndsAt: formatTime(row.EndsAt.Time),
			AddedAt: formatTime(row.AddedAt.Time), RemovedAt: timestamptzOrNil(row.RemovedAt),
			PointsAtAdd: int4OrNil(row.PointsAtAdd), ForecastPoints: int4OrNil(row.ForecastPoints),
			PointsAtClose: int4OrNil(row.PointsAtClose), CarriedFromMembershipID: textOrNil(row.CarriedFromMembershipId),
		}
	}
	return c.JSON(fiber.Map{"history": result})
}

func (h *SprintsHandler) getFolderResponse(ctx context.Context, folderID string) (dto.SprintFolderResponse, error) {
	settings, err := h.q.GetSprintFolderSettings(ctx, folderID)
	if err != nil {
		return dto.SprintFolderResponse{}, err
	}
	sourceRows, err := h.q.ListSprintFolderSourceLists(ctx, folderID)
	if err != nil {
		return dto.SprintFolderResponse{}, err
	}
	sprintRows, err := h.q.ListSprintsByFolder(ctx, folderID)
	if err != nil {
		return dto.SprintFolderResponse{}, err
	}
	sources := make([]dto.SprintSourceListResponse, len(sourceRows))
	for index, source := range sourceRows {
		sources[index] = dto.SprintSourceListResponse{
			ID: source.ListId, SpaceID: source.SpaceID, Name: source.ListName, Color: textOrNil(source.ListColor),
		}
	}
	sprints := make([]dto.SprintSummaryResponse, len(sprintRows))
	for index, sprint := range sprintRows {
		sprints[index] = dto.SprintSummaryResponse{
			ID: sprint.ID, SprintFolderID: sprint.SprintFolderId, Name: sprint.Name, Goal: textOrNil(sprint.Goal),
			Status: string(sprint.Status), StartsAt: formatTime(sprint.StartsAt.Time), EndsAt: formatTime(sprint.EndsAt.Time),
			Timezone: sprint.TimezoneSnapshot, ForecastLockedAt: timestamptzOrNil(sprint.ForecastLockedAt),
			StartedAt: timestamptzOrNil(sprint.StartedAt), CompletedAt: timestamptzOrNil(sprint.CompletedAt),
			TaskCount: sprint.TaskCount, CompletedCount: sprint.CompletedCount, TotalPoints: sprint.TotalPoints,
		}
	}
	totalSeconds := settings.StartTime.Microseconds / 1_000_000
	return dto.SprintFolderResponse{
		Settings: dto.SprintFolderSettingsResponse{
			FolderID: settings.FolderId, SpaceID: settings.SpaceId, Name: settings.FolderName,
			DurationDays: settings.DurationDays, StartDayOfWeek: settings.StartDayOfWeek,
			StartTime: fmtTime(totalSeconds), Timezone: settings.Timezone,
			EstimationMetric: string(settings.EstimationMetric), PointScale: settings.PointScale,
		},
		SourceLists: sources,
		Sprints:     sprints,
	}, nil
}

func (h *SprintsHandler) getSprintDetail(ctx context.Context, sprintID string) (dto.SprintDetailResponse, error) {
	sprint, err := h.q.GetSprintByID(ctx, sprintID)
	if err != nil {
		return dto.SprintDetailResponse{}, err
	}
	rows, err := h.q.ListOpenSprintTasks(ctx, sprintID)
	if err != nil {
		return dto.SprintDetailResponse{}, err
	}
	tasks := make([]dto.SprintTaskResponse, len(rows))
	progress := dto.SprintProgressResponse{TotalTasks: len(rows)}
	for index, row := range rows {
		assignees := []dto.UserResponse{}
		if encoded, marshalErr := json.Marshal(row.Assignees); marshalErr == nil {
			_ = json.Unmarshal(encoded, &assignees)
		}
		var outcome *string
		if row.Outcome.Valid {
			value := string(row.Outcome.SprintTaskOutcome)
			outcome = &value
		}
		tasks[index] = dto.SprintTaskResponse{
			MembershipID: row.ID, TaskID: row.TaskId.String, Name: row.TaskName,
			ListID: row.ListId, ListName: row.ListName, ListColor: textOrNil(row.ListColor),
			StatusID: row.StatusId, Status: dto.SprintTaskStatus{ID: row.StatusId, Name: row.StatusName, Color: row.StatusColor, Type: string(row.StatusType)},
			Priority: priorityOrNil(row.Priority), StartDate: timestampOrNil(row.StartDate), DueDate: timestampOrNil(row.DueDate),
			TimeEstimate: int32OrNil(row.TimeEstimate), SprintPoints: int32OrNil(row.SprintPoints), ParentID: textOrNil(row.ParentId),
			Assignees: assignees, AddedAt: formatTime(row.AddedAt.Time), Outcome: outcome,
		}
		points := int32(0)
		if row.SprintPoints >= 0 {
			points = row.SprintPoints
		}
		progress.TotalPoints += points
		isCompleted := row.StatusType == db.StatusTypeDONE || row.StatusType == db.StatusTypeCLOSED
		if sprint.Status == db.SprintStatusCOMPLETED {
			isCompleted = row.Outcome.Valid && row.Outcome.SprintTaskOutcome == db.SprintTaskOutcomeCOMPLETED
		}
		if isCompleted {
			progress.CompletedTasks++
			progress.CompletedPoints += points
		}
		if len(assignees) == 0 {
			progress.UnassignedTasks++
		}
		if row.SprintPoints < 0 {
			progress.UnestimatedTasks++
		}
	}
	progress.RemainingTasks = progress.TotalTasks - progress.CompletedTasks
	progress.RemainingPoints = progress.TotalPoints - progress.CompletedPoints
	summary := dto.SprintSummaryResponse{
		ID: sprint.ID, SprintFolderID: sprint.SprintFolderId, Name: sprint.Name, Goal: textOrNil(sprint.Goal),
		Status: string(sprint.Status), StartsAt: formatTime(sprint.StartsAt.Time), EndsAt: formatTime(sprint.EndsAt.Time),
		Timezone: sprint.TimezoneSnapshot, ForecastLockedAt: timestamptzOrNil(sprint.ForecastLockedAt),
		StartedAt: timestamptzOrNil(sprint.StartedAt), CompletedAt: timestamptzOrNil(sprint.CompletedAt),
		TaskCount: int32(progress.TotalTasks), CompletedCount: int32(progress.CompletedTasks), TotalPoints: int64(progress.TotalPoints),
	}
	return dto.SprintDetailResponse{Sprint: summary, Tasks: tasks, Progress: progress}, nil
}

func currentUser(c *fiber.Ctx) *db.GetSessionWithUserRow {
	return c.Locals("user").(*db.GetSessionWithUserRow)
}

func sprintError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, service.ErrSprintNotFound), errors.Is(err, pgx.ErrNoRows):
		return sendError(c, fiber.StatusNotFound, "Sprint resource not found")
	case errors.Is(err, service.ErrSprintForbidden):
		return sendError(c, fiber.StatusForbidden, err.Error())
	case errors.Is(err, service.ErrSprintInvalid):
		return sendError(c, fiber.StatusBadRequest, strings.TrimPrefix(err.Error(), service.ErrSprintInvalid.Error()+": "))
	case errors.Is(err, service.ErrSprintConflict):
		return sendError(c, fiber.StatusConflict, strings.TrimPrefix(err.Error(), service.ErrSprintConflict.Error()+": "))
	default:
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}
}

func formatTime(value time.Time) string { return value.UTC().Format(time.RFC3339Nano) }

func timestamptzOrNil(value pgtype.Timestamptz) *string {
	if !value.Valid {
		return nil
	}
	formatted := formatTime(value.Time)
	return &formatted
}

func timestampOrNil(value pgtype.Timestamp) *string {
	if !value.Valid {
		return nil
	}
	formatted := value.Time.UTC().Format(time.RFC3339Nano)
	return &formatted
}

func int4OrNil(value pgtype.Int4) *int32 {
	if !value.Valid {
		return nil
	}
	return &value.Int32
}

func int32OrNil(value int32) *int32 {
	if value < 0 {
		return nil
	}
	return &value
}

func priorityOrNil(value db.NullPriority) *string {
	if !value.Valid {
		return nil
	}
	priority := string(value.Priority)
	return &priority
}

func sprintModelToSummary(value db.Sprint, taskCount, completedCount int32, totalPoints int64) dto.SprintSummaryResponse {
	return dto.SprintSummaryResponse{
		ID: value.ID, SprintFolderID: value.SprintFolderId, Name: value.Name, Goal: textOrNil(value.Goal),
		Status: string(value.Status), StartsAt: formatTime(value.StartsAt.Time), EndsAt: formatTime(value.EndsAt.Time),
		Timezone: value.TimezoneSnapshot, ForecastLockedAt: timestamptzOrNil(value.ForecastLockedAt),
		StartedAt: timestamptzOrNil(value.StartedAt), CompletedAt: timestamptzOrNil(value.CompletedAt),
		TaskCount: taskCount, CompletedCount: completedCount, TotalPoints: totalPoints,
	}
}

func (h *SprintsHandler) broadcastSprint(sprintID, folderID string) {
	realtime.DefaultHub.Broadcast(realtime.Event{Type: "sprint", SprintID: sprintID, SprintFolderID: folderID})
	realtime.DefaultHub.Broadcast(realtime.Event{Type: "bootstrap"})
}

func (h *SprintsHandler) broadcastTaskMembership(sprintID, folderID, taskID string) {
	h.broadcastSprint(sprintID, folderID)
	var listID string
	if err := h.pool.QueryRow(context.Background(), `SELECT "listId" FROM "Task" WHERE id = $1`, taskID).Scan(&listID); err == nil {
		realtime.DefaultHub.Broadcast(realtime.Event{Type: "list", ListID: listID})
	}
}

func (h *SprintsHandler) workspaceForSpace(ctx context.Context, spaceID string) (string, error) {
	var workspaceID string
	err := h.pool.QueryRow(ctx, `SELECT "workspaceId" FROM "Space" WHERE id = $1`, spaceID).Scan(&workspaceID)
	return workspaceID, err
}

func (h *SprintsHandler) hasWorkspaceRole(ctx context.Context, userID, workspaceID string, minimum db.MemberRole) bool {
	var role db.MemberRole
	if err := h.pool.QueryRow(ctx, `
		SELECT role FROM "WorkspaceMember" WHERE "userId" = $1 AND "workspaceId" = $2
	`, userID, workspaceID).Scan(&role); err != nil {
		return false
	}
	rank := map[db.MemberRole]int{db.MemberRoleGUEST: 0, db.MemberRoleMEMBER: 1, db.MemberRoleADMIN: 2, db.MemberRoleOWNER: 3}
	return rank[role] >= rank[minimum]
}

func (h *SprintsHandler) requireFolderRole(c *fiber.Ctx, folderID string, role db.MemberRole) bool {
	var workspaceID string
	err := h.pool.QueryRow(c.Context(), `
		SELECT sp."workspaceId" FROM "Folder" f JOIN "Space" sp ON sp.id = f."spaceId"
		WHERE f.id = $1 AND f.kind = 'SPRINT'
	`, folderID).Scan(&workspaceID)
	if errors.Is(err, pgx.ErrNoRows) {
		_ = sendError(c, fiber.StatusNotFound, "Sprint Folder not found")
		return false
	}
	if err != nil {
		_ = sendError(c, fiber.StatusInternalServerError, err.Error())
		return false
	}
	if !h.hasWorkspaceRole(c.Context(), currentUser(c).UserId, workspaceID, role) {
		_ = sendError(c, fiber.StatusForbidden, "You do not have permission for this Sprint Folder")
		return false
	}
	return true
}

func (h *SprintsHandler) requireSprintRole(c *fiber.Ctx, sprintID string, role db.MemberRole) bool {
	var workspaceID string
	err := h.pool.QueryRow(c.Context(), `
		SELECT sp."workspaceId"
		FROM "Sprint" s
		JOIN "Folder" f ON f.id = s."sprintFolderId"
		JOIN "Space" sp ON sp.id = f."spaceId"
		WHERE s.id = $1
	`, sprintID).Scan(&workspaceID)
	if errors.Is(err, pgx.ErrNoRows) {
		_ = sendError(c, fiber.StatusNotFound, "Sprint not found")
		return false
	}
	if err != nil {
		_ = sendError(c, fiber.StatusInternalServerError, err.Error())
		return false
	}
	if !h.hasWorkspaceRole(c.Context(), currentUser(c).UserId, workspaceID, role) {
		_ = sendError(c, fiber.StatusForbidden, "You do not have permission for this Sprint")
		return false
	}
	return true
}

func fmtTime(totalSeconds int64) string {
	hours := totalSeconds / 3600
	minutes := (totalSeconds % 3600) / 60
	return fmt.Sprintf("%02d:%02d", hours, minutes)
}
