package handlers

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"open-clickup-server/internal/db"
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

func (h *TasksHandler) CreateTask(c *fiber.Ctx) error {
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	var req CreateTaskReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || req.ListID == "" || req.StatusID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name, listId, and statusId are required"})
	}

	ctx := c.Context()
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
		ParentId:     pgtype.Text{String: *req.ParentID, Valid: req.ParentID != nil},
		Name:         req.Name,
		Description:  pgtype.Text{String: *req.Description, Valid: req.Description != nil},
		Priority:     prio,
		Position:     lastPos + 1000,
		StartDate:    startDate,
		DueDate:      dueDate,
		TimeEstimate: est,
		CreatedById:  pgtype.Text{String: user.UserId, Valid: true},
		Recurrence:   pgtype.Text{Valid: false},
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
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
		Type:    "task:created",
		Payload: fiber.Map{"taskId": task.ID, "listId": task.ListId},
	})

	return c.Status(fiber.StatusCreated).JSON(task)
}

func (h *TasksHandler) GetTask(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	ctx := c.Context()

	task, err := h.q.GetTaskByID(ctx, taskID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	assignees, _ := h.q.ListTaskAssignees(ctx, taskID)
	assigneeList := make([]interface{}, len(assignees))
	for ai, a := range assignees {
		assigneeList[ai] = fiber.Map{
			"userId": a.UserId,
			"user": fiber.Map{
				"id":        a.UserId,
				"name":      a.UserName,
				"email":     a.UserEmail,
				"color":     a.UserColor,
				"avatarUrl": textOrNil(a.UserAvatarUrl),
			},
		}
	}

	tags, _ := h.q.ListTaskTags(ctx, taskID)
	tagList := make([]interface{}, len(tags))
	for ti, tg := range tags {
		tagList[ti] = fiber.Map{
			"tagId": tg.TagId,
			"tag": fiber.Map{
				"id":    tg.TagId,
				"name":  tg.TagName,
				"color": tg.TagColor,
			},
		}
	}

	subtasks, _ := h.q.ListSubtasksByParent(ctx, pgtype.Text{String: taskID, Valid: true})
	subtaskList := make([]interface{}, len(subtasks))
	for si, sub := range subtasks {
		subtaskList[si] = fiber.Map{
			"id":       sub.ID,
			"name":     sub.Name,
			"statusId": sub.StatusId,
			"position": sub.Position,
			"status": fiber.Map{
				"id":    sub.StatusId,
				"name":  sub.StatusName,
				"color": sub.StatusColor,
				"type":  string(sub.StatusType),
			},
		}
	}

	checklists, _ := h.q.ListChecklistsByTask(ctx, taskID)
	checklistList := make([]interface{}, len(checklists))
	for ci, ch := range checklists {
		items, _ := h.q.ListChecklistItems(ctx, ch.ID)
		itemList := make([]interface{}, len(items))
		for ii, it := range items {
			itemList[ii] = fiber.Map{
				"id":          it.ID,
				"checklistId": it.ChecklistId,
				"name":        it.Name,
				"resolved":    it.Resolved,
				"position":    it.Position,
			}
		}
		checklistList[ci] = fiber.Map{
			"id":       ch.ID,
			"name":     ch.Name,
			"position": ch.Position,
			"items":    itemList,
		}
	}

	comments, _ := h.q.ListCommentsByTask(ctx, taskID)
	commentList := make([]interface{}, len(comments))
	for ci, cm := range comments {
		reactions, _ := h.q.ListReactionsByComment(ctx, cm.ID)
		reactionList := make([]interface{}, len(reactions))
		for ri, r := range reactions {
			reactionList[ri] = fiber.Map{
				"id":        r.ID,
				"commentId": r.CommentId,
				"userId":    r.UserId,
				"emoji":     r.Emoji,
				"user":      fiber.Map{"name": r.UserName},
			}
		}
		commentList[ci] = fiber.Map{
			"id":        cm.ID,
			"taskId":    cm.TaskId,
			"userId":    cm.UserId,
			"body":      cm.Body,
			"parentId":  textOrNil(cm.ParentId),
			"resolved":  cm.Resolved,
			"createdAt": cm.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			"updatedAt": cm.UpdatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			"user": fiber.Map{
				"id":        cm.UserId,
				"name":      cm.UserName,
				"email":     cm.UserEmail,
				"color":     cm.UserColor,
				"avatarUrl": textOrNil(cm.UserAvatarUrl),
			},
			"reactions": reactionList,
		}
	}

	activities, _ := h.q.ListActivitiesByTask(ctx, taskID)
	activityList := make([]interface{}, len(activities))
	for ai, a := range activities {
		var actData interface{}
		_ = json.Unmarshal(a.Data, &actData)
		activityList[ai] = fiber.Map{
			"id":        a.ID,
			"taskId":    a.TaskId,
			"userId":    a.UserId,
			"type":      a.Type,
			"data":      actData,
			"createdAt": a.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			"user": fiber.Map{
				"name":      a.UserName,
				"color":     a.UserColor,
				"avatarUrl": textOrNil(a.UserAvatarUrl),
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

	return c.JSON(fiber.Map{
		"id":           task.ID,
		"listId":       task.ListId,
		"statusId":     task.StatusId,
		"parentId":     textOrNil(task.ParentId),
		"name":         task.Name,
		"description":  textOrNil(task.Description),
		"priority":     priority,
		"position":     task.Position,
		"startDate":    startStr,
		"dueDate":      dueStr,
		"timeEstimate": est,
		"createdById":  textOrNil(task.CreatedById),
		"createdAt":    task.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		"updatedAt":    task.UpdatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		"completedAt":  compStr,
		"archived":     task.Archived,
		"recurrence":   textOrNil(task.Recurrence),
		"status": fiber.Map{
			"id":    task.StatusId,
			"name":  task.StatusName,
			"color": task.StatusColor,
			"type":  string(task.StatusType),
		},
		"list": fiber.Map{
			"id":   task.ListId,
			"name": task.ListName,
		},
		"space": fiber.Map{
			"id":   task.SpaceID,
			"name": task.SpaceName,
		},
		"assignees":   assigneeList,
		"tags":        tagList,
		"subtasks":    subtaskList,
		"checklists":  checklistList,
		"comments":    commentList,
		"activities":  activityList,
		"attachments": []interface{}{},
		"timeEntries": []interface{}{},
		"blockedBy":   []interface{}{},
		"blocking":    []interface{}{},
	})
}

type UpdateTaskReq struct {
	Name         string   `json:"name"`
	Description  *string  `json:"description"`
	StatusID     *string  `json:"statusId"`
	Priority     *string  `json:"priority"`
	Position     *float64 `json:"position"`
	StartDate    *string  `json:"startDate"`
	DueDate      *string  `json:"dueDate"`
	TimeEstimate *int32   `json:"timeEstimate"`
	Archived     *bool    `json:"archived"`
	Recurrence   *string  `json:"recurrence"`
}

func (h *TasksHandler) UpdateTask(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	ctx := c.Context()

	var req UpdateTaskReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	existing, err := h.q.GetTaskByID(ctx, taskID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	statusID := existing.StatusId
	var completedAt pgtype.Timestamp
	if req.StatusID != nil && *req.StatusID != existing.StatusId {
		statusID = *req.StatusID
		// Check target status type
		st, _ := h.q.GetStatusByID(ctx, statusID)
		if st.Type == db.StatusTypeDONE {
			completedAt = pgtype.Timestamp{Time: time.Now(), Valid: true}
		}

		// Log status changed activity
		data, _ := json.Marshal(fiber.Map{"from": existing.StatusName, "to": st.Name})
		_, _ = h.q.CreateActivity(ctx, db.CreateActivityParams{
			ID:     cuid(),
			TaskId: taskID,
			UserId: pgtype.Text{String: user.UserId, Valid: true},
			Type:   "status_changed",
			Data:   data,
		})
	} else {
		completedAt = existing.CompletedAt
	}

	var prio db.NullPriority
	if req.Priority != nil {
		prio = db.NullPriority{Priority: db.Priority(*req.Priority), Valid: true}
	} else {
		prio = existing.Priority
	}

	pos := existing.Position
	if req.Position != nil {
		pos = *req.Position
	}

	var start pgtype.Timestamp = existing.StartDate
	if req.StartDate != nil {
		if t, err := time.Parse(time.RFC3339, *req.StartDate); err == nil {
			start = pgtype.Timestamp{Time: t, Valid: true}
		}
	}

	var due pgtype.Timestamp = existing.DueDate
	if req.DueDate != nil {
		if t, err := time.Parse(time.RFC3339, *req.DueDate); err == nil {
			due = pgtype.Timestamp{Time: t, Valid: true}
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

	task, err := h.q.UpdateTask(ctx, db.UpdateTaskParams{
		ID:           taskID,
		Name:         req.Name,
		Description:  pgtype.Text{String: *req.Description, Valid: req.Description != nil},
		Priority:     prio,
		StatusId:     statusID,
		Position:     pos,
		StartDate:    start,
		DueDate:      due,
		TimeEstimate: est,
		CompletedAt:  completedAt,
		Archived:     arch,
		Recurrence:   pgtype.Text{String: *req.Recurrence, Valid: req.Recurrence != nil},
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	realtime.DefaultHub.Broadcast(realtime.Event{
		Type:    "task:updated",
		Payload: fiber.Map{"taskId": task.ID, "listId": task.ListId},
	})

	return c.JSON(task)
}

func (h *TasksHandler) DeleteTask(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	ctx := c.Context()

	task, err := h.q.GetTaskByID(ctx, taskID)
	if err == nil {
		_ = h.q.DeleteTask(ctx, taskID)
		realtime.DefaultHub.Broadcast(realtime.Event{
			Type:    "task:deleted",
			Payload: fiber.Map{"taskId": taskID, "listId": task.ListId},
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}

// ---------------- Bulk Operations ----------------

type BulkTasksReq struct {
	TaskIDs  []string `json:"taskIds"`
	StatusID *string  `json:"statusId"`
	Priority *string  `json:"priority"`
	Delete   *bool    `json:"delete"`
}

func (h *TasksHandler) BulkTasks(c *fiber.Ctx) error {
	var req BulkTasksReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	ctx := c.Context()
	for _, id := range req.TaskIDs {
		if req.Delete != nil && *req.Delete {
			_ = h.q.DeleteTask(ctx, id)
		} else if req.StatusID != nil {
			_, _ = h.pool.Exec(ctx, `UPDATE "Task" SET "statusId" = $1, "updatedAt" = NOW() WHERE id = $2`, *req.StatusID, id)
		} else if req.Priority != nil {
			_, _ = h.pool.Exec(ctx, `UPDATE "Task" SET priority = $1, "updatedAt" = NOW() WHERE id = $2`, *req.Priority, id)
		}
	}

	realtime.DefaultHub.Broadcast(realtime.Event{
		Type:    "task:bulk_updated",
		Payload: fiber.Map{"taskIds": req.TaskIDs},
	})

	return c.JSON(fiber.Map{"ok": true})
}
