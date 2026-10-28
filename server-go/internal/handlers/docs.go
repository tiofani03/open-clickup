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
		IsPublished:     p.IsPublished,
		HasDraft:        p.HasDraft,
		DraftMarkdown:   textOrNil(p.DraftMarkdown),
		DraftHTML:       textOrNil(p.DraftHtml),
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
		IsPublished:     p.IsPublished,
		HasDraft:        p.HasDraft,
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

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback(ctx)

	qtx := h.q.WithTx(tx)

	docID := cuid()
	doc, err := qtx.CreateDoc(ctx, db.CreateDocParams{
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
	page, err := qtx.CreateDocPage(ctx, db.CreateDocPageParams{
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

	if err := tx.Commit(ctx); err != nil {
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

	var contentMarkdown string
	if req.ContentMarkdown != nil {
		contentMarkdown = *req.ContentMarkdown
	}
	var contentHtml string
	if req.ContentHTML != nil {
		contentHtml = *req.ContentHTML
	}

	pageID := cuid()
	page, err := h.q.CreateDocPage(ctx, db.CreateDocPageParams{
		ID:              pageID,
		DocID:           docID,
		ParentPageID:    foreignKeyText(req.ParentPageID),
		Title:           title,
		ContentMarkdown: contentMarkdown,
		ContentHtml:     contentHtml,
		Icon:            stringPtrToText(req.Icon),
		CoverImage:      stringPtrToText(req.CoverImage),
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
		IsPublished:     boolPtrToBool(req.IsPublished),
		HasDraft:        boolPtrToBool(req.HasDraft),
		DraftMarkdown:   stringPtrToText(req.DraftMarkdown),
		DraftHtml:       stringPtrToText(req.DraftHTML),
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	realtime.DefaultHub.Broadcast(realtime.Event{Type: "doc"})

	return c.JSON(toDocPageResponse(updatedPage))
}

// PublishDocPage POST /api/docs/:docId/pages/:pageId/publish -> publishes draft to live content
func (h *DocsHandler) PublishDocPage(c *fiber.Ctx) error {
	docID := c.Params("docId")
	pageID := c.Params("pageId")
	ctx := c.Context()

	page, err := h.q.GetDocPageByID(ctx, pageID)
	if err != nil || page.DocID != docID {
		return sendError(c, fiber.StatusNotFound, "Page not found")
	}

	publishedPage, err := h.q.PublishDocPage(ctx, pageID)
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	realtime.DefaultHub.Broadcast(realtime.Event{Type: "doc"})

	return c.JSON(toDocPageResponse(publishedPage))
}

// DiscardDocPageDraft POST /api/docs/:docId/pages/:pageId/discard-draft -> discards active draft
func (h *DocsHandler) DiscardDocPageDraft(c *fiber.Ctx) error {
	docID := c.Params("docId")
	pageID := c.Params("pageId")
	ctx := c.Context()

	page, err := h.q.GetDocPageByID(ctx, pageID)
	if err != nil || page.DocID != docID {
		return sendError(c, fiber.StatusNotFound, "Page not found")
	}

	discardedPage, err := h.q.DiscardDocPageDraft(ctx, pageID)
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	realtime.DefaultHub.Broadcast(realtime.Event{Type: "doc"})

	return c.JSON(toDocPageResponse(discardedPage))
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

// ListDocComments GET /api/docs/:docId/pages/:pageId/comments -> returns comments for page
func (h *DocsHandler) ListDocComments(c *fiber.Ctx) error {
	docID := c.Params("docId")
	pageID := c.Params("pageId")
	ctx := c.Context()

	page, err := h.q.GetDocPageByID(ctx, pageID)
	if err != nil || page.DocID != docID {
		return sendError(c, fiber.StatusNotFound, "Page not found")
	}

	rows, err := h.q.ListDocCommentsByPage(ctx, pageID)
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	res := make([]dto.DocCommentResponse, 0, len(rows))
	for _, row := range rows {
		res = append(res, dto.DocCommentResponse{
			ID:        row.ID,
			DocPageID: row.DocPageID,
			UserID:    row.UserID,
			Body:      row.Body,
			ParentID:  textOrNil(row.ParentID),
			CreatedAt: formatTimestamptz(row.CreatedAt),
			UpdatedAt: formatTimestamptz(row.UpdatedAt),
			User: &dto.UserResponse{
				ID:        row.UserID,
				Email:     row.UserEmail,
				Name:      row.UserName,
				Color:     row.UserColor,
				AvatarURL: textOrNil(row.UserAvatarUrl),
			},
		})
	}

	return c.JSON(res)
}

// CreateDocComment POST /api/docs/:docId/pages/:pageId/comments -> adds a comment to page
func (h *DocsHandler) CreateDocComment(c *fiber.Ctx) error {
	docID := c.Params("docId")
	pageID := c.Params("pageId")
	ctx := c.Context()

	var userID string
	if val := c.Locals("user"); val != nil {
		if u, ok := val.(*db.GetSessionWithUserRow); ok {
			userID = u.UserId
		}
	}
	if userID == "" {
		return sendError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	page, err := h.q.GetDocPageByID(ctx, pageID)
	if err != nil || page.DocID != docID {
		return sendError(c, fiber.StatusNotFound, "Page not found")
	}

	var req dto.CreateDocCommentRequest
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	body := strings.TrimSpace(req.Body)
	if body == "" {
		return sendError(c, fiber.StatusBadRequest, "Comment body cannot be empty")
	}

	commentID := cuid()
	comment, err := h.q.CreateDocComment(ctx, db.CreateDocCommentParams{
		ID:        commentID,
		DocPageID: pageID,
		UserID:    userID,
		Body:      body,
		ParentID:  foreignKeyText(req.ParentID),
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	var userResp *dto.UserResponse
	if u, err := h.q.GetUserByID(ctx, userID); err == nil {
		userResp = &dto.UserResponse{
			ID:        u.ID,
			Email:     u.Email,
			Name:      u.Name,
			Color:     u.Color,
			AvatarURL: textOrNil(u.AvatarUrl),
		}
	}

	realtime.DefaultHub.Broadcast(realtime.Event{Type: "doc"})

	return c.Status(fiber.StatusCreated).JSON(dto.DocCommentResponse{
		ID:        comment.ID,
		DocPageID: comment.DocPageID,
		UserID:    comment.UserID,
		Body:      comment.Body,
		ParentID:  textOrNil(comment.ParentID),
		CreatedAt: formatTimestamptz(comment.CreatedAt),
		UpdatedAt: formatTimestamptz(comment.UpdatedAt),
		User:      userResp,
	})
}

// DeleteDocComment DELETE /api/docs/:docId/pages/:pageId/comments/:commentId -> deletes comment
func (h *DocsHandler) DeleteDocComment(c *fiber.Ctx) error {
	commentID := c.Params("commentId")
	ctx := c.Context()

	if err := h.q.DeleteDocComment(ctx, commentID); err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	realtime.DefaultHub.Broadcast(realtime.Event{Type: "doc"})

	return c.JSON(dto.OKResponse{OK: true})
}
