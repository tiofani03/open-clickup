package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"open-clickup-server/internal/db"
)

type StatusesHandler struct {
	q *db.Queries
}

func NewStatusesHandler(q *db.Queries) *StatusesHandler {
	return &StatusesHandler{q: q}
}

type UpdateStatusReq struct {
	Name     string         `json:"name"`
	Color    string         `json:"color"`
	Type     *db.StatusType `json:"type"`
	Position *float64       `json:"position"`
	WipLimit *int32         `json:"wipLimit"`
}

func (h *StatusesHandler) UpdateStatus(c *fiber.Ctx) error {
	statusID := c.Params("statusId")
	var req UpdateStatusReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var st db.StatusType
	if req.Type != nil {
		st = *req.Type
	}
	var pos float64
	if req.Position != nil {
		pos = *req.Position
	}
	var wip pgtype.Int4
	if req.WipLimit != nil {
		wip = pgtype.Int4{Int32: *req.WipLimit, Valid: true}
	}

	status, err := h.q.UpdateStatus(c.Context(), db.UpdateStatusParams{
		ID:       statusID,
		Name:     req.Name,
		Color:    req.Color,
		Type:     st,
		Position: pos,
		WipLimit: wip,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Status not found"})
	}

	return c.JSON(status)
}

func (h *StatusesHandler) DeleteStatus(c *fiber.Ctx) error {
	statusID := c.Params("statusId")
	if err := h.q.DeleteStatus(c.Context(), statusID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}
