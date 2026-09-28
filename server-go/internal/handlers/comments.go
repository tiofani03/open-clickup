package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/realtime"
)

type CommentsHandler struct {
	q *db.Queries
}

func NewCommentsHandler(q *db.Queries) *CommentsHandler {
	return &CommentsHandler{q: q}
}

type CreateCommentReq struct {
	Body     string  `json:"body"`
	ParentID *string `json:"parentId"`
}

func (h *CommentsHandler) CreateComment(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	user := c.Locals("user").(*db.GetSessionWithUserRow)

	var req CreateCommentReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	req.Body = strings.TrimSpace(req.Body)
	if req.Body == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "body is required"})
	}

	comment, err := h.q.CreateComment(c.Context(), db.CreateCommentParams{
		ID:       cuid(),
		TaskId:   taskID,
		UserId:   user.UserId,
		Body:     req.Body,
		ParentId: pgtype.Text{String: *req.ParentID, Valid: req.ParentID != nil},
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	realtime.DefaultHub.Broadcast(realtime.Event{
		Type:    "comment:created",
		Payload: fiber.Map{"taskId": taskID, "commentId": comment.ID},
	})

	return c.Status(fiber.StatusCreated).JSON(comment)
}

func (h *CommentsHandler) UpdateComment(c *fiber.Ctx) error {
	commentID := c.Params("commentId")
	var req struct {
		Body     *string `json:"body"`
		Resolved *bool   `json:"resolved"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	comment, err := h.q.UpdateComment(c.Context(), db.UpdateCommentParams{
		ID:       commentID,
		Body:     *req.Body,
		Resolved: *req.Resolved,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Comment not found"})
	}

	return c.JSON(comment)
}

func (h *CommentsHandler) DeleteComment(c *fiber.Ctx) error {
	commentID := c.Params("commentId")
	if err := h.q.DeleteComment(c.Context(), commentID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *CommentsHandler) ToggleReaction(c *fiber.Ctx) error {
	commentID := c.Params("commentId")
	user := c.Locals("user").(*db.GetSessionWithUserRow)

	var req struct {
		Emoji string `json:"emoji"`
	}
	if err := c.BodyParser(&req); err != nil || req.Emoji == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "emoji is required"})
	}

	ctx := c.Context()
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
		return c.JSON(fiber.Map{"reacted": false})
	}

	_, err := h.q.AddReaction(ctx, db.AddReactionParams{
		ID:        cuid(),
		CommentId: commentID,
		UserId:    user.UserId,
		Emoji:     req.Emoji,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"reacted": true})
}
