package handlers

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/dto"
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
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	configBytes, err := json.Marshal(req.Config)
	if err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid config JSON")
	}

	view, err := h.q.UpdateViewConfig(c.Context(), db.UpdateViewConfigParams{
		ID:     viewID,
		Config: configBytes,
	})
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "View not found")
	}

	return c.JSON(dto.ViewResponse{
		ID:       view.ID,
		ListID:   view.ListId,
		Name:     view.Name,
		Type:     string(view.Type),
		Position: view.Position,
		Config:   view.Config,
	})
}
