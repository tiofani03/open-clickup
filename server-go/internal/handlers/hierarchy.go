package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/dto"
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
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return sendError(c, fiber.StatusBadRequest, "name is required")
	}

	ws, err := h.q.GetFirstWorkspace(c.Context())
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "No workspace found")
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
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	return c.Status(fiber.StatusCreated).JSON(space)
}

func (h *HierarchyHandler) UpdateSpace(c *fiber.Ctx) error {
	spaceID := c.Params("spaceId")
	var req CreateSpaceReq
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	space, err := h.q.UpdateSpace(c.Context(), db.UpdateSpaceParams{
		ID:    spaceID,
		Name:  req.Name,
		Color: *req.Color,
		Icon:  pgtype.Text{String: *req.Icon, Valid: req.Icon != nil},
	})
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "Space not found")
	}

	return c.JSON(space)
}

func (h *HierarchyHandler) DeleteSpace(c *fiber.Ctx) error {
	spaceID := c.Params("spaceId")
	if err := h.q.DeleteSpace(c.Context(), spaceID); err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(dto.OKResponse{OK: true})
}

// ---------------- Folders ----------------

type CreateFolderReq struct {
	SpaceID string `json:"spaceId"`
	Name    string `json:"name"`
}

func (h *HierarchyHandler) CreateFolder(c *fiber.Ctx) error {
	var req CreateFolderReq
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || req.SpaceID == "" {
		return sendError(c, fiber.StatusBadRequest, "name and spaceId are required")
	}

	folder, err := h.q.CreateFolder(c.Context(), db.CreateFolderParams{
		ID:        cuid(),
		SpaceId:   req.SpaceID,
		Name:      req.Name,
		Position:  1000,
		Collapsed: false,
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	return c.Status(fiber.StatusCreated).JSON(folder)
}

func (h *HierarchyHandler) UpdateFolder(c *fiber.Ctx) error {
	folderID := c.Params("folderId")
	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	folder, err := h.q.UpdateFolder(c.Context(), db.UpdateFolderParams{
		ID:   folderID,
		Name: req.Name,
	})
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "Folder not found")
	}

	return c.JSON(folder)
}

func (h *HierarchyHandler) DeleteFolder(c *fiber.Ctx) error {
	folderID := c.Params("folderId")
	if err := h.q.DeleteFolder(c.Context(), folderID); err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(dto.OKResponse{OK: true})
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
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || req.SpaceID == "" {
		return sendError(c, fiber.StatusBadRequest, "name and spaceId are required")
	}

	list, err := service.CreateListWithDefaults(c.Context(), h.pool, req.SpaceID, req.FolderID, req.Name)
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	return c.Status(fiber.StatusCreated).JSON(list)
}

