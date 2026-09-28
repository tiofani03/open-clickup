package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"open-clickup-server/internal/db"
)

var defaultStatusTemplate = []struct {
	Name  string
	Color string
	Type  db.StatusType
}{
	{"TO DO", "#87909e", db.StatusTypeNOTSTARTED},
	{"IN PROGRESS", "#5b9fff", db.StatusTypeACTIVE},
	{"IN REVIEW", "#a875ff", db.StatusTypeACTIVE},
	{"COMPLETE", "#6bc950", db.StatusTypeDONE},
}

var defaultViews = []struct {
	Name string
	Type db.ViewType
}{
	{"List", db.ViewTypeLIST},
	{"Board", db.ViewTypeBOARD},
	{"Calendar", db.ViewTypeCALENDAR},
	{"Gantt", db.ViewTypeGANTT},
	{"Table", db.ViewTypeTABLE},
}

var listColors = []string{"#7b68ee", "#fd71af", "#ff7800", "#2ecd6f", "#0ab1e8", "#9b59b6"}

func cuid() string {
	return "c" + uuid.New().String()[:24]
}

type ListWithDefaults struct {
	ID        string  `json:"id"`
	SpaceID   string  `json:"spaceId"`
	FolderID  *string `json:"folderId"`
	Name      string  `json:"name"`
	Color     *string `json:"color"`
	Position  float64 `json:"position"`
	CreatedAt string  `json:"createdAt"`
}

func CreateListWithDefaults(ctx context.Context, pool *pgxpool.Pool, spaceID string, folderID *string, name string) (*ListWithDefaults, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var count int
	_ = tx.QueryRow(ctx, `SELECT COUNT(*) FROM "List" WHERE "spaceId" = $1`, spaceID).Scan(&count)

	var lastPos float64
	row := tx.QueryRow(ctx, `
		SELECT "position" FROM "List"
		WHERE "spaceId" = $1 AND ("folderId" = $2 OR ($2 IS NULL AND "folderId" IS NULL))
		ORDER BY "position" DESC LIMIT 1
	`, spaceID, folderID)
	_ = row.Scan(&lastPos)

	color := listColors[count%len(listColors)]
	pos := lastPos + 1000
	listID := cuid()

	var createdAt string
	err = tx.QueryRow(ctx, `
		INSERT INTO "List" (id, "spaceId", "folderId", name, color, "position")
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING "createdAt"::text
	`, listID, spaceID, folderID, name, color, pos).Scan(&createdAt)
	if err != nil {
		return nil, err
	}

	for i, s := range defaultStatusTemplate {
		_, err = tx.Exec(ctx, `
			INSERT INTO "Status" (id, "listId", name, color, type, "position")
			VALUES ($1, $2, $3, $4, $5, $6)
		`, cuid(), listID, s.Name, s.Color, s.Type, float64(i*1000))
		if err != nil {
			return nil, err
		}
	}

	for i, v := range defaultViews {
		_, err = tx.Exec(ctx, `
			INSERT INTO "View" (id, "listId", name, type, "position")
			VALUES ($1, $2, $3, $4, $5)
		`, cuid(), listID, v.Name, v.Type, float64(i*1000))
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &ListWithDefaults{
		ID:        listID,
		SpaceID:   spaceID,
		FolderID:  folderID,
		Name:      name,
		Color:     &color,
		Position:  pos,
		CreatedAt: createdAt,
	}, nil
}
