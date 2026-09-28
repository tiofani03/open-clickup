package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"open-clickup-server/internal/auth"
	"open-clickup-server/internal/db"
)

func cuid() string {
	return "c" + uuid.New().String()[:24]
}

func textOrNil(t pgtype.Text) *string {
	if t.Valid {
		return &t.String
	}
	return nil
}

func stringPtrToText(s *string) pgtype.Text {
	if s != nil {
		return pgtype.Text{String: *s, Valid: true}
	}
	return pgtype.Text{Valid: false}
}

type AuthHandler struct {
	q *db.Queries
}

func NewAuthHandler(q *db.Queries) *AuthHandler {
	return &AuthHandler{q: q}
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Email and password are required"})
	}

	user, err := h.q.GetUserByEmail(c.Context(), req.Email)
	if err != nil || !user.PasswordHash.Valid || !auth.VerifyPassword(req.Password, user.PasswordHash.String) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid email or password"})
	}

	if _, err := auth.CreateSession(c, h.q, user.ID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create session"})
	}

	return c.JSON(fiber.Map{
		"id":        user.ID,
		"email":     user.Email,
		"name":      user.Name,
		"color":     user.Color,
		"avatarUrl": textOrNil(user.AvatarUrl),
	})
}

type SignupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func (h *AuthHandler) Signup(c *fiber.Ctx) error {
	var req SignupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || req.Password == "" || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Email, password, and name are required"})
	}

	if len(req.Password) < 6 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Password must be at least 6 characters"})
	}

	// Check if already exists
	_, err := h.q.GetUserByEmail(c.Context(), req.Email)
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "An account with this email already exists"})
	}

	pwHash, err := auth.HashPassword(req.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	userID := cuid()
	user, err := h.q.CreateUser(c.Context(), db.CreateUserParams{
		ID:           userID,
		Email:        req.Email,
		Name:         req.Name,
		Color:        "#7b68ee",
		PasswordHash: pgtype.Text{String: pwHash, Valid: true},
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create user"})
	}

	// Add to default workspace
	ws, err := h.q.GetFirstWorkspace(c.Context())
	if err == nil {
		_, _ = h.q.CreateWorkspaceMember(c.Context(), db.CreateWorkspaceMemberParams{
			ID:          cuid(),
			WorkspaceId: ws.ID,
			UserId:      user.ID,
			Role:        db.MemberRoleMEMBER,
		})
	}

	if _, err := auth.CreateSession(c, h.q, user.ID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create session"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":        user.ID,
		"email":     user.Email,
		"name":      user.Name,
		"color":     user.Color,
		"avatarUrl": user.AvatarUrl,
	})
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	_ = auth.DestroySession(c, h.q)
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	return c.JSON(fiber.Map{
		"id":        user.UserId,
		"email":     user.UserEmail,
		"name":      user.UserName,
		"color":     user.UserColor,
		"avatarUrl": user.UserAvatarUrl,
	})
}
