package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"open-clickup-server/internal/db"
)

type BootstrapHandler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewBootstrapHandler(pool *pgxpool.Pool, q *db.Queries) *BootstrapHandler {
	return &BootstrapHandler{pool: pool, q: q}
}

type UserJSON struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Email     string  `json:"email"`
	Color     string  `json:"color"`
	AvatarUrl *string `json:"avatarUrl"`
}

type MemberJSON struct {
	ID          string   `json:"id"`
	WorkspaceID string   `json:"workspaceId"`
	UserID      string   `json:"userId"`
	Role        string   `json:"role"`
	CreatedAt   string   `json:"createdAt"`
	User        UserJSON `json:"user"`
}

type ListCountJSON struct {
	Tasks int `json:"tasks"`
}

type ListNodeJSON struct {
	ID        string        `json:"id"`
	SpaceID   string        `json:"spaceId"`
	FolderID  *string       `json:"folderId"`
	Name      string        `json:"name"`
	Color     *string       `json:"color"`
	Icon      *string       `json:"icon"`
	Position  float64       `json:"position"`
	CreatedAt string        `json:"createdAt"`
	Count     ListCountJSON `json:"_count"`
}

type FolderNodeJSON struct {
	ID        string         `json:"id"`
	SpaceID   string         `json:"spaceId"`
	Name      string         `json:"name"`
	Position  float64        `json:"position"`
	Collapsed bool           `json:"collapsed"`
	CreatedAt string         `json:"createdAt"`
	Lists     []ListNodeJSON `json:"lists"`
}

type SpaceNodeJSON struct {
	ID        string           `json:"id"`
	Name      string           `json:"name"`
	Color     string           `json:"color"`
	Icon      *string          `json:"icon"`
	Position  float64          `json:"position"`
	CreatedAt string           `json:"createdAt"`
	Folders   []FolderNodeJSON `json:"folders"`
	Lists     []ListNodeJSON   `json:"lists"`
}

type WorkspaceTreeJSON struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Color     string          `json:"color"`
	AvatarUrl *string         `json:"avatarUrl"`
	CreatedAt string          `json:"createdAt"`
	Members   []MemberJSON    `json:"members"`
	Spaces    []SpaceNodeJSON `json:"spaces"`
}

func (h *BootstrapHandler) GetBootstrap(c *fiber.Ctx) error {
	user := c.Locals("user").(*db.GetSessionWithUserRow)
	ctx := c.Context()

	ws, err := h.q.GetFirstWorkspace(ctx)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "No workspace found"})
	}

	membersRows, err := h.q.ListWorkspaceMembers(ctx, ws.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	members := make([]MemberJSON, len(membersRows))
	for i, m := range membersRows {
		members[i] = MemberJSON{
			ID:          m.ID,
			WorkspaceID: m.WorkspaceId,
			UserID:      m.UserId,
			Role:        string(m.Role),
			CreatedAt:   m.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			User: UserJSON{
				ID:        m.UserId,
				Name:      m.UserName,
				Email:     m.UserEmail,
				Color:     m.UserColor,
				AvatarUrl: textOrNil(m.UserAvatarUrl),
			},
		}
	}

	// Build spaces tree
	spacesRows, err := h.q.ListSpacesByWorkspace(ctx, ws.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	spaces := make([]SpaceNodeJSON, len(spacesRows))
	for i, s := range spacesRows {
		sJSON := SpaceNodeJSON{
			ID:        s.ID,
			Name:      s.Name,
			Color:     s.Color,
			Icon:      textOrNil(s.Icon),
			Position:  s.Position,
			CreatedAt: s.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
			Folders:   []FolderNodeJSON{},
			Lists:     []ListNodeJSON{},
		}

		// Folders
		foldersRows, _ := h.q.ListFoldersBySpace(ctx, s.ID)
		for _, f := range foldersRows {
			fJSON := FolderNodeJSON{
				ID:        f.ID,
				SpaceID:   f.SpaceId,
				Name:      f.Name,
				Position:  f.Position,
				Collapsed: f.Collapsed,
				CreatedAt: f.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
				Lists:     []ListNodeJSON{},
			}
			sJSON.Folders = append(sJSON.Folders, fJSON)
		}

		// All lists in space
		listsRows, _ := h.q.ListListsBySpace(ctx, s.ID)
		for _, l := range listsRows {
			lJSON := ListNodeJSON{
				ID:        l.ID,
				SpaceID:   l.SpaceId,
				FolderID:  textOrNil(l.FolderId),
				Name:      l.Name,
				Color:     textOrNil(l.Color),
				Icon:      textOrNil(l.Icon),
				Position:  l.Position,
				CreatedAt: l.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
				Count:     ListCountJSON{Tasks: int(l.TaskCount)},
			}

			if l.FolderId.Valid {
				// Find folder
				for fi := range sJSON.Folders {
					if sJSON.Folders[fi].ID == l.FolderId.String {
						sJSON.Folders[fi].Lists = append(sJSON.Folders[fi].Lists, lJSON)
						break
					}
				}
			} else {
				sJSON.Lists = append(sJSON.Lists, lJSON)
			}
		}

		spaces[i] = sJSON
	}

	wsTree := WorkspaceTreeJSON{
		ID:        ws.ID,
		Name:      ws.Name,
		Color:     ws.Color,
		AvatarUrl: textOrNil(ws.AvatarUrl),
		CreatedAt: ws.CreatedAt.Time.Format("2006-01-02T15:04:05.000Z"),
		Members:   members,
		Spaces:    spaces,
	}

	favs, _ := h.q.ListUserFavorites(ctx, user.UserId)
	if favs == nil {
		favs = []string{}
	}

	return c.JSON(fiber.Map{
		"currentUser": UserJSON{
			ID:        user.UserId,
			Name:      user.UserName,
			Email:     user.UserEmail,
			Color:     user.UserColor,
			AvatarUrl: textOrNil(user.UserAvatarUrl),
		},
		"workspace": wsTree,
		"favorites": favs,
	})
}
