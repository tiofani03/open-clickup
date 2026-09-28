package handlers

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"

	"open-clickup-server/internal/db"
)

type ViewsHandler struct {
	q *db.Queries
}

func NewViewsHandler(q *db.Queries) *ViewsHandler {
	return &ViewsHandler{q: q}
}

type UpdateViewReq struct {
	Config interface{} `json:"config"`
}

func (h *ViewsHandler) UpdateViewConfig(c *fiber.Ctx) error {
	viewID := c.Params("viewId")
	var req UpdateViewReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	configBytes, err := json.Marshal(req.Config)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid config JSON"})
	}

	view, err := h.q.UpdateViewConfig(c.Context(), db.UpdateViewConfigParams{
		ID:     viewID,
		Config: configBytes,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "View not found"})
	}

	return c.JSON(view)
}
