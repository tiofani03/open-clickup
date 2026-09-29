package handlers

import (
	"github.com/gofiber/fiber/v2"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/dto"
)

type NotificationsHandler struct {
	q *db.Queries
}

func NewNotificationsHandler(q *db.Queries) *NotificationsHandler {
	return &NotificationsHandler{q: q}
}

func (h *NotificationsHandler) GetNotifications(c *fiber.Ctx) error {
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	ctx := c.Context()

	rows, err := h.q.ListNotificationsByUser(ctx, user.UserId)
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, err.Error())
	}

	unread, _ := h.q.CountUnreadNotificationsByUser(ctx, user.UserId)

	items := make([]dto.NotificationItemResponse, len(rows))
	for i, r := range rows {
		var actor *dto.UserResponse
		if r.ActorId.Valid && r.ActorName.Valid {
			actor = &dto.UserResponse{
				ID:        r.ActorId.String,
				Name:      r.ActorName.String,
				Email:     r.ActorEmail.String,
				Color:     r.ActorColor.String,
				AvatarURL: textOrNil(r.ActorAvatarUrl),
			}
		}
		var taskMeta *dto.NotificationTaskMeta
		if r.TaskId.Valid && r.TaskName.Valid && r.TaskListID.Valid {
			taskMeta = &dto.NotificationTaskMeta{
				ID:     r.TaskId.String,
				Name:   r.TaskName.String,
				ListID: r.TaskListID.String,
			}
		}
		items[i] = dto.NotificationItemResponse{
			ID:        r.ID,
			Type:      r.Type,
			Body:      r.Body,
			Read:      r.Read,
			CreatedAt: r.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			Actor:     actor,
			Task:      taskMeta,
		}
	}

	return c.JSON(dto.NotificationsListResponse{
		Notifications: items,
		Unread:        int(unread),
	})
}

func (h *NotificationsHandler) MarkRead(c *fiber.Ctx) error {
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	ctx := c.Context()
	var req dto.MarkNotificationsReadRequest
	_ = c.BodyParser(&req)

	if len(req.IDs) > 0 {
		_ = h.q.MarkNotificationsRead(ctx, db.MarkNotificationsReadParams{
			UserId:  user.UserId,
			Column2: req.IDs,
		})
	} else {
		_ = h.q.MarkAllNotificationsRead(ctx, user.UserId)
	}

	return c.JSON(fiber.Map{"ok": true})
}
