package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"open-clickup-server/internal/dto"
)

func cuid() string {
	return "c" + uuid.New().String()[:24]
}

func textOrNil(t pgtype.Text) *string {
	if t.Valid {
		return &t.String
	}
	return nil
}

func stringPtrToText(s *string) pgtype.Text {
	if s != nil {
		return pgtype.Text{String: *s, Valid: true}
	}
	return pgtype.Text{Valid: false}
}

func sendError(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(dto.ErrorResponse{Error: message})
}
