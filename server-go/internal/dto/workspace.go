package dto

type StatusResponse struct {
	ID       string  `json:"id"`
	ListID   string  `json:"listId"`
	Name     string  `json:"name"`
	Color    string  `json:"color"`
	Type     string  `json:"type"`
	Position float64 `json:"position"`
	WipLimit *int32  `json:"wipLimit,omitempty"`
}

type ViewResponse struct {
	ID       string      `json:"id"`
	ListID   string      `json:"listId"`
	Name     string      `json:"name"`
	Type     string      `json:"type"`
	Position float64     `json:"position"`
	Config   interface{} `json:"config"`
}

type ListCount struct {
	Tasks int `json:"tasks"`
}

type ListResponse struct {
	ID        string     `json:"id"`
	SpaceID   string     `json:"spaceId"`
	FolderID  *string    `json:"folderId"`
	Name      string     `json:"name"`
	Color     *string    `json:"color"`
	Icon      *string    `json:"icon"`
	Position  float64    `json:"position"`
	CreatedAt string     `json:"createdAt"`
	Count     *ListCount `json:"_count,omitempty"`
}

type FolderResponse struct {
	ID       string         `json:"id"`
	SpaceID  string         `json:"spaceId"`
	Name     string         `json:"name"`
	Color    *string        `json:"color"`
	Position float64        `json:"position"`
	Lists    []ListResponse `json:"lists"`
}

type SpaceResponse struct {
	ID          string           `json:"id"`
	WorkspaceID string           `json:"workspaceId"`
	Name        string           `json:"name"`
	Color       string           `json:"color"`
	Icon        *string          `json:"icon"`
	Position    float64          `json:"position"`
	Folders     []FolderResponse `json:"folders"`
	Lists       []ListResponse   `json:"lists"`
}

type SpaceItemResponse struct {
	ID          string  `json:"id"`
	WorkspaceID string  `json:"workspaceId"`
	Name        string  `json:"name"`
	Color       string  `json:"color"`
	Icon        *string `json:"icon"`
	Private     bool    `json:"private"`
	Position    float64 `json:"position"`
	CreatedAt   string  `json:"createdAt"`
}

type FolderItemResponse struct {
	ID        string  `json:"id"`
	SpaceID   string  `json:"spaceId"`
	Name      string  `json:"name"`
	Position  float64 `json:"position"`
	Collapsed bool    `json:"collapsed"`
	CreatedAt string  `json:"createdAt"`
}

type ListItemResponse struct {
	ID        string  `json:"id"`
	SpaceID   string  `json:"spaceId"`
	FolderID  *string `json:"folderId"`
	Name      string  `json:"name"`
	Color     *string `json:"color"`
	Icon      *string `json:"icon"`
	Position  float64 `json:"position"`
	CreatedAt string  `json:"createdAt"`
}

type WorkspaceMemberResponse struct {
	Role string       `json:"role"`
	User UserResponse `json:"user"`
}

type WorkspaceTreeResponse struct {
	ID      string                    `json:"id"`
	Name    string                    `json:"name"`
	Slug    string                    `json:"slug"`
	Members []WorkspaceMemberResponse `json:"members"`
	Spaces  []SpaceResponse           `json:"spaces"`
}

type BootstrapResponse struct {
	CurrentUser UserResponse          `json:"currentUser"`
	Workspace   WorkspaceTreeResponse `json:"workspace"`
	Favorites   []string              `json:"favorites"`
}

type SpaceMetaResponse struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Color string  `json:"color"`
	Icon  *string `json:"icon"`
}

type FolderMetaResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ListWithRelationsResponse struct {
	ID           string              `json:"id"`
	SpaceID      string              `json:"spaceId"`
	FolderID     *string             `json:"folderId"`
	Name         string              `json:"name"`
	Color        *string             `json:"color"`
	Icon         *string             `json:"icon"`
	Position     float64             `json:"position"`
	CreatedAt    string              `json:"createdAt"`
	Space        SpaceMetaResponse   `json:"space"`
	Folder       *FolderMetaResponse `json:"folder"`
	Statuses     []StatusResponse    `json:"statuses"`
	Views        []ViewResponse      `json:"views"`
	CustomFields []interface{}       `json:"customFields"`
}

type TaskDependencyResponse struct {
	ID        string `json:"id"`
	BlockerID string `json:"blockerId"`
	BlockedID string `json:"blockedId"`
}

type FavoriteToggleResponse struct {
	Favorited bool `json:"favorited"`
}

type ListDetailResponse struct {
	List         ListWithRelationsResponse `json:"list"`
	Tasks        []TaskResponse            `json:"tasks"`
	Dependencies []TaskDependencyResponse  `json:"dependencies"`
}
