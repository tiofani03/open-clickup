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

type CommentsHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewCommentsHandler(pool *pgxpool.Pool, q *db.Queries) *CommentsHandler {
	return &CommentsHandler{pool: pool, q: q}
}

type CreateCommentReq struct {
	Body     string  `json:"body"`
	ParentID *string `json:"parentId"`
}

func (h *CommentsHandler) CreateComment(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	ctx := c.Context()

	var req CreateCommentReq
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	req.Body = strings.TrimSpace(req.Body)
	if req.Body == "" {
		return sendError(c, fiber.StatusBadRequest, "body is required")
	}

	comment, err := h.q.CreateComment(ctx, db.CreateCommentParams{
		ID:       cuid(),
		TaskId:   taskID,
		UserId:   user.UserId,
		Body:     req.Body,
		ParentId: stringPtrToText(req.ParentID),
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	// Create activity
	_, _ = h.q.CreateActivity(ctx, db.CreateActivityParams{
		ID:     cuid(),
		TaskId: taskID,
		UserId: pgtype.Text{String: user.UserId, Valid: true},
		Type:   "commented",
		Data:   []byte(`{}`),
	})

	task, err := h.q.GetTaskByID(ctx, taskID)
	if err == nil {
		realtime.DefaultHub.Broadcast(realtime.Event{
			Type:   "list",
			ListID: task.ListId,
		})
	}

	return c.Status(fiber.StatusCreated).JSON(dto.CommentResponse{
		ID:        comment.ID,
		TaskID:    comment.TaskId,
		UserID:    comment.UserId,
		Body:      comment.Body,
		ParentID:  textOrNil(comment.ParentId),
		Resolved:  comment.Resolved,
		CreatedAt: comment.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt: comment.UpdatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		User: dto.UserResponse{
			ID:        user.UserId,
			Name:      user.UserName,
			Email:     user.UserEmail,
			Color:     user.UserColor,
			AvatarURL: textOrNil(user.UserAvatarUrl),
		},
		Reactions: []dto.CommentReactionResponse{},
	})
}

type UpdateCommentReq struct {
	Body     *string `json:"body"`
	Resolved *bool   `json:"resolved"`
}

func (h *CommentsHandler) UpdateComment(c *fiber.Ctx) error {
	commentID := c.Params("commentId")
	ctx := c.Context()

	var req UpdateCommentReq
	if err := c.BodyParser(&req); err != nil {
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	var curBody string
	var curResolved bool
	var taskID string
	var userID string
	row := h.pool.QueryRow(ctx, `SELECT body, resolved, "taskId", "userId" FROM "Comment" WHERE id = $1`, commentID)
	if err := row.Scan(&curBody, &curResolved, &taskID, &userID); err != nil {
		return sendError(c, fiber.StatusNotFound, "Comment not found")
	}

	if req.Body != nil && strings.TrimSpace(*req.Body) != "" {
		curBody = strings.TrimSpace(*req.Body)
	}
	if req.Resolved != nil {
		curResolved = *req.Resolved
	}

	comment, err := h.q.UpdateComment(ctx, db.UpdateCommentParams{
		ID:       commentID,
		Body:     curBody,
		Resolved: curResolved,
	})
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	task, err := h.q.GetTaskByID(ctx, taskID)
	if err == nil {
		realtime.DefaultHub.Broadcast(realtime.Event{
			Type:   "list",
			ListID: task.ListId,
		})
	}

	// Fetch author details
	u, _ := h.q.GetUserByID(ctx, userID)

	return c.JSON(dto.CommentResponse{
		ID:        comment.ID,
		TaskID:    comment.TaskId,
		UserID:    comment.UserId,
		Body:      comment.Body,
		ParentID:  textOrNil(comment.ParentId),
		Resolved:  comment.Resolved,
		CreatedAt: comment.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt: comment.UpdatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		User: dto.UserResponse{
			ID:        u.ID,
			Name:      u.Name,
			Email:     u.Email,
			Color:     u.Color,
			AvatarURL: textOrNil(u.AvatarUrl),
		},
		Reactions: []dto.CommentReactionResponse{},
	})
}

func (h *CommentsHandler) DeleteComment(c *fiber.Ctx) error {
	commentID := c.Params("commentId")
	ctx := c.Context()

	var taskID string
	row := h.pool.QueryRow(ctx, `SELECT "taskId" FROM "Comment" WHERE id = $1`, commentID)
	_ = row.Scan(&taskID)

	if err := h.q.DeleteComment(ctx, commentID); err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	if taskID != "" {
		task, err := h.q.GetTaskByID(ctx, taskID)
		if err == nil {
			realtime.DefaultHub.Broadcast(realtime.Event{
				Type:   "list",
				ListID: task.ListId,
			})
		}
	}

	return c.JSON(dto.OKResponse{OK: true})
}

type ToggleReactionReq struct {
	Emoji string `json:"emoji"`
}

func (h *CommentsHandler) ToggleReaction(c *fiber.Ctx) error {
	commentID := c.Params("commentId")
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	ctx := c.Context()

	var req ToggleReactionReq
	if err := c.BodyParser(&req); err != nil || req.Emoji == "" {
		return sendError(c, fiber.StatusBadRequest, "emoji is required")
	}

	var taskID string
	row := h.pool.QueryRow(ctx, `SELECT "taskId" FROM "Comment" WHERE id = $1`, commentID)
	_ = row.Scan(&taskID)

	reactions, _ := h.q.ListReactionsByComment(ctx, commentID)
	hasReacted := false
	for _, r := range reactions {
		if r.UserId == user.UserId && r.Emoji == req.Emoji {
			hasReacted = true
			break
		}
	}

	if hasReacted {
		_ = h.q.RemoveReaction(ctx, db.RemoveReactionParams{
			CommentId: commentID,
			UserId:    user.UserId,
			Emoji:     req.Emoji,
		})
	} else {
		_, err := h.q.AddReaction(ctx, db.AddReactionParams{
			ID:        cuid(),
			CommentId: commentID,
			UserId:    user.UserId,
			Emoji:     req.Emoji,
		})
		if err != nil {
			return sendError(c, fiber.StatusInternalServerError, err.Error())
		}
	}

	if taskID != "" {
		task, err := h.q.GetTaskByID(ctx, taskID)
		if err == nil {
			realtime.DefaultHub.Broadcast(realtime.Event{
				Type:   "list",
				ListID: task.ListId,
			})
		}
	}

	return c.JSON(dto.ReactionToggleResponse{Reacted: !hasReacted})
}
