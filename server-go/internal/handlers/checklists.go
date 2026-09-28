package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/dto"
	"open-clickup-server/internal/realtime"
)

type ChecklistsHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewChecklistsHandler(pool *pgxpool.Pool, q *db.Queries) *ChecklistsHandler {
	return &ChecklistsHandler{pool: pool, q: q}
}

type CreateChecklistReq struct {
	Name *string `json:"name"`
}

func (h *ChecklistsHandler) CreateChecklist(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	ctx := c.Context()
	var req CreateChecklistReq
	_ = c.BodyParser(&req)

	name := "Checklist"
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		name = strings.TrimSpace(*req.Name)
	}

	var lastPos float64
	row := h.pool.QueryRow(ctx, `SELECT position FROM "Checklist" WHERE "taskId" = $1 ORDER BY position DESC LIMIT 1`, taskID)
	_ = row.Scan(&lastPos)

	checklist, err := h.q.CreateChecklist(ctx, db.CreateChecklistParams{
		ID:       cuid(),
		TaskId:   taskID,
		Name:     name,
		Position: lastPos + 1000,
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	task, err := h.q.GetTaskByID(ctx, taskID)
	if err == nil {
		realtime.DefaultHub.Broadcast(realtime.Event{
			Type:   "list",
			ListID: task.ListId,
		})
	}

	return c.Status(fiber.StatusCreated).JSON(dto.ChecklistResponse{
		ID:       checklist.ID,
		TaskID:   checklist.TaskId,
		Name:     checklist.Name,
		Position: checklist.Position,
		Items:    []dto.ChecklistItemResponse{},
	})
}

type UpdateChecklistReq struct {
	Name     *string  `json:"name"`
	Position *float64 `json:"position"`
}

func (h *ChecklistsHandler) UpdateChecklist(c *fiber.Ctx) error {
	checklistID := c.Params("checklistId")
	ctx := c.Context()
	var req UpdateChecklistReq
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	var curName string
	var curPos float64
	var taskID string
	row := h.pool.QueryRow(ctx, `SELECT name, position, "taskId" FROM "Checklist" WHERE id = $1`, checklistID)
	if err := row.Scan(&curName, &curPos, &taskID); err != nil {
		return sendError(c, fiber.StatusNotFound, "Checklist not found")
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		curName = strings.TrimSpace(*req.Name)
	}
	if req.Position != nil {
		curPos = *req.Position
	}

	cl, err := h.q.UpdateChecklist(ctx, db.UpdateChecklistParams{
		ID:       checklistID,
		Name:     curName,
		Position: curPos,
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	task, err := h.q.GetTaskByID(ctx, taskID)
	if err == nil {
		realtime.DefaultHub.Broadcast(realtime.Event{
			Type:   "list",
			ListID: task.ListId,
		})
	}

	// Fetch items
	itemsRows, _ := h.q.ListChecklistItems(ctx, cl.ID)
	items := make([]dto.ChecklistItemResponse, len(itemsRows))
	for i, item := range itemsRows {
		items[i] = dto.ChecklistItemResponse{
			ID:          item.ID,
			ChecklistID: item.ChecklistId,
			Name:        item.Name,
			Resolved:    item.Resolved,
			Position:    item.Position,
		}
	}

	return c.JSON(dto.ChecklistResponse{
		ID:       cl.ID,
		TaskID:   cl.TaskId,
		Name:     cl.Name,
		Position: cl.Position,
		Items:    items,
	})
}

func (h *ChecklistsHandler) DeleteChecklist(c *fiber.Ctx) error {
	checklistID := c.Params("checklistId")
	ctx := c.Context()

	var taskID string
	row := h.pool.QueryRow(ctx, `SELECT "taskId" FROM "Checklist" WHERE id = $1`, checklistID)
	_ = row.Scan(&taskID)

	if err := h.q.DeleteChecklist(ctx, checklistID); err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	if taskID != "" {
		task, err := h.q.GetTaskByID(ctx, taskID)
		if err == nil {
			realtime.DefaultHub.Broadcast(realtime.Event{
				Type:   "list",
				ListID: task.ListId,
			})
		}
	}

	return c.JSON(dto.OKResponse{OK: true})
}

// ---------------- Checklist Items ----------------

type CreateItemReq struct {
	Name string `json:"name"`
}

func (h *ChecklistsHandler) CreateItem(c *fiber.Ctx) error {
	checklistID := c.Params("checklistId")
	ctx := c.Context()
	var req CreateItemReq
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return sendError(c, fiber.StatusBadRequest, "name is required")
	}

	var lastPos float64
	var taskID string
	row := h.pool.QueryRow(ctx, `SELECT "taskId" FROM "Checklist" WHERE id = $1`, checklistID)
	_ = row.Scan(&taskID)

	row = h.pool.QueryRow(ctx, `SELECT position FROM "ChecklistItem" WHERE "checklistId" = $1 ORDER BY position DESC LIMIT 1`, checklistID)
	_ = row.Scan(&lastPos)

	item, err := h.q.CreateChecklistItem(ctx, db.CreateChecklistItemParams{
		ID:          cuid(),
		ChecklistId: checklistID,
		Name:        req.Name,
		Resolved:    false,
		Position:    lastPos + 1000,
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	if taskID != "" {
		task, err := h.q.GetTaskByID(ctx, taskID)
		if err == nil {
			realtime.DefaultHub.Broadcast(realtime.Event{
				Type:   "list",
				ListID: task.ListId,
			})
		}
	}

	return c.Status(fiber.StatusCreated).JSON(dto.ChecklistItemResponse{
		ID:          item.ID,
		ChecklistID: item.ChecklistId,
		Name:        item.Name,
		Resolved:    item.Resolved,
		Position:    item.Position,
	})
}

type UpdateItemReq struct {
	Name     *string  `json:"name"`
	Resolved *bool    `json:"resolved"`
	Position *float64 `json:"position"`
}

func (h *ChecklistsHandler) UpdateItem(c *fiber.Ctx) error {
	itemID := c.Params("itemId")
	ctx := c.Context()
	var req UpdateItemReq
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	var curName string
	var curResolved bool
	var curPos float64
	var checklistID string
	row := h.pool.QueryRow(ctx, `SELECT name, resolved, position, "checklistId" FROM "ChecklistItem" WHERE id = $1`, itemID)
	if err := row.Scan(&curName, &curResolved, &curPos, &checklistID); err != nil {
		return sendError(c, fiber.StatusNotFound, "Checklist item not found")
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		curName = strings.TrimSpace(*req.Name)
	}
	if req.Resolved != nil {
		curResolved = *req.Resolved
	}
	if req.Position != nil {
		curPos = *req.Position
	}

	item, err := h.q.UpdateChecklistItem(ctx, db.UpdateChecklistItemParams{
		ID:       itemID,
		Name:     curName,
		Resolved: curResolved,
		Position: curPos,
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	var taskID string
	row = h.pool.QueryRow(ctx, `SELECT "taskId" FROM "Checklist" WHERE id = $1`, checklistID)
	_ = row.Scan(&taskID)
	if taskID != "" {
		task, err := h.q.GetTaskByID(ctx, taskID)
		if err == nil {
			realtime.DefaultHub.Broadcast(realtime.Event{
				Type:   "list",
				ListID: task.ListId,
			})
		}
	}

	return c.JSON(dto.ChecklistItemResponse{
		ID:          item.ID,
		ChecklistID: item.ChecklistId,
		Name:        item.Name,
		Resolved:    item.Resolved,
		Position:    item.Position,
	})
}

func (h *ChecklistsHandler) DeleteItem(c *fiber.Ctx) error {
	itemID := c.Params("itemId")
	ctx := c.Context()

	var checklistID string
	row := h.pool.QueryRow(ctx, `SELECT "checklistId" FROM "ChecklistItem" WHERE id = $1`, itemID)
	_ = row.Scan(&checklistID)

	if err := h.q.DeleteChecklistItem(ctx, itemID); err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	if checklistID != "" {
		var taskID string
		row = h.pool.QueryRow(ctx, `SELECT "taskId" FROM "Checklist" WHERE id = $1`, checklistID)
		_ = row.Scan(&taskID)
		if taskID != "" {
			task, err := h.q.GetTaskByID(ctx, taskID)
			if err == nil {
				realtime.DefaultHub.Broadcast(realtime.Event{
					Type:   "list",
					ListID: task.ListId,
				})
			}
		}
	}

	return c.JSON(dto.OKResponse{OK: true})
}
