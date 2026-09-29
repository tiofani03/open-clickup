package handlers

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/dto"
	"open-clickup-server/internal/realtime"
)

type TasksHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewTasksHandler(pool *pgxpool.Pool, q *db.Queries) *TasksHandler {
	return &TasksHandler{pool: pool, q: q}
}

type CreateTaskReq struct {
	ListID       string   `json:"listId"`
	StatusID     string   `json:"statusId"`
	ParentID     *string  `json:"parentId"`
	Name         string   `json:"name"`
	Description  *string  `json:"description"`
	Priority     *string  `json:"priority"`
	StartDate    *string  `json:"startDate"`
	DueDate      *string  `json:"dueDate"`
	TimeEstimate *int32   `json:"timeEstimate"`
	Assignees    []string `json:"assigneeIds"`
}

func (h *TasksHandler) getFormattedTask(ctx context.Context, taskID string) (dto.TaskResponse, error) {
	task, err := h.q.GetTaskByID(ctx, taskID)
	if err != nil {
		return dto.TaskResponse{}, err
	}

	assignees, _ := h.q.ListTaskAssignees(ctx, taskID)
	assigneeList := make([]dto.TaskAssigneeResponse, len(assignees))
	for ai, a := range assignees {
		assigneeList[ai] = dto.TaskAssigneeResponse{
			UserID: a.UserId,
			User: dto.UserResponse{
				ID:        a.UserId,
				Name:      a.UserName,
				Email:     a.UserEmail,
				Color:     a.UserColor,
				AvatarURL: textOrNil(a.UserAvatarUrl),
			},
		}
	}

	tags, _ := h.q.ListTaskTags(ctx, taskID)
	tagList := make([]dto.TaskTagResponse, len(tags))
	for ti, tg := range tags {
		tagList[ti] = dto.TaskTagResponse{
			TagID: tg.TagId,
			Tag: dto.TagMetaResponse{
				ID:    tg.TagId,
				Name:  tg.TagName,
				Color: tg.TagColor,
			},
		}
	}

	subtasks, _ := h.q.ListSubtasksByParent(ctx, pgtype.Text{String: taskID, Valid: true})
	subtaskList := make([]dto.SubtaskResponse, len(subtasks))
	for si, sub := range subtasks {
		subtaskList[si] = dto.SubtaskResponse{
			ID:       sub.ID,
			Name:     sub.Name,
			StatusID: sub.StatusId,
			Position: sub.Position,
			Status: dto.StatusResponse{
				ID:       sub.StatusId,
				Name:     sub.StatusName,
				Color:    sub.StatusColor,
				Type:     string(sub.StatusType),
				Position: 0,
			},
		}
	}

	var priority *string
	if task.Priority.Valid {
		pStr := string(task.Priority.Priority)
		priority = &pStr
	}

	var startStr, dueStr, compStr *string
	if task.StartDate.Valid {
		s := task.StartDate.Time.Format("2006-01-02T15:04:05.000Z")
		startStr = &s
	}
	if task.DueDate.Valid {
		s := task.DueDate.Time.Format("2006-01-02T15:04:05.000Z")
		dueStr = &s
	}
	if task.CompletedAt.Valid {
		s := task.CompletedAt.Time.Format("2006-01-02T15:04:05.000Z")
		compStr = &s
	}

	var est *int32
	if task.TimeEstimate.Valid {
		est = &task.TimeEstimate.Int32
	}

	return dto.TaskResponse{
		ID:           task.ID,
		ListID:       task.ListId,
		StatusID:     task.StatusId,
		ParentID:     textOrNil(task.ParentId),
		Name:         task.Name,
		Description:  textOrNil(task.Description),
		Priority:     priority,
		Position:     task.Position,
		StartDate:    startStr,
		DueDate:      dueStr,
		TimeEstimate: est,
		CreatedByID:  textOrNil(task.CreatedById),
		CreatedAt:    task.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt:    task.UpdatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		CompletedAt:  compStr,
		Archived:     task.Archived,
		Recurrence:   textOrNil(task.Recurrence),
		Status: dto.StatusResponse{
			ID:       task.StatusId,
			ListID:   task.ListId,
			Name:     task.StatusName,
			Color:    task.StatusColor,
			Type:     string(task.StatusType),
			Position: 0,
		},
		Assignees:         assigneeList,
		Tags:              tagList,
		Subtasks:          subtaskList,
		CustomFieldValues: []interface{}{},
		Count: dto.TaskCount{
			Comments:   0,
			Checklists: 0,
			Subtasks:   len(subtaskList),
		},
	}, nil
}

