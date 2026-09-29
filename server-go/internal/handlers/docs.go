package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/dto"
	"open-clickup-server/internal/realtime"
)

type DocsHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewDocsHandler(pool *pgxpool.Pool, q *db.Queries) *DocsHandler {
	return &DocsHandler{pool: pool, q: q}
}

func boolPtrToBool(b *bool) pgtype.Bool {
	if b != nil {
		return pgtype.Bool{Bool: *b, Valid: true}
	}
	return pgtype.Bool{Valid: false}
}

func floatPtrToFloat8(f *float64) pgtype.Float8 {
	if f != nil {
		return pgtype.Float8{Float64: *f, Valid: true}
	}
	return pgtype.Float8{Valid: false}
}

func foreignKeyText(s *string) pgtype.Text {
	if s != nil && *s != "" {
		return pgtype.Text{String: *s, Valid: true}
	}
	return pgtype.Text{Valid: false}
}

func formatTimestamptz(t pgtype.Timestamptz) string {
	if t.Valid {
		return t.Time.Format("2006-01-02T15:04:05.000Z")
	}
	return ""
}

func toDocResponse(d db.Doc, creator *dto.UserResponse) dto.DocResponse {
	return dto.DocResponse{
		ID:          d.ID,
		WorkspaceID: d.WorkspaceID,
		SpaceID:     textOrNil(d.SpaceID),
		FolderID:    textOrNil(d.FolderID),
		ListID:      textOrNil(d.ListID),
		TaskID:      textOrNil(d.TaskID),
		Title:       d.Title,
		CreatedByID: d.CreatedByID,
		IsPinned:    d.IsPinned,
		CreatedAt:   formatTimestamptz(d.CreatedAt),
		UpdatedAt:   formatTimestamptz(d.UpdatedAt),
		Creator:     creator,
	}
}

func toDocPageResponse(p db.DocPage) dto.DocPageResponse {
	return dto.DocPageResponse{
		ID:              p.ID,
		DocID:           p.DocID,
		ParentPageID:    textOrNil(p.ParentPageID),
		Title:           p.Title,
		ContentMarkdown: p.ContentMarkdown,
		ContentHTML:     p.ContentHtml,
		Icon:            textOrNil(p.Icon),
		CoverImage:      textOrNil(p.CoverImage),
		Position:        p.Position,
		CreatedAt:       formatTimestamptz(p.CreatedAt),
		UpdatedAt:       formatTimestamptz(p.UpdatedAt),
	}
}

func toDocPageResponseFromRow(p db.ListDocPagesByDocIDRow) dto.DocPageResponse {
	return dto.DocPageResponse{
		ID:              p.ID,
		DocID:           p.DocID,
		ParentPageID:    textOrNil(p.ParentPageID),
		Title:           p.Title,
		ContentMarkdown: "",
		ContentHTML:     "",
		Icon:            textOrNil(p.Icon),
		CoverImage:      textOrNil(p.CoverImage),
		Position:        p.Position,
		CreatedAt:       formatTimestamptz(p.CreatedAt),
		UpdatedAt:       formatTimestamptz(p.UpdatedAt),
	}
}

// ListDocs GET /api/docs -> returns list of docs in workspace. Filter by space_id query param if present.
func (h *DocsHandler) ListDocs(c *fiber.Ctx) error {
	ctx := c.Context()

	spaceID := c.Query("space_id")
	if spaceID == "" {
		spaceID = c.Query("spaceId")
	}

	if spaceID != "" {
		rows, err := h.q.ListDocsBySpace(ctx, pgtype.Text{String: spaceID, Valid: true})
		if err != nil {
			return sendError(c, fiber.StatusInternalServerError, err.Error())
		}
		docs := make([]dto.DocResponse, 0, len(rows))
		for _, d := range rows {
			docs = append(docs, dto.DocResponse{
				ID:          d.ID,
				WorkspaceID: d.WorkspaceID,
				SpaceID:     textOrNil(d.SpaceID),
				FolderID:    textOrNil(d.FolderID),
				ListID:      textOrNil(d.ListID),
				TaskID:      textOrNil(d.TaskID),
				Title:       d.Title,
				CreatedByID: d.CreatedByID,
				IsPinned:    d.IsPinned,
				CreatedAt:   formatTimestamptz(d.CreatedAt),
				UpdatedAt:   formatTimestamptz(d.UpdatedAt),
				Creator: &dto.UserResponse{
					ID:        d.CreatedByID,
					Email:     d.CreatorEmail,
					Name:      d.CreatorName,
					Color:     d.CreatorColor,
					AvatarURL: textOrNil(d.CreatorAvatarUrl),
				},
			})
		}
		return c.JSON(docs)
	}

	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		workspaceID = c.Query("workspaceId")
	}
	if workspaceID == "" {
		ws, err := h.q.GetFirstWorkspace(ctx)
		if err != nil {
			return sendError(c, fiber.StatusInternalServerError, "No workspace found")
		}
		workspaceID = ws.ID
	}

	rows, err := h.q.ListDocsByWorkspace(ctx, workspaceID)
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}
	docs := make([]dto.DocResponse, 0, len(rows))
	for _, d := range rows {
		docs = append(docs, dto.DocResponse{
			ID:          d.ID,
			WorkspaceID: d.WorkspaceID,
			SpaceID:     textOrNil(d.SpaceID),
			FolderID:    textOrNil(d.FolderID),
			ListID:      textOrNil(d.ListID),
			TaskID:      textOrNil(d.TaskID),
			Title:       d.Title,
			CreatedByID: d.CreatedByID,
			IsPinned:    d.IsPinned,
			CreatedAt:   formatTimestamptz(d.CreatedAt),
			UpdatedAt:   formatTimestamptz(d.UpdatedAt),
			Creator: &dto.UserResponse{
				ID:        d.CreatedByID,
				Email:     d.CreatorEmail,
				Name:      d.CreatorName,
				Color:     d.CreatorColor,
				AvatarURL: textOrNil(d.CreatorAvatarUrl),
			},
		})
	}
	return c.JSON(docs)
}

