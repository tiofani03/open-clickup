package dto

type ReactionUserMeta struct {
	Name string `json:"name"`
}

type CommentReactionResponse struct {
	ID        string           `json:"id"`
	CommentID string           `json:"commentId"`
	UserID    string           `json:"userId"`
	Emoji     string           `json:"emoji"`
	User      ReactionUserMeta `json:"user"`
}

type CommentResponse struct {
	ID        string                    `json:"id"`
	TaskID    string                    `json:"taskId"`
	UserID    string                    `json:"userId"`
	Body      string                    `json:"body"`
	ParentID  *string                   `json:"parentId"`
	Resolved  bool                      `json:"resolved"`
	CreatedAt string                    `json:"createdAt"`
	UpdatedAt string                    `json:"updatedAt"`
	User      UserResponse              `json:"user"`
	Reactions []CommentReactionResponse `json:"reactions"`
}

type ReactionToggleResponse struct {
	Reacted bool `json:"reacted"`
}
