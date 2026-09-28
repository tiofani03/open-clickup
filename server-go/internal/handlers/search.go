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

type SearchTaskItem struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ListID   string `json:"listId"`
	ListName string `json:"listName"`
	Kind     string `json:"kind"`
}

type SearchListItem struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	SpaceName string `json:"spaceName"`
	Kind      string `json:"kind"`
}

type SearchResponse struct {
	Tasks  []SearchTaskItem `json:"tasks"`
	Lists  []SearchListItem `json:"lists"`
	Spaces []interface{}    `json:"spaces"`
}

func (h *SearchHandler) Search(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		return c.JSON(SearchResponse{
			Tasks:  []SearchTaskItem{},
			Lists:  []SearchListItem{},
			Spaces: []interface{}{},
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
	tasks := []SearchTaskItem{}
	if err == nil {
		defer taskRows.Close()
		for taskRows.Next() {
			var id, name, listId, listName string
			if err := taskRows.Scan(&id, &name, &listId, &listName); err == nil {
				tasks = append(tasks, SearchTaskItem{
					ID:       id,
					Name:     name,
					ListID:   listId,
					ListName: listName,
					Kind:     "task",
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
	lists := []SearchListItem{}
	if err == nil {
		defer listRows.Close()
		for listRows.Next() {
			var id, name, spaceName string
			if err := listRows.Scan(&id, &name, &spaceName); err == nil {
				lists = append(lists, SearchListItem{
					ID:        id,
					Name:      name,
					SpaceName: spaceName,
					Kind:      "list",
				})
			}
		}
	}

	return c.JSON(SearchResponse{
		Tasks:  tasks,
		Lists:  lists,
		Spaces: []interface{}{},
	})
}
