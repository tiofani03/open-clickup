package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/service"
)

type HierarchyHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewHierarchyHandler(pool *pgxpool.Pool, q *db.Queries) *HierarchyHandler {
	return &HierarchyHandler{pool: pool, q: q}
}

// ---------------- Spaces ----------------

type CreateSpaceReq struct {
	Name  string  `json:"name"`
	Color *string `json:"color"`
	Icon  *string `json:"icon"`
}

func (h *HierarchyHandler) CreateSpace(c *fiber.Ctx) error {
	var req CreateSpaceReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}

	ws, err := h.q.GetFirstWorkspace(c.Context())
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "No workspace found"})
	}

	color := "#7b68ee"
	if req.Color != nil && *req.Color != "" {
		color = *req.Color
	}

	space, err := h.q.CreateSpace(c.Context(), db.CreateSpaceParams{
		ID:          cuid(),
		WorkspaceId: ws.ID,
		Name:        req.Name,
		Color:       color,
		Icon:        pgtype.Text{String: *req.Icon, Valid: req.Icon != nil},
		Private:     false,
		Position:    1000,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(space)
}

func (h *HierarchyHandler) UpdateSpace(c *fiber.Ctx) error {
	spaceID := c.Params("spaceId")
	var req CreateSpaceReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	space, err := h.q.UpdateSpace(c.Context(), db.UpdateSpaceParams{
		ID:    spaceID,
		Name:  req.Name,
		Color: *req.Color,
		Icon:  pgtype.Text{String: *req.Icon, Valid: req.Icon != nil},
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Space not found"})
	}

	return c.JSON(space)
}

func (h *HierarchyHandler) DeleteSpace(c *fiber.Ctx) error {
	spaceID := c.Params("spaceId")
	if err := h.q.DeleteSpace(c.Context(), spaceID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ---------------- Folders ----------------

type CreateFolderReq struct {
	SpaceID string `json:"spaceId"`
	Name    string `json:"name"`
}

func (h *HierarchyHandler) CreateFolder(c *fiber.Ctx) error {
	var req CreateFolderReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || req.SpaceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name and spaceId are required"})
	}

	folder, err := h.q.CreateFolder(c.Context(), db.CreateFolderParams{
		ID:        cuid(),
		SpaceId:   req.SpaceID,
		Name:      req.Name,
		Position:  1000,
		Collapsed: false,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(folder)
}

func (h *HierarchyHandler) UpdateFolder(c *fiber.Ctx) error {
	folderID := c.Params("folderId")
	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	folder, err := h.q.UpdateFolder(c.Context(), db.UpdateFolderParams{
		ID:   folderID,
		Name: req.Name,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Folder not found"})
	}

	return c.JSON(folder)
}

func (h *HierarchyHandler) DeleteFolder(c *fiber.Ctx) error {
	folderID := c.Params("folderId")
	if err := h.q.DeleteFolder(c.Context(), folderID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ---------------- Lists ----------------

type CreateListReq struct {
	SpaceID  string  `json:"spaceId"`
	FolderID *string `json:"folderId"`
	Name     string  `json:"name"`
}

func (h *HierarchyHandler) CreateList(c *fiber.Ctx) error {
	var req CreateListReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || req.SpaceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name and spaceId are required"})
	}

	list, err := service.CreateListWithDefaults(c.Context(), h.pool, req.SpaceID, req.FolderID, req.Name)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(list)
}

func (h *HierarchyHandler) GetList(c *fiber.Ctx) error {
	listID := c.Params("listId")
	ctx := c.Context()

	l, err := h.q.GetListByID(ctx, listID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "List not found"})
	}

	statuses, _ := h.q.ListStatusesByList(ctx, listID)
	views, _ := h.q.ListViewsByList(ctx, listID)
	tasksRows, _ := h.q.ListTasksByList(ctx, listID)

	type StatusItem struct {
		ID       string  `json:"id"`
		ListID   string  `json:"listId"`
		Name     string  `json:"name"`
		Color    string  `json:"color"`
		Type     string  `json:"type"`
		Position float64 `json:"position"`
		WipLimit *int32  `json:"wipLimit"`
	}

	statusList := make([]StatusItem, len(statuses))
	for i, s := range statuses {
		var wip *int32
		if s.WipLimit.Valid {
			wip = &s.WipLimit.Int32
		}
		statusList[i] = StatusItem{
			ID:       s.ID,
			ListID:   s.ListId,
			Name:     s.Name,
			Color:    s.Color,
			Type:     string(s.Type),
			Position: s.Position,
			WipLimit: wip,
		}
	}

	type ViewItem struct {
		ID       string      `json:"id"`
		ListID   string      `json:"listId"`
		Name     string      `json:"name"`
		Type     string      `json:"type"`
		Position float64     `json:"position"`
		Config   interface{} `json:"config"`
	}

	viewList := make([]ViewItem, len(views))
	for i, v := range views {
		viewList[i] = ViewItem{
			ID:       v.ID,
			ListID:   v.ListId,
			Name:     v.Name,
			Type:     string(v.Type),
			Position: v.Position,
			Config:   v.Config,
		}
	}

	type TaskItem struct {
		ID           string        `json:"id"`
		ListID       string        `json:"listId"`
		StatusID     string        `json:"statusId"`
		ParentID     *string       `json:"parentId"`
		Name         string        `json:"name"`
		Description  *string       `json:"description"`
		Priority     *string       `json:"priority"`
		Position     float64       `json:"position"`
		StartDate    *string       `json:"startDate"`
		DueDate      *string       `json:"dueDate"`
		TimeEstimate *int32        `json:"timeEstimate"`
		CreatedByID  *string       `json:"createdById"`
		CreatedAt    string        `json:"createdAt"`
		UpdatedAt    string        `json:"updatedAt"`
		CompletedAt  *string       `json:"completedAt"`
		Archived     bool          `json:"archived"`
		Recurrence   *string       `json:"recurrence"`
		Status       interface{}   `json:"status"`
		Assignees    []interface{} `json:"assignees"`
		Tags         []interface{} `json:"tags"`
		Subtasks     []interface{} `json:"subtasks"`
		Count        interface{}   `json:"_count"`
	}

	taskList := make([]TaskItem, len(tasksRows))
	for i, t := range tasksRows {
		assignees, _ := h.q.ListTaskAssignees(ctx, t.ID)
		assigneeList := make([]interface{}, len(assignees))
		for ai, a := range assignees {
			assigneeList[ai] = fiber.Map{
				"userId": a.UserId,
				"user": fiber.Map{
					"id":        a.UserId,
					"name":      a.UserName,
					"email":     a.UserEmail,
					"color":     a.UserColor,
					"avatarUrl": textOrNil(a.UserAvatarUrl),
				},
			}
		}

		tags, _ := h.q.ListTaskTags(ctx, t.ID)
		tagList := make([]interface{}, len(tags))
		for ti, tg := range tags {
			tagList[ti] = fiber.Map{
				"tagId": tg.TagId,
				"tag": fiber.Map{
					"id":    tg.TagId,
					"name":  tg.TagName,
					"color": tg.TagColor,
				},
			}
		}

		subtasks, _ := h.q.ListSubtasksByParent(ctx, pgtype.Text{String: t.ID, Valid: true})
		subtaskList := make([]interface{}, len(subtasks))
		for si, sub := range subtasks {
			subtaskList[si] = fiber.Map{
				"id":       sub.ID,
				"name":     sub.Name,
				"statusId": sub.StatusId,
				"position": sub.Position,
				"status": fiber.Map{
					"id":    sub.StatusId,
					"name":  sub.StatusName,
					"color": sub.StatusColor,
					"type":  string(sub.StatusType),
				},
			}
		}

		var priority *string
		if t.Priority.Valid {
			pStr := string(t.Priority.Priority)
			priority = &pStr
		}

		var startStr, dueStr, compStr *string
		if t.StartDate.Valid {
			s := t.StartDate.Time.Format("2006-01-02T15:04:05.000Z")
			startStr = &s
		}
		if t.DueDate.Valid {
			s := t.DueDate.Time.Format("2006-01-02T15:04:05.000Z")
			dueStr = &s
		}
		if t.CompletedAt.Valid {
			s := t.CompletedAt.Time.Format("2006-01-02T15:04:05.000Z")
			compStr = &s
		}

		var est *int32
		if t.TimeEstimate.Valid {
			est = &t.TimeEstimate.Int32
		}

		taskList[i] = TaskItem{
			ID:           t.ID,
			ListID:       t.ListId,
			StatusID:     t.StatusId,
			ParentID:     textOrNil(t.ParentId),
			Name:         t.Name,
			Description:  textOrNil(t.Description),
			Priority:     priority,
			Position:     t.Position,
			StartDate:    startStr,
			DueDate:      dueStr,
			TimeEstimate: est,
			CreatedByID:  textOrNil(t.CreatedById),
			CreatedAt:    t.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			UpdatedAt:    t.UpdatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			CompletedAt:  compStr,
			Archived:     t.Archived,
			Recurrence:   textOrNil(t.Recurrence),
			Status: fiber.Map{
				"id":    t.StatusId,
				"name":  t.StatusName,
				"color": t.StatusColor,
				"type":  string(t.StatusType),
			},
			Assignees: assigneeList,
			Tags:      tagList,
			Subtasks:  subtaskList,
			Count: fiber.Map{
				"comments":   t.CommentCount,
				"checklists": t.ChecklistCount,
				"subtasks":   t.SubtaskCount,
			},
		}
	}

	var folderJSON interface{} = nil
	if l.FolderId.Valid {
		folderJSON = fiber.Map{
			"id":   l.FolderId.String,
			"name": l.FolderName.String,
		}
	}

	resList := fiber.Map{
		"id":           l.ID,
		"spaceId":      l.SpaceId,
		"folderId":     textOrNil(l.FolderId),
		"name":         l.Name,
		"color":        textOrNil(l.Color),
		"icon":         textOrNil(l.Icon),
		"position":     l.Position,
		"createdAt":    l.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		"space": fiber.Map{
			"id":    l.SpaceId,
			"name":  l.SpaceName,
			"color": l.SpaceColor,
			"icon":  textOrNil(l.SpaceIcon),
		},
		"folder":       folderJSON,
		"statuses":     statusList,
		"views":        viewList,
		"customFields": []interface{}{},
	}

	return c.JSON(fiber.Map{
		"list":         resList,
		"tasks":        taskList,
		"dependencies": []interface{}{},
	})
}

func (h *HierarchyHandler) UpdateList(c *fiber.Ctx) error {
	listID := c.Params("listId")
	var req struct {
		Name  string  `json:"name"`
		Color *string `json:"color"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	list, err := h.q.UpdateList(c.Context(), db.UpdateListParams{
		ID:    listID,
		Name:  req.Name,
		Color: pgtype.Text{String: *req.Color, Valid: req.Color != nil},
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "List not found"})
	}

	return c.JSON(list)
}

func (h *HierarchyHandler) DeleteList(c *fiber.Ctx) error {
	listID := c.Params("listId")
	if err := h.q.DeleteList(c.Context(), listID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ---------------- Favorites ----------------

func (h *HierarchyHandler) ToggleFavorite(c *fiber.Ctx) error {
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	listID := c.Params("listId")
	ctx := c.Context()

	// Check if already favorited
	favs, _ := h.q.ListUserFavorites(ctx, user.UserId)
	favorited := false
	for _, f := range favs {
		if f == listID {
			favorited = true
			break
		}
	}

	if favorited {
		_ = h.q.RemoveFavorite(ctx, db.RemoveFavoriteParams{
			UserId: user.UserId,
			ListId: listID,
		})
		return c.JSON(fiber.Map{"favorited": false})
	}

	_, _ = h.q.AddFavorite(ctx, db.AddFavoriteParams{
		ID:     cuid(),
		UserId: user.UserId,
		ListId: listID,
	})
	return c.JSON(fiber.Map{"favorited": true})
}