func (h *TasksHandler) CreateTask(c *fiber.Ctx) error {
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	var req CreateTaskReq
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || req.ListID == "" {
		return sendError(c, fiber.StatusBadRequest, "name and listId are required")
	}

	ctx := c.Context()

	// Default statusId if omitted
	if req.StatusID == "" {
		statuses, err := h.q.ListStatusesByList(ctx, req.ListID)
		if err != nil || len(statuses) == 0 {
			return sendError(c, fiber.StatusBadRequest, "List has no statuses")
		}
		req.StatusID = statuses[0].ID
	}

	taskID := cuid()

	// Find max position in list
	var lastPos float64
	row := h.pool.QueryRow(ctx, `
		SELECT "position" FROM "Task"
		WHERE "listId" = $1 AND "parentId" IS NULL
		ORDER BY "position" DESC LIMIT 1
	`, req.ListID)
	_ = row.Scan(&lastPos)

	var prio db.NullPriority
	if req.Priority != nil && *req.Priority != "" {
		prio = db.NullPriority{Priority: db.Priority(*req.Priority), Valid: true}
	}

	var startDate, dueDate pgtype.Timestamp
	if req.StartDate != nil && *req.StartDate != "" {
		if t, err := time.Parse(time.RFC3339, *req.StartDate); err == nil {
			startDate = pgtype.Timestamp{Time: t, Valid: true}
		}
	}
	if req.DueDate != nil && *req.DueDate != "" {
		if t, err := time.Parse(time.RFC3339, *req.DueDate); err == nil {
			dueDate = pgtype.Timestamp{Time: t, Valid: true}
		}
	}

	var est pgtype.Int4
	if req.TimeEstimate != nil {
		est = pgtype.Int4{Int32: *req.TimeEstimate, Valid: true}
	}

	task, err := h.q.CreateTask(ctx, db.CreateTaskParams{
		ID:           taskID,
		ListId:       req.ListID,
		StatusId:     req.StatusID,
		ParentId:     stringPtrToText(req.ParentID),
		Name:         req.Name,
		Description:  stringPtrToText(req.Description),
		Priority:     prio,
		Position:     lastPos + 1000,
		StartDate:    startDate,
		DueDate:      dueDate,
		TimeEstimate: est,
		CreatedById:  pgtype.Text{String: user.UserId, Valid: true},
		Recurrence:   pgtype.Text{Valid: false},
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	// Add assignees
	for _, uid := range req.Assignees {
		_, _ = h.q.AddTaskAssignee(ctx, db.AddTaskAssigneeParams{
			TaskId: task.ID,
			UserId: uid,
		})
	}

	// Create activity
	_, _ = h.q.CreateActivity(ctx, db.CreateActivityParams{
		ID:     cuid(),
		TaskId: task.ID,
		UserId: pgtype.Text{String: user.UserId, Valid: true},
		Type:   "created",
		Data:   []byte(`{}`),
	})

	realtime.DefaultHub.Broadcast(realtime.Event{
		Type:   "list",
		ListID: task.ListId,
	})

	if formatted, err := h.getFormattedTask(ctx, task.ID); err == nil {
		return c.Status(fiber.StatusCreated).JSON(formatted)
	}

	return c.Status(fiber.StatusCreated).JSON(task)
}

func (h *TasksHandler) GetTask(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	ctx := c.Context()

	task, err := h.q.GetTaskByID(ctx, taskID)
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "Task not found")
	}

	formatted, err := h.getFormattedTask(ctx, taskID)
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	checklists, _ := h.q.ListChecklistsByTask(ctx, taskID)
	checklistList := make([]dto.ChecklistResponse, len(checklists))
	for ci, ch := range checklists {
		items, _ := h.q.ListChecklistItems(ctx, ch.ID)
		itemList := make([]dto.ChecklistItemResponse, len(items))
		for ii, it := range items {
			itemList[ii] = dto.ChecklistItemResponse{
				ID:          it.ID,
				ChecklistID: it.ChecklistId,
				Name:        it.Name,
				Resolved:    it.Resolved,
				Position:    it.Position,
			}
		}
		checklistList[ci] = dto.ChecklistResponse{
			ID:       ch.ID,
			TaskID:   ch.TaskId,
			Name:     ch.Name,
			Position: ch.Position,
			Items:    itemList,
		}
	}

	comments, _ := h.q.ListCommentsByTask(ctx, taskID)
	commentList := make([]dto.CommentResponse, len(comments))
	for ci, cm := range comments {
		reactions, _ := h.q.ListReactionsByComment(ctx, cm.ID)
		reactionList := make([]dto.CommentReactionResponse, len(reactions))
		for ri, r := range reactions {
			reactionList[ri] = dto.CommentReactionResponse{
				ID:        r.ID,
				CommentID: r.CommentId,
				UserID:    r.UserId,
				Emoji:     r.Emoji,
				User:      dto.ReactionUserMeta{Name: r.UserName},
			}
		}
		commentList[ci] = dto.CommentResponse{
			ID:        cm.ID,
			TaskID:    cm.TaskId,
			UserID:    cm.UserId,
			Body:      cm.Body,
			ParentID:  textOrNil(cm.ParentId),
			Resolved:  cm.Resolved,
			CreatedAt: cm.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			UpdatedAt: cm.UpdatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			User: dto.UserResponse{
				ID:        cm.UserId,
				Name:      cm.UserName,
				Email:     cm.UserEmail,
				Color:     cm.UserColor,
				AvatarURL: textOrNil(cm.UserAvatarUrl),
			},
			Reactions: reactionList,
		}
	}

	activities, _ := h.q.ListActivitiesByTask(ctx, taskID)
	activityList := make([]dto.TaskActivityResponse, len(activities))
	for ai, a := range activities {
		var actData interface{}
		_ = json.Unmarshal(a.Data, &actData)
		activityList[ai] = dto.TaskActivityResponse{
			ID:        a.ID,
			TaskID:    a.TaskId,
			UserID:    textOrNil(a.UserId),
			Type:      a.Type,
			Data:      actData,
			CreatedAt: a.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			User: dto.ActivityUserMeta{
				Name:      a.UserName,
				Color:     a.UserColor,
				AvatarURL: textOrNil(a.UserAvatarUrl),
			},
		}
	}

	watchers, _ := h.q.ListTaskWatchers(ctx, taskID)
	watcherList := make([]dto.TaskWatcherResponse, len(watchers))
	for wi, w := range watchers {
		watcherList[wi] = dto.TaskWatcherResponse{
			User: dto.UserResponse{
				ID:        w.UserId,
				Name:      w.UserName,
				Email:     w.UserEmail,
				Color:     w.UserColor,
				AvatarURL: textOrNil(w.UserAvatarUrl),
			},
		}
	}

	attachments, _ := h.q.ListTaskAttachments(ctx, taskID)
	attachmentList := make([]dto.TaskAttachmentResponse, len(attachments))
	for ai, a := range attachments {
		attachmentList[ai] = dto.TaskAttachmentResponse{
			ID:        a.ID,
			TaskID:    a.TaskId,
			FileName:  a.FileName,
			FileSize:  int64(a.FileSize),
			MimeType:  a.MimeType,
			URL:       a.Url,
			CreatedAt: a.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		}
	}

	timeEntries, _ := h.q.ListTaskTimeEntries(ctx, taskID)
	timeEntryList := make([]dto.TaskTimeEntryResponse, len(timeEntries))
	for ti, te := range timeEntries {
		var endedAt *string
		if te.EndedAt.Valid {
			s := te.EndedAt.Time.Format("2006-01-02T15:04:05.000Z")
			endedAt = &s
		}
		var dur *int32
		d := te.Duration
		dur = &d

		timeEntryList[ti] = dto.TaskTimeEntryResponse{
			ID:        te.ID,
			TaskID:    te.TaskId,
			UserID:    te.UserId,
			StartedAt: te.StartedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			EndedAt:   endedAt,
			Duration:  dur,
			User: dto.UserResponse{
				ID:        te.UserId,
				Name:      te.UserName,
				Email:     te.UserEmail,
				Color:     te.UserColor,
				AvatarURL: textOrNil(te.UserAvatarUrl),
			},
		}
	}

	blockedBy, _ := h.q.ListTaskBlockedBy(ctx, taskID)
	blockedByList := make([]dto.TaskBlockedByResponse, len(blockedBy))
	for bi, b := range blockedBy {
		blockedByList[bi] = dto.TaskBlockedByResponse{
			Blocker: dto.TaskDependencyBlockerItem{
				ID:     b.BlockerTaskID,
				Name:   b.BlockerName,
				ListID: b.BlockerListID,
				Status: dto.StatusResponse{
					Name:  b.StatusName,
					Color: b.StatusColor,
					Type:  string(b.StatusType),
				},
			},
		}
	}

	blocking, _ := h.q.ListTaskBlocking(ctx, taskID)
	blockingList := make([]dto.TaskBlockingResponse, len(blocking))
	for bi, b := range blocking {
		blockingList[bi] = dto.TaskBlockingResponse{
			Blocked: dto.TaskDependencyBlockerItem{
				ID:     b.BlockedTaskID,
				Name:   b.BlockedName,
				ListID: b.BlockedListID,
				Status: dto.StatusResponse{
					Name:  b.StatusName,
					Color: b.StatusColor,
					Type:  string(b.StatusType),
				},
			},
		}
	}

	var createdBy *dto.UserResponse
	if task.CreatedById.Valid && task.CreatedById.String != "" {
		if u, err := h.q.GetUserByID(ctx, task.CreatedById.String); err == nil {
			createdBy = &dto.UserResponse{
				ID:        u.ID,
				Name:      u.Name,
				Email:     u.Email,
				Color:     u.Color,
				AvatarURL: textOrNil(u.AvatarUrl),
			}
		}
	}

	listStatuses, _ := h.q.ListStatusesByList(ctx, task.ListId)
	statusList := make([]dto.StatusResponse, len(listStatuses))
	for si, s := range listStatuses {
		statusList[si] = dto.StatusResponse{
			ID:       s.ID,
			ListID:   s.ListId,
			Name:     s.Name,
			Color:    s.Color,
			Type:     string(s.Type),
			Position: s.Position,
		}
	}

	formatted.Count.Comments = len(commentList)
	formatted.Count.Checklists = len(checklistList)

	return c.JSON(dto.TaskDetailResponse{
		TaskResponse: formatted,
		CreatedBy:    createdBy,
		Watchers:     watcherList,
		Attachments:  attachmentList,
		TimeEntries:  timeEntryList,
		BlockedBy:    blockedByList,
		Blocking:     blockingList,
		Checklists:   checklistList,
		Comments:     commentList,
		Activities:   activityList,
		List: dto.TaskListDetailResponse{
			ID:           task.ListId,
			Name:         task.ListName,
			SpaceID:      task.SpaceID,
			Statuses:     statusList,
			CustomFields: []interface{}{},
		},
		Space: dto.SpaceMetaResponse{
			ID:   task.SpaceID,
			Name: task.SpaceName,
		},
	})
}

