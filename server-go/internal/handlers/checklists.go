package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"open-clickup-server/internal/db"
)

type ChecklistsHandler struct {
	q *db.Queries
}

func NewChecklistsHandler(q *db.Queries) *ChecklistsHandler {
	return &ChecklistsHandler{q: q}
}

func (h *ChecklistsHandler) CreateChecklist(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	var req struct {
		Name *string `json:"name"`
	}
	_ = c.BodyParser(&req)

	name := "Checklist"
	if req.Name != nil && *req.Name != "" {
		name = *req.Name
	}

	checklist, err := h.q.CreateChecklist(c.Context(), db.CreateChecklistParams{
		ID:       cuid(),
		TaskId:   taskID,
		Name:     name,
		Position: 1000,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(checklist)
}

func (h *ChecklistsHandler) UpdateChecklist(c *fiber.Ctx) error {
	checklistID := c.Params("checklistId")
	var req struct {
		Name     string   `json:"name"`
		Position *float64 `json:"position"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var pos float64
	if req.Position != nil {
		pos = *req.Position
	}

	cl, err := h.q.UpdateChecklist(c.Context(), db.UpdateChecklistParams{
		ID:       checklistID,
		Name:     req.Name,
		Position: pos,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Checklist not found"})
	}

	return c.JSON(cl)
}

func (h *ChecklistsHandler) DeleteChecklist(c *fiber.Ctx) error {
	checklistID := c.Params("checklistId")
	if err := h.q.DeleteChecklist(c.Context(), checklistID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ---------------- Checklist Items ----------------

func (h *ChecklistsHandler) CreateItem(c *fiber.Ctx) error {
	checklistID := c.Params("checklistId")
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

	item, err := h.q.CreateChecklistItem(c.Context(), db.CreateChecklistItemParams{
		ID:          cuid(),
		ChecklistId: checklistID,
		Name:        req.Name,
		Resolved:    false,
		Position:    1000,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *ChecklistsHandler) UpdateItem(c *fiber.Ctx) error {
	itemID := c.Params("itemId")
	var req struct {
		Name     string   `json:"name"`
		Resolved *bool    `json:"resolved"`
		Position *float64 `json:"position"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var res bool
	if req.Resolved != nil {
		res = *req.Resolved
	}
	var pos float64
	if req.Position != nil {
		pos = *req.Position
	}

	item, err := h.q.UpdateChecklistItem(c.Context(), db.UpdateChecklistItemParams{
		ID:       itemID,
		Name:     req.Name,
		Resolved: res,
		Position: pos,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Checklist item not found"})
	}

	return c.JSON(item)
}

func (h *ChecklistsHandler) DeleteItem(c *fiber.Ctx) error {
	itemID := c.Params("itemId")
	if err := h.q.DeleteChecklistItem(c.Context(), itemID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}