// CreateDoc POST /api/docs -> creates a Doc. Also automatically creates a root DocPage. Returns DocDetailResponse.
func (h *DocsHandler) CreateDoc(c *fiber.Ctx) error {
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	ctx := c.Context()

	var req dto.CreateDocRequest
	_ = c.BodyParser(&req)

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Untitled Doc"
	}

	var workspaceID string
	if req.WorkspaceID != nil && *req.WorkspaceID != "" {
		workspaceID = *req.WorkspaceID
	} else {
		ws, err := h.q.GetFirstWorkspace(ctx)
		if err != nil {
			return sendError(c, fiber.StatusInternalServerError, "No workspace found")
		}
		workspaceID = ws.ID
	}

	docID := cuid()
	doc, err := h.q.CreateDoc(ctx, db.CreateDocParams{
		ID:          docID,
		WorkspaceID: workspaceID,
		SpaceID:     foreignKeyText(req.SpaceID),
		FolderID:    foreignKeyText(req.FolderID),
		ListID:      foreignKeyText(req.ListID),
		TaskID:      foreignKeyText(req.TaskID),
		Title:       title,
		CreatedByID: user.UserId,
		IsPinned:    false,
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	pageTitle := title
	if pageTitle == "Untitled Doc" {
		pageTitle = "Untitled Page"
	}

	pageID := cuid()
	page, err := h.q.CreateDocPage(ctx, db.CreateDocPageParams{
		ID:              pageID,
		DocID:           doc.ID,
		ParentPageID:    pgtype.Text{Valid: false},
		Title:           pageTitle,
		ContentMarkdown: "",
		ContentHtml:     "",
		Icon:            pgtype.Text{Valid: false},
		CoverImage:      pgtype.Text{Valid: false},
		Position:        65535.0,
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	realtime.DefaultHub.Broadcast(realtime.Event{Type: "doc"})

	creator := &dto.UserResponse{
		ID:        user.UserId,
		Email:     user.UserEmail,
		Name:      user.UserName,
		Color:     user.UserColor,
		AvatarURL: textOrNil(user.UserAvatarUrl),
	}

	return c.Status(fiber.StatusCreated).JSON(dto.DocDetailResponse{
		Doc:   toDocResponse(doc, creator),
		Pages: []dto.DocPageResponse{toDocPageResponse(page)},
	})
}

// GetDoc GET /api/docs/:docId -> returns DocDetailResponse (the doc + its pages list).
func (h *DocsHandler) GetDoc(c *fiber.Ctx) error {
	docID := c.Params("docId")
	ctx := c.Context()

	doc, err := h.q.GetDocByID(ctx, docID)
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "Doc not found")
	}

	pages, err := h.q.ListDocPagesByDocID(ctx, docID)
	if err != nil {
		pages = []db.ListDocPagesByDocIDRow{}
	}

	var creator *dto.UserResponse
	if u, err := h.q.GetUserByID(ctx, doc.CreatedByID); err == nil {
		creator = &dto.UserResponse{
			ID:        u.ID,
			Email:     u.Email,
			Name:      u.Name,
			Color:     u.Color,
			AvatarURL: textOrNil(u.AvatarUrl),
		}
	}

	pageResponses := make([]dto.DocPageResponse, 0, len(pages))
	for _, p := range pages {
		pageResponses = append(pageResponses, toDocPageResponseFromRow(p))
	}

	return c.JSON(dto.DocDetailResponse{
		Doc:   toDocResponse(doc, creator),
		Pages: pageResponses,
	})
}

// UpdateDoc PATCH /api/docs/:docId -> updates doc title, is_pinned, etc.
func (h *DocsHandler) UpdateDoc(c *fiber.Ctx) error {
	docID := c.Params("docId")
	ctx := c.Context()

	var req dto.UpdateDocRequest
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	_, err := h.q.GetDocByID(ctx, docID)
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "Doc not found")
	}

	updatedDoc, err := h.q.UpdateDoc(ctx, db.UpdateDocParams{
		ID:       docID,
		Title:    stringPtrToText(req.Title),
		IsPinned: boolPtrToBool(req.IsPinned),
		SpaceID:  foreignKeyText(req.SpaceID),
		FolderID: foreignKeyText(req.FolderID),
		ListID:   foreignKeyText(req.ListID),
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	realtime.DefaultHub.Broadcast(realtime.Event{Type: "doc"})

	var creator *dto.UserResponse
	if u, err := h.q.GetUserByID(ctx, updatedDoc.CreatedByID); err == nil {
		creator = &dto.UserResponse{
			ID:        u.ID,
			Email:     u.Email,
			Name:      u.Name,
			Color:     u.Color,
			AvatarURL: textOrNil(u.AvatarUrl),
		}
	}

	return c.JSON(toDocResponse(updatedDoc, creator))
}

// DeleteDoc DELETE /api/docs/:docId -> deletes doc.
func (h *DocsHandler) DeleteDoc(c *fiber.Ctx) error {
	docID := c.Params("docId")
	ctx := c.Context()

	_, err := h.q.GetDocByID(ctx, docID)
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "Doc not found")
	}

	if err := h.q.DeleteDoc(ctx, docID); err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	realtime.DefaultHub.Broadcast(realtime.Event{Type: "doc"})

	return c.JSON(dto.OKResponse{OK: true})
}