func (h *TasksHandler) GetMyTasks(c *fiber.Ctx) error {
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	ctx := c.Context()

	tasks, err := h.q.ListMyTasks(ctx, user.UserId)
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	result := make([]dto.MyTaskResponse, len(tasks))
	for i, t := range tasks {
		var prio *string
		if t.Priority.Valid {
			p := string(t.Priority.Priority)
			prio = &p
		}
		var startStr, dueStr *string
		if t.StartDate.Valid {
			s := t.StartDate.Time.Format("2006-01-02T15:04:05.000Z")
			startStr = &s
		}
		if t.DueDate.Valid {
			s := t.DueDate.Time.Format("2006-01-02T15:04:05.000Z")
			dueStr = &s
		}
		result[i] = dto.MyTaskResponse{
			ID:        t.ID,
			Name:      t.Name,
			ListID:    t.ListId,
			Priority:  prio,
			StartDate: startStr,
			DueDate:   dueStr,
			Status: dto.MyTaskStatusResponse{
				Name:  t.StatusName,
				Color: t.StatusColor,
				Type:  string(t.StatusType),
			},
			List: dto.MyTaskListResponse{
				Name: t.ListName,
				Space: dto.MyTaskSpaceResponse{
					Name:  t.SpaceName,
					Color: t.SpaceColor,
				},
			},
		}
	}

	return c.JSON(fiber.Map{"tasks": result})
}

