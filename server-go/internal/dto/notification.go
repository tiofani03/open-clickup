package dto

type NotificationTaskMeta struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	ListID string `json:"listId"`
}

type NotificationItemResponse struct {
	ID        string                `json:"id"`
	Type      string                `json:"type"`
	Body      string                `json:"body"`
	Read      bool                  `json:"read"`
	CreatedAt string                `json:"createdAt"`
	Actor     *UserResponse         `json:"actor"`
	Task      *NotificationTaskMeta `json:"task"`
}

type NotificationsListResponse struct {
	Notifications []NotificationItemResponse `json:"notifications"`
	Unread        int                        `json:"unread"`
}

type MarkNotificationsReadRequest struct {
	IDs []string `json:"ids"`
}