func (h *HierarchyHandler) GetList(c *fiber.Ctx) error {
	listID := c.Params("listId")
	ctx := c.Context()

	l, err := h.q.GetListByID(ctx, listID)
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "List not found")
	}

	statuses, _ := h.q.ListStatusesByList(ctx, listID)
	views, _ := h.q.ListViewsByList(ctx, listID)
	tasksRows, _ := h.q.ListTasksByList(ctx, listID)

	statusList := make([]dto.StatusResponse, len(statuses))
	for i, s := range statuses {
		var wip *int32
		if s.WipLimit.Valid {
			wip = &s.WipLimit.Int32
		}
		statusList[i] = dto.StatusResponse{
			ID:       s.ID,
			ListID:   s.ListId,
			Name:     s.Name,
			Color:    s.Color,
			Type:     string(s.Type),
			Position: s.Position,
			WipLimit: wip,
		}
	}

	viewList := make([]dto.ViewResponse, len(views))
	for i, v := range views {
		viewList[i] = dto.ViewResponse{
			ID:       v.ID,
			ListID:   v.ListId,
			Name:     v.Name,
			Type:     string(v.Type),
			Position: v.Position,
			Config:   v.Config,
		}
	}

	taskList := make([]dto.TaskResponse, len(tasksRows))
	for i, t := range tasksRows {
		assignees, _ := h.q.ListTaskAssignees(ctx, t.ID)
		assigneeList := make([]dto.TaskAssigneeResponse, len(assignees))
		for ai, a := range assignees {
			assigneeList[ai] = dto.TaskAssigneeResponse{
				UserID: a.UserId,
				User: dto.UserResponse{
					ID:        a.UserId,
					Name:      a.UserName,
					Email:     a.UserEmail,
					Color:     a.UserColor,
					AvatarURL: textOrNil(a.UserAvatarUrl),
				},
			}
		}

		tags, _ := h.q.ListTaskTags(ctx, t.ID)
		tagList := make([]dto.TaskTagResponse, len(tags))
		for ti, tg := range tags {
			tagList[ti] = dto.TaskTagResponse{
				TagID: tg.TagId,
				Tag: dto.TagMetaResponse{
					ID:    tg.TagId,
					Name:  tg.TagName,
					Color: tg.TagColor,
				},
			}
		}

		subtasks, _ := h.q.ListSubtasksByParent(ctx, pgtype.Text{String: t.ID, Valid: true})
		subtaskList := make([]dto.SubtaskResponse, len(subtasks))
		for si, sub := range subtasks {
			subtaskList[si] = dto.SubtaskResponse{
				ID:       sub.ID,
				Name:     sub.Name,
				StatusID: sub.StatusId,
				Position: sub.Position,
				Status: dto.StatusResponse{
					ID:       sub.StatusId,
					Name:     sub.StatusName,
					Color:    sub.StatusColor,
					Type:     string(sub.StatusType),
					Position: 0,
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

		taskList[i] = dto.TaskResponse{
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
			Status: dto.StatusResponse{
				ID:       t.StatusId,
				ListID:   t.ListId,
				Name:     t.StatusName,
				Color:    t.StatusColor,
				Type:     string(t.StatusType),
				Position: 0,
			},
			Assignees:         assigneeList,
			Tags:              tagList,
			Subtasks:          subtaskList,
			CustomFieldValues: []interface{}{},
			Count: dto.TaskCount{
				Comments:   int(t.CommentCount),
				Checklists: int(t.ChecklistCount),
				Subtasks:   int(t.SubtaskCount),
			},
		}
	}

	var folderJSON *dto.FolderMetaResponse = nil
	if l.FolderId.Valid {
		folderJSON = &dto.FolderMetaResponse{
			ID:   l.FolderId.String,
			Name: l.FolderName.String,
		}
	}

	resList := dto.ListWithRelationsResponse{
		ID:        l.ID,
		SpaceID:   l.SpaceId,
		FolderID:  textOrNil(l.FolderId),
		Name:      l.Name,
		Color:     textOrNil(l.Color),
		Icon:      textOrNil(l.Icon),
		Position:  l.Position,
		CreatedAt: l.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		Space: dto.SpaceMetaResponse{
			ID:    l.SpaceId,
			Name:  l.SpaceName,
			Color: l.SpaceColor,
			Icon:  textOrNil(l.SpaceIcon),
		},
		Folder:       folderJSON,
		Statuses:     statusList,
		Views:        viewList,
		CustomFields: []interface{}{},
	}

	return c.JSON(dto.ListDetailResponse{
		List:         resList,
		Tasks:        taskList,
		Dependencies: []dto.TaskDependencyResponse{},
	})
}

func (h *HierarchyHandler) UpdateList(c *fiber.Ctx) error {
	listID := c.Params("listId")
	var req struct {
		Name  string  `json:"name"`
		Color *string `json:"color"`
	}
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	list, err := h.q.UpdateList(c.Context(), db.UpdateListParams{
		ID:    listID,
		Name:  req.Name,
		Color: stringPtrToText(req.Color),
	})
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "List not found")
	}

	return c.JSON(list)
}

func (h *HierarchyHandler) DeleteList(c *fiber.Ctx) error {
	listID := c.Params("listId")
	if err := h.q.DeleteList(c.Context(), listID); err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(dto.OKResponse{OK: true})
}

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
		return c.JSON(dto.FavoriteToggleResponse{Favorited: false})
	}

	_, _ = h.q.AddFavorite(ctx, db.AddFavoriteParams{
		ID:     cuid(),
		UserId: user.UserId,
		ListId: listID,
	})
	return c.JSON(dto.FavoriteToggleResponse{Favorited: true})
}
