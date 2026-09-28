package dto

type UserResponse struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	Name      string  `json:"name"`
	Color     string  `json:"color"`
	AvatarURL *string `json:"avatarUrl"`
}
