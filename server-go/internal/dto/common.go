package dto

type ErrorResponse struct {
	Error string `json:"error"`
}

type OKResponse struct {
	OK    bool `json:"ok"`
	Count *int `json:"count,omitempty"`
}
