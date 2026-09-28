package dto

type ChecklistItemResponse struct {
	ID          string  `json:"id"`
	ChecklistID string  `json:"checklistId"`
	Name        string  `json:"name"`
	Resolved    bool    `json:"resolved"`
	Position    float64 `json:"position"`
}

type ChecklistResponse struct {
	ID       string                  `json:"id"`
	TaskID   string                  `json:"taskId"`
	Name     string                  `json:"name"`
	Position float64                 `json:"position"`
	Items    []ChecklistItemResponse `json:"items"`
}
