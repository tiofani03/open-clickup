package dto

type DocResponse struct {
	ID          string        `json:"id"`
	WorkspaceID string        `json:"workspaceId"`
	SpaceID     *string       `json:"spaceId"`
	FolderID    *string       `json:"folderId"`
	ListID      *string       `json:"listId"`
	TaskID      *string       `json:"taskId"`
	Title       string        `json:"title"`
	CreatedByID string        `json:"createdById"`
	IsPinned    bool          `json:"isPinned"`
	CreatedAt   string        `json:"createdAt"`
	UpdatedAt   string        `json:"updatedAt"`
	Creator     *UserResponse `json:"creator,omitempty"`
}

type DocPageResponse struct {
	ID              string  `json:"id"`
	DocID           string  `json:"docId"`
	ParentPageID    *string `json:"parentPageId"`
	Title           string  `json:"title"`
	ContentMarkdown string  `json:"contentMarkdown"`
	ContentHTML     string  `json:"contentHtml"`
	Icon            *string `json:"icon"`
	CoverImage      *string `json:"coverImage"`
	Position        float64 `json:"position"`
	CreatedAt       string  `json:"createdAt"`
	UpdatedAt       string  `json:"updatedAt"`
	IsPublished     bool    `json:"isPublished"`
	HasDraft        bool    `json:"hasDraft"`
	DraftMarkdown   *string `json:"draftMarkdown,omitempty"`
	DraftHTML       *string `json:"draftHtml,omitempty"`
}

type DocDetailResponse struct {
	Doc   DocResponse       `json:"doc"`
	Pages []DocPageResponse `json:"pages"`
}

type CreateDocRequest struct {
	WorkspaceID *string `json:"workspaceId"`
	SpaceID     *string `json:"spaceId"`
	FolderID    *string `json:"folderId"`
	ListID      *string `json:"listId"`
	TaskID      *string `json:"taskId"`
	Title       string  `json:"title"`
}

type UpdateDocRequest struct {
	Title    *string `json:"title"`
	IsPinned *bool   `json:"isPinned"`
	SpaceID  *string `json:"spaceId"`
	FolderID *string `json:"folderId"`
	ListID   *string `json:"listId"`
}

type CreateDocPageRequest struct {
	Title           string   `json:"title"`
	ParentPageID    *string  `json:"parentPageId"`
	Position        *float64 `json:"position"`
	ContentMarkdown *string  `json:"contentMarkdown"`
	ContentHTML     *string  `json:"contentHtml"`
	Icon            *string  `json:"icon"`
	CoverImage      *string  `json:"coverImage"`
}

type UpdateDocPageRequest struct {
	Title           *string  `json:"title"`
	ContentMarkdown *string  `json:"contentMarkdown"`
	ContentHTML     *string  `json:"contentHtml"`
	Icon            *string  `json:"icon"`
	CoverImage      *string  `json:"coverImage"`
	Position        *float64 `json:"position"`
	ParentPageID    *string  `json:"parentPageId"`
	IsPublished     *bool    `json:"isPublished"`
	HasDraft        *bool    `json:"hasDraft"`
	DraftMarkdown   *string  `json:"draftMarkdown"`
	DraftHTML       *string  `json:"draftHtml"`
}

type DocCommentResponse struct {
	ID        string        `json:"id"`
	DocPageID string        `json:"docPageId"`
	UserID    string        `json:"userId"`
	Body      string        `json:"body"`
	ParentID  *string       `json:"parentId"`
	CreatedAt string        `json:"createdAt"`
	UpdatedAt string        `json:"updatedAt"`
	User      *UserResponse `json:"user,omitempty"`
}

type CreateDocCommentRequest struct {
	Body     string  `json:"body"`
	ParentID *string `json:"parentId"`
}
