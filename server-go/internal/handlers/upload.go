package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const MaxUploadSize = 10 * 1024 * 1024

var allowedMIMETypes = map[string]bool{
	"image/png":     true,
	"image/jpeg":    true,
	"image/webp":    true,
	"image/gif":     true,
	"image/svg+xml": true,
}

var allowedExtensions = map[string]bool{
	".png":  true,
	".jpg":  true,
	".jpeg": true,
	".webp": true,
	".gif":  true,
	".svg":  true,
}

type UploadHandler struct {
	uploadDir string
}

func NewUploadHandler(uploadDir string) *UploadHandler {
	_ = os.MkdirAll(uploadDir, 0755)
	return &UploadHandler{uploadDir: uploadDir}
}

type UploadResponse struct {
	URL  string `json:"url"`
	Size int64  `json:"size"`
}

func (h *UploadHandler) Upload(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing file in form"})
	}

	if file.Size > MaxUploadSize {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "File size exceeds 10MB limit"})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExtensions[ext] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unsupported file format"})
	}

	mimeType := strings.ToLower(strings.TrimSpace(strings.Split(file.Header.Get("Content-Type"), ";")[0]))
	if !allowedMIMETypes[mimeType] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unsupported file format"})
	}

	newFilename := fmt.Sprintf("img_%s%s", uuid.New().String(), ext)
	dst := filepath.Join(h.uploadDir, newFilename)

	if err := c.SaveFile(file, dst); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save file"})
	}

	return c.JSON(UploadResponse{
		URL:  fmt.Sprintf("/uploads/%s", newFilename),
		Size: file.Size,
	})
}
