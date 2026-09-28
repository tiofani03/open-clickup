package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"open-clickup-server/internal/auth"
	"open-clickup-server/internal/db"
	"open-clickup-server/internal/dto"
)

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
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		return sendError(c, fiber.StatusBadRequest, "Email and password are required")
	}

	user, err := h.q.GetUserByEmail(c.Context(), req.Email)
	if err != nil || !user.PasswordHash.Valid || !auth.VerifyPassword(req.Password, user.PasswordHash.String) {
		return sendError(c, fiber.StatusUnauthorized, "Invalid email or password")
	}

	if _, err := auth.CreateSession(c, h.q, user.ID); err != nil {
		return sendError(c, fiber.StatusInternalServerError, "Failed to create session")
	}

	return c.JSON(dto.UserResponse{
		ID:        user.ID,
		Email:     user.Email,
		Name:      user.Name,
		Color:     user.Color,
		AvatarURL: textOrNil(user.AvatarUrl),
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
		return sendError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || req.Password == "" || req.Name == "" {
		return sendError(c, fiber.StatusBadRequest, "Email, password, and name are required")
	}

	if len(req.Password) < 6 {
		return sendError(c, fiber.StatusBadRequest, "Password must be at least 6 characters")
	}

	// Check if already exists
	_, err := h.q.GetUserByEmail(c.Context(), req.Email)
	if err == nil {
		return sendError(c, fiber.StatusConflict, "An account with this email already exists")
	}

	pwHash, err := auth.HashPassword(req.Password)
	if err != nil {
		return sendError(c, fiber.StatusInternalServerError, "Failed to hash password")
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
		return sendError(c, fiber.StatusInternalServerError, "Failed to create user")
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
		return sendError(c, fiber.StatusInternalServerError, "Failed to create session")
	}

	return c.Status(fiber.StatusCreated).JSON(dto.UserResponse{
		ID:        user.ID,
		Email:     user.Email,
		Name:      user.Name,
		Color:     user.Color,
		AvatarURL: textOrNil(user.AvatarUrl),
	})
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	_ = auth.DestroySession(c, h.q)
	return c.JSON(dto.OKResponse{OK: true})
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	return c.JSON(dto.UserResponse{
		ID:        user.UserId,
		Email:     user.UserEmail,
		Name:      user.UserName,
		Color:     user.UserColor,
		AvatarURL: textOrNil(user.UserAvatarUrl),
	})
}
