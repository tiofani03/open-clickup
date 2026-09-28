package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SearchHandler struct {
	pool *pgxpool.Pool
}

func NewSearchHandler(pool *pgxpool.Pool) *SearchHandler {
	return &SearchHandler{pool: pool}
}

func (h *SearchHandler) Search(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		return c.JSON(fiber.Map{
			"tasks":  []interface{}{},
			"lists":  []interface{}{},
			"spaces": []interface{}{},
		})
	}

	pattern := "%" + q + "%"
	ctx := c.Context()

	// Tasks
	taskRows, err := h.pool.Query(ctx, `
		SELECT t.id, t.name, t."listId", l.name as list_name
		FROM "Task" t
		JOIN "List" l ON t."listId" = l.id
		WHERE t.name ILIKE $1 AND t.archived = false
		LIMIT 10
	`, pattern)
	tasks := []interface{}{}
	if err == nil {
		defer taskRows.Close()
		for taskRows.Next() {
			var id, name, listId, listName string
			if err := taskRows.Scan(&id, &name, &listId, &listName); err == nil {
				tasks = append(tasks, fiber.Map{
					"id":       id,
					"name":     name,
					"listId":   listId,
					"listName": listName,
					"kind":     "task",
				})
			}
		}
	}

	// Lists
	listRows, err := h.pool.Query(ctx, `
		SELECT l.id, l.name, s.name as space_name
		FROM "List" l
		JOIN "Space" s ON l."spaceId" = s.id
		WHERE l.name ILIKE $1
		LIMIT 10
	`, pattern)
	lists := []interface{}{}
	if err == nil {
		defer listRows.Close()
		for listRows.Next() {
			var id, name, spaceName string
			if err := listRows.Scan(&id, &name, &spaceName); err == nil {
				lists = append(lists, fiber.Map{
					"id":        id,
					"name":      name,
					"spaceName": spaceName,
					"kind":      "list",
				})
			}
		}
	}

	return c.JSON(fiber.Map{
		"tasks":  tasks,
		"lists":  lists,
		"spaces": []interface{}{},
	})
}
