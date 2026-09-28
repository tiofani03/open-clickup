package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HealthResponse struct {
	Status string `json:"status"`
	DB     bool   `json:"db"`
}

func HealthHandler(pool *pgxpool.Pool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		err := pool.Ping(c.Context())
		if err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(HealthResponse{
				Status: "degraded",
				DB:     false,
			})
		}
		return c.JSON(HealthResponse{
			Status: "ok",
			DB:     true,
		})
	}
}
