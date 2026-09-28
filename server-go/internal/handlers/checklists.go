package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/realtime"
)

type ChecklistsHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewChecklistsHandler(pool *pgxpool.Pool, q *db.Queries) *ChecklistsHandler {
	return &ChecklistsHandler{pool: pool, q: q}
}

func (h *ChecklistsHandler) CreateChecklist(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	ctx := c.Context()
	var req struct {
		Name *string `json:"name"`
	}
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	task, err := h.q.GetTaskByID(ctx, taskID)
	if err == nil {
		realtime.DefaultHub.Broadcast(realtime.Event{
			Type:   "list",
			ListID: task.ListId,
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":       checklist.ID,
		"taskId":   checklist.TaskId,
		"name":     checklist.Name,
		"position": checklist.Position,
		"items":    []interface{}{},
	})
}

func (h *ChecklistsHandler) UpdateChecklist(c *fiber.Ctx) error {
	checklistID := c.Params("checklistId")
	ctx := c.Context()
	var req struct {
		Name     *string  `json:"name"`
		Position *float64 `json:"position"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var curName string
	var curPos float64
	var taskID string
	row := h.pool.QueryRow(ctx, `SELECT name, position, "taskId" FROM "Checklist" WHERE id = $1`, checklistID)
	if err := row.Scan(&curName, &curPos, &taskID); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Checklist not found"})
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	task, err := h.q.GetTaskByID(ctx, taskID)
	if err == nil {
		realtime.DefaultHub.Broadcast(realtime.Event{
			Type:   "list",
			ListID: task.ListId,
		})
	}

	return c.JSON(cl)
}

func (h *ChecklistsHandler) DeleteChecklist(c *fiber.Ctx) error {
	checklistID := c.Params("checklistId")
	ctx := c.Context()

	var taskID string
	row := h.pool.QueryRow(ctx, `SELECT "taskId" FROM "Checklist" WHERE id = $1`, checklistID)
	_ = row.Scan(&taskID)

	if err := h.q.DeleteChecklist(ctx, checklistID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
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

	return c.JSON(fiber.Map{"ok": true})
}

// ---------------- Checklist Items ----------------

func (h *ChecklistsHandler) CreateItem(c *fiber.Ctx) error {
	checklistID := c.Params("checklistId")
	ctx := c.Context()
	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
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

	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *ChecklistsHandler) UpdateItem(c *fiber.Ctx) error {
	itemID := c.Params("itemId")
	ctx := c.Context()
	var req struct {
		Name     *string  `json:"name"`
		Resolved *bool    `json:"resolved"`
		Position *float64 `json:"position"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var curName string
	var curResolved bool
	var curPos float64
	var checklistID string
	row := h.pool.QueryRow(ctx, `SELECT name, resolved, position, "checklistId" FROM "ChecklistItem" WHERE id = $1`, itemID)
	if err := row.Scan(&curName, &curResolved, &curPos, &checklistID); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Checklist item not found"})
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
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

	return c.JSON(item)
}

func (h *ChecklistsHandler) DeleteItem(c *fiber.Ctx) error {
	itemID := c.Params("itemId")
	ctx := c.Context()

	var checklistID string
	row := h.pool.QueryRow(ctx, `SELECT "checklistId" FROM "ChecklistItem" WHERE id = $1`, itemID)
	_ = row.Scan(&checklistID)

	if err := h.q.DeleteChecklistItem(ctx, itemID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
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

	return c.JSON(fiber.Map{"ok": true})
}