// CreateDocPage POST /api/docs/:docId/pages -> creates new page for doc.
func (h *DocsHandler) CreateDocPage(c *fiber.Ctx) error {
	docID := c.Params("docId")
	ctx := c.Context()

	_, err := h.q.GetDocByID(ctx, docID)
	if err != nil {
		return sendError(c, fiber.StatusNotFound, "Doc not found")
	}

	var req dto.CreateDocPageRequest
	_ = c.BodyParser(&req)

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Untitled Page"
	}

	var pos float64
	if req.Position != nil {
		pos = *req.Position
	} else {
		pages, _ := h.q.ListDocPagesByDocID(ctx, docID)
		if len(pages) > 0 {
			pos = pages[len(pages)-1].Position + 65535.0
		} else {
			pos = 65535.0
		}
	}

	pageID := cuid()
	page, err := h.q.CreateDocPage(ctx, db.CreateDocPageParams{
		ID:              pageID,
		DocID:           docID,
		ParentPageID:    foreignKeyText(req.ParentPageID),
		Title:           title,
		ContentMarkdown: "",
		ContentHtml:     "",
		Icon:            pgtype.Text{Valid: false},
		CoverImage:      pgtype.Text{Valid: false},
		Position:        pos,
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	realtime.DefaultHub.Broadcast(realtime.Event{Type: "doc"})

	return c.Status(fiber.StatusCreated).JSON(toDocPageResponse(page))
}

// GetDocPage GET /api/docs/:docId/pages/:pageId -> returns full page with ContentMarkdown & ContentHTML.
func (h *DocsHandler) GetDocPage(c *fiber.Ctx) error {
	docID := c.Params("docId")
	pageID := c.Params("pageId")
	ctx := c.Context()

	page, err := h.q.GetDocPageByID(ctx, pageID)
	if err != nil || page.DocID != docID {
		return sendError(c, fiber.StatusNotFound, "Page not found")
	}

	return c.JSON(toDocPageResponse(page))
}

// UpdateDocPage PATCH /api/docs/:docId/pages/:pageId -> updates page (title, content_markdown, content_html, icon, position, etc.).
func (h *DocsHandler) UpdateDocPage(c *fiber.Ctx) error {
	docID := c.Params("docId")
	pageID := c.Params("pageId")
	ctx := c.Context()

	page, err := h.q.GetDocPageByID(ctx, pageID)
	if err != nil || page.DocID != docID {
		return sendError(c, fiber.StatusNotFound, "Page not found")
	}

	var req dto.UpdateDocPageRequest
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	updatedPage, err := h.q.UpdateDocPage(ctx, db.UpdateDocPageParams{
		ID:              pageID,
		Title:           stringPtrToText(req.Title),
		ContentMarkdown: stringPtrToText(req.ContentMarkdown),
		ContentHtml:     stringPtrToText(req.ContentHTML),
		Icon:            stringPtrToText(req.Icon),
		CoverImage:      stringPtrToText(req.CoverImage),
		Position:        floatPtrToFloat8(req.Position),
		ParentPageID:    foreignKeyText(req.ParentPageID),
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	realtime.DefaultHub.Broadcast(realtime.Event{Type: "doc"})

	return c.JSON(toDocPageResponse(updatedPage))
}

// DeleteDocPage DELETE /api/docs/:docId/pages/:pageId -> deletes page.
func (h *DocsHandler) DeleteDocPage(c *fiber.Ctx) error {
	docID := c.Params("docId")
	pageID := c.Params("pageId")
	ctx := c.Context()

	page, err := h.q.GetDocPageByID(ctx, pageID)
	if err != nil || page.DocID != docID {
		return sendError(c, fiber.StatusNotFound, "Page not found")
	}

	if err := h.q.DeleteDocPage(ctx, pageID); err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	realtime.DefaultHub.Broadcast(realtime.Event{Type: "doc"})

	return c.JSON(dto.OKResponse{OK: true})
}
