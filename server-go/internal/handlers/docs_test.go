package handlers

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"open-clickup-server/internal/db"
	"open-clickup-server/internal/dto"
)

func TestToDocResponse(t *testing.T) {
	now := time.Now().UTC()
	doc := db.Doc{
		ID:          "doc_123",
		WorkspaceID: "ws_456",
		SpaceID:     pgtype.Text{String: "space_789", Valid: true},
		FolderID:    pgtype.Text{Valid: false},
		ListID:      pgtype.Text{Valid: false},
		TaskID:      pgtype.Text{Valid: false},
		Title:       "Test Architecture Doc",
		CreatedByID: "user_1",
		IsPinned:    true,
		CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
		UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
	}

	creator := &dto.UserResponse{
		ID:    "user_1",
		Email: "test@example.com",
		Name:  "Test User",
		Color: "#00ff00",
	}

	res := toDocResponse(doc, creator)

	if res.ID != "doc_123" {
		t.Errorf("expected ID doc_123, got %s", res.ID)
	}
	if res.WorkspaceID != "ws_456" {
		t.Errorf("expected WorkspaceID ws_456, got %s", res.WorkspaceID)
	}
	if res.SpaceID == nil || *res.SpaceID != "space_789" {
		t.Errorf("expected SpaceID space_789, got %v", res.SpaceID)
	}
	if res.FolderID != nil {
		t.Errorf("expected FolderID nil, got %v", res.FolderID)
	}
	if !res.IsPinned {
		t.Errorf("expected IsPinned true, got false")
	}
	if res.Creator == nil || res.Creator.Email != "test@example.com" {
		t.Errorf("expected Creator email test@example.com, got %v", res.Creator)
	}
}

func TestToDocPageResponse(t *testing.T) {
	now := time.Now().UTC()
	page := db.DocPage{
		ID:              "page_123",
		DocID:           "doc_123",
		ParentPageID:    pgtype.Text{String: "parent_456", Valid: true},
		Title:           "Sub-page 1",
		ContentMarkdown: "# Header\n\nContent",
		ContentHtml:     "<h1>Header</h1><p>Content</p>",
		Icon:            pgtype.Text{String: "📄", Valid: true},
		CoverImage:      pgtype.Text{Valid: false},
		Position:        65535.0,
		CreatedAt:       pgtype.Timestamptz{Time: now, Valid: true},
		UpdatedAt:       pgtype.Timestamptz{Time: now, Valid: true},
	}

	res := toDocPageResponse(page)

	if res.ID != "page_123" {
		t.Errorf("expected ID page_123, got %s", res.ID)
	}
	if res.ParentPageID == nil || *res.ParentPageID != "parent_456" {
		t.Errorf("expected ParentPageID parent_456, got %v", res.ParentPageID)
	}
	if res.Title != "Sub-page 1" {
		t.Errorf("expected Title Sub-page 1, got %s", res.Title)
	}
	if res.ContentMarkdown != "# Header\n\nContent" {
		t.Errorf("expected Markdown content, got %s", res.ContentMarkdown)
	}
	if res.ContentHTML != "<h1>Header</h1><p>Content</p>" {
		t.Errorf("expected HTML content, got %s", res.ContentHTML)
	}
	if res.Icon == nil || *res.Icon != "📄" {
		t.Errorf("expected Icon 📄, got %v", res.Icon)
	}
}

func TestDocPageSerialization(t *testing.T) {
	reqJSON := `{
		"title": "API Specification",
		"parentPageId": "root_page_1",
		"contentMarkdown": "## Endpoints",
		"contentHtml": "<h2>Endpoints</h2>",
		"icon": "⚡"
	}`

	var req dto.CreateDocPageRequest
	err := json.Unmarshal([]byte(reqJSON), &req)
	if err != nil {
		t.Fatalf("failed to unmarshal CreateDocPageRequest: %v", err)
	}

	if req.Title != "API Specification" {
		t.Errorf("expected Title API Specification, got %s", req.Title)
	}
	if req.ParentPageID == nil || *req.ParentPageID != "root_page_1" {
		t.Errorf("expected ParentPageID root_page_1, got %v", req.ParentPageID)
	}
	if req.ContentMarkdown == nil || *req.ContentMarkdown != "## Endpoints" {
		t.Errorf("expected ContentMarkdown ## Endpoints, got %v", req.ContentMarkdown)
	}
	if req.Icon == nil || *req.Icon != "⚡" {
		t.Errorf("expected Icon ⚡, got %v", req.Icon)
	}
}
