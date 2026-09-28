package auth

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/dto"
)

const (
	SessionCookieName = "cu_session"
	SessionDays       = 30
)

var roleRank = map[db.MemberRole]int{
	db.MemberRoleGUEST:  0,
	db.MemberRoleMEMBER: 1,
	db.MemberRoleADMIN:  2,
	db.MemberRoleOWNER:  3,
}

func cuid() string {
	return "c" + uuid.New().String()[:24]
}

func CreateSession(c *fiber.Ctx, q *db.Queries, userID string) (*db.Session, error) {
	expiresAt := time.Now().Add(SessionDays * 24 * time.Hour)
	sessionID := cuid()

	sess, err := q.CreateSession(c.Context(), db.CreateSessionParams{
		ID:        sessionID,
		UserId:    userID,
		ExpiresAt: pgtype.Timestamp{Time: expiresAt, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	c.Cookie(&fiber.Cookie{
		Name:     SessionCookieName,
		Value:    sessionID,
		Expires:  expiresAt,
		HTTPOnly: true,
		SameSite: "Lax",
		Path:     "/",
	})

	return &sess, nil
}

func DestroySession(c *fiber.Ctx, q *db.Queries) error {
	sid := c.Cookies(SessionCookieName)
	if sid != "" {
		_ = q.DeleteSession(c.Context(), sid)
	}
	c.ClearCookie(SessionCookieName)
	return nil
}

func GetCurrentUser(ctx context.Context, c *fiber.Ctx, q *db.Queries) (*db.GetSessionWithUserRow, error) {
	sid := c.Cookies(SessionCookieName)
	if sid == "" {
		return nil, nil
	}

	row, err := q.GetSessionWithUser(ctx, sid)
	if err != nil {
		return nil, nil
	}

	return &row, nil
}

func RequireUser(q *db.Queries) fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, err := GetCurrentUser(c.Context(), c, q)
		if err != nil || user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{Error: "Not authenticated"})
		}
		c.Locals("user", user)
		return c.Next()
	}
}

func RequireRole(q *db.Queries, minRole db.MemberRole) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var user *db.GetSessionWithUserRow
		if val := c.Locals("user"); val != nil {
			if u, ok := val.(*db.GetSessionWithUserRow); ok {
				user = u
			}
		}
		if user == nil {
			var err error
			user, err = GetCurrentUser(c.Context(), c, q)
			if err != nil || user == nil {
				return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{Error: "Not authenticated"})
			}
			c.Locals("user", user)
		}

		membership, err := q.GetUserMembership(c.Context(), user.UserId)
		if err != nil || roleRank[membership.Role] < roleRank[minRole] {
			return c.Status(fiber.StatusForbidden).JSON(dto.ErrorResponse{
				Error: "This action requires " + string(minRole) + " access.",
			})
		}

		c.Locals("membership", &membership)
		return c.Next()
	}
}