type UpdateTaskReq struct {
	Name         *string   `json:"name"`
	Description  *string   `json:"description"`
	StatusID     *string   `json:"statusId"`
	Priority     *string   `json:"priority"`
	Position     *float64  `json:"position"`
	StartDate    *string   `json:"startDate"`
	DueDate      *string   `json:"dueDate"`
	TimeEstimate *int32    `json:"timeEstimate"`
	Archived     *bool     `json:"archived"`
	Recurrence   *string   `json:"recurrence"`
	AssigneeIDs  *[]string `json:"assigneeIds"`
	TagIDs       *[]string `json:"tagIds"`
	WatcherIDs   *[]string `json:"watcherIds"`
}

func (h *TasksHandler) UpdateTask(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	ctx := c.Context()

	var req UpdateTaskReq
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	existing, err := h.q.GetTaskByID(ctx, taskID)
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "Task not found")
	}

	name := existing.Name
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		name = strings.TrimSpace(*req.Name)
		if name != existing.Name {
			data, _ := json.Marshal(fiber.Map{"name": name})
			_, _ = h.q.CreateActivity(ctx, db.CreateActivityParams{
				ID:     cuid(),
				TaskId: taskID,
				UserId: pgtype.Text{String: user.UserId, Valid: true},
				Type:   "renamed",
				Data:   data,
			})
		}
	}

	desc := existing.Description
	if req.Description != nil {
		desc = stringPtrToText(req.Description)
	}

	statusID := existing.StatusId
	var completedAt pgtype.Timestamp = existing.CompletedAt
	if req.StatusID != nil && *req.StatusID != existing.StatusId {
		statusID = *req.StatusID
		st, _ := h.q.GetStatusByID(ctx, statusID)
		if st.Type == db.StatusTypeDONE {
			completedAt = pgtype.Timestamp{Time: time.Now(), Valid: true}
		} else {
			completedAt = pgtype.Timestamp{Valid: false}
		}

		data, _ := json.Marshal(fiber.Map{"from": existing.StatusName, "to": st.Name})
		_, _ = h.q.CreateActivity(ctx, db.CreateActivityParams{
			ID:     cuid(),
			TaskId: taskID,
			UserId: pgtype.Text{String: user.UserId, Valid: true},
			Type:   "status_changed",
			Data:   data,
		})
	}

	var prio db.NullPriority = existing.Priority
	if req.Priority != nil {
		if *req.Priority != "" {
			prio = db.NullPriority{Priority: db.Priority(*req.Priority), Valid: true}
		} else {
			prio = db.NullPriority{Valid: false}
		}
		data, _ := json.Marshal(fiber.Map{"priority": *req.Priority})
		_, _ = h.q.CreateActivity(ctx, db.CreateActivityParams{
			ID:     cuid(),
			TaskId: taskID,
			UserId: pgtype.Text{String: user.UserId, Valid: true},
			Type:   "priority_changed",
			Data:   data,
		})
	}

	pos := existing.Position
	if req.Position != nil {
		pos = *req.Position
	}

	var start pgtype.Timestamp = existing.StartDate
	if req.StartDate != nil {
		if *req.StartDate != "" {
			if t, err := time.Parse(time.RFC3339, *req.StartDate); err == nil {
				start = pgtype.Timestamp{Time: t, Valid: true}
			}
		} else {
			start = pgtype.Timestamp{Valid: false}
		}
	}

	var due pgtype.Timestamp = existing.DueDate
	if req.DueDate != nil {
		if *req.DueDate != "" {
			if t, err := time.Parse(time.RFC3339, *req.DueDate); err == nil {
				due = pgtype.Timestamp{Time: t, Valid: true}
			}
		} else {
			due = pgtype.Timestamp{Valid: false}
		}
	}

	var est pgtype.Int4 = existing.TimeEstimate
	if req.TimeEstimate != nil {
		est = pgtype.Int4{Int32: *req.TimeEstimate, Valid: true}
	}

	arch := existing.Archived
	if req.Archived != nil {
		arch = *req.Archived
	}

	rec := existing.Recurrence
	if req.Recurrence != nil {
		rec = stringPtrToText(req.Recurrence)
	}

	task, err := h.q.UpdateTask(ctx, db.UpdateTaskParams{
		ID:           taskID,
		Name:         name,
		Description:  desc,
		Priority:     prio,
		StatusId:     statusID,
		Position:     pos,
		StartDate:    start,
		DueDate:      due,
		TimeEstimate: est,
		CompletedAt:  completedAt,
		Archived:     arch,
		Recurrence:   rec,
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	// Assignees full replacement if provided
	if req.AssigneeIDs != nil {
		_, _ = h.pool.Exec(ctx, `DELETE FROM "TaskAssignee" WHERE "taskId" = $1`, taskID)
		for _, uid := range *req.AssigneeIDs {
			_, _ = h.q.AddTaskAssignee(ctx, db.AddTaskAssigneeParams{
				TaskId: taskID,
				UserId: uid,
			})
		}
	}

	// Tags full replacement if provided
	if req.TagIDs != nil {
		_, _ = h.pool.Exec(ctx, `DELETE FROM "TaskTag" WHERE "taskId" = $1`, taskID)
		for _, tid := range *req.TagIDs {
			_, _ = h.q.AddTaskTag(ctx, db.AddTaskTagParams{
				TaskId: taskID,
				TagId:  tid,
			})
		}
	}

	// Watchers full replacement if provided
	if req.WatcherIDs != nil {
		_, _ = h.pool.Exec(ctx, `DELETE FROM "TaskWatcher" WHERE "taskId" = $1`, taskID)
		for _, uid := range *req.WatcherIDs {
			_, _ = h.pool.Exec(ctx, `INSERT INTO "TaskWatcher" ("taskId", "userId") VALUES ($1, $2) ON CONFLICT DO NOTHING`, taskID, uid)
		}
	}

	realtime.DefaultHub.Broadcast(realtime.Event{
		Type:   "list",
		ListID: task.ListId,
	})

	if formatted, err := h.getFormattedTask(ctx, task.ID); err == nil {
		return c.JSON(formatted)
	}

	return c.JSON(task)
}

func (h *TasksHandler) DeleteTask(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	ctx := c.Context()

	task, err := h.q.GetTaskByID(ctx, taskID)
	if err == nil {
		_ = h.q.DeleteTask(ctx, taskID)
		realtime.DefaultHub.Broadcast(realtime.Event{
			Type:   "list",
			ListID: task.ListId,
		})
	}

	return c.JSON(dto.OKResponse{OK: true})
}

// ---------------- Bulk Operations ----------------

type BulkTasksReq struct {
	IDs    []string `json:"ids"`
	Delete *bool    `json:"delete"`
	Patch  *struct {
		StatusID    *string  `json:"statusId"`
		Priority    *string  `json:"priority"`
		AssigneeIDs []string `json:"assigneeIds"`
	} `json:"patch"`
}

func (h *TasksHandler) BulkTasks(c *fiber.Ctx) error {
	var req BulkTasksReq
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	if len(req.IDs) == 0 {
		return sendError(c, fiber.StatusBadRequest, "ids are required")
	}

	ctx := c.Context()

	// Find distinct listIds to notify
	rows, err := h.pool.Query(ctx, `SELECT DISTINCT "listId" FROM "Task" WHERE id = ANY($1)`, req.IDs)
	var listIDs []string
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var lid string
			if err := rows.Scan(&lid); err == nil {
				listIDs = append(listIDs, lid)
			}
		}
	}

	if req.Delete != nil && *req.Delete {
		for _, id := range req.IDs {
			_ = h.q.DeleteTask(ctx, id)
		}
	} else if req.Patch != nil {
		if req.Patch.StatusID != nil {
			var completedAt interface{} = nil
			st, err := h.q.GetStatusByID(ctx, *req.Patch.StatusID)
			if err == nil && st.Type == db.StatusTypeDONE {
				completedAt = time.Now()
			}
			_, _ = h.pool.Exec(ctx, `UPDATE "Task" SET "statusId" = $1, "completedAt" = $2, "updatedAt" = NOW() WHERE id = ANY($3)`, *req.Patch.StatusID, completedAt, req.IDs)
		}
		if req.Patch.Priority != nil {
			if *req.Patch.Priority != "" {
				_, _ = h.pool.Exec(ctx, `UPDATE "Task" SET priority = $1, "updatedAt" = NOW() WHERE id = ANY($2)`, *req.Patch.Priority, req.IDs)
			} else {
				_, _ = h.pool.Exec(ctx, `UPDATE "Task" SET priority = NULL, "updatedAt" = NOW() WHERE id = ANY($1)`, req.IDs)
			}
		}
		if len(req.Patch.AssigneeIDs) > 0 {
			_, _ = h.pool.Exec(ctx, `DELETE FROM "TaskAssignee" WHERE "taskId" = ANY($1)`, req.IDs)
			for _, tid := range req.IDs {
				for _, uid := range req.Patch.AssigneeIDs {
					_, _ = h.q.AddTaskAssignee(ctx, db.AddTaskAssigneeParams{
						TaskId: tid,
						UserId: uid,
					})
				}
			}
		}
	}

	for _, lid := range listIDs {
		realtime.DefaultHub.Broadcast(realtime.Event{
			Type:   "list",
			ListID: lid,
		})
	}

	count := len(req.IDs)
	return c.JSON(dto.OKResponse{OK: true, Count: &count})
}
