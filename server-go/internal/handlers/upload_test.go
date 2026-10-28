package handlers_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"open-clickup-server/internal/handlers"
)

func createFormFileWithHeader(w *multipart.Writer, fieldname, filename, contentType string) (io.Writer, error) {
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldname, filename))
	h.Set("Content-Type", contentType)
	return w.CreatePart(h)
}

func TestUploadImage(t *testing.T) {
	uploadDir := "./data/test_uploads"
	defer os.RemoveAll(uploadDir)

	h := handlers.NewUploadHandler(uploadDir)
	app := fiber.New(fiber.Config{
		BodyLimit: 20 * 1024 * 1024,
	})
	app.Post("/api/upload", h.Upload)

	t.Run("successful upload", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := createFormFileWithHeader(writer, "file", "sample.png", "image/png")
		require.NoError(t, err)
		_, err = io.Copy(part, bytes.NewReader([]byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")))
		require.NoError(t, err)
		writer.Close()

		req := httptest.NewRequest("POST", "/api/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var res handlers.UploadResponse
		err = json.NewDecoder(resp.Body).Decode(&res)
		require.NoError(t, err)
		assert.True(t, strings.HasPrefix(res.URL, "/uploads/img_"))
		assert.True(t, strings.HasSuffix(res.URL, ".png"))
		assert.True(t, res.Size > 0)
	})

	t.Run("file size exceeds 10MB limit", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := createFormFileWithHeader(writer, "file", "huge.png", "image/png")
		require.NoError(t, err)

		// Create a mock reader that reports > 10MB
		hugePayload := make([]byte, handlers.MaxUploadSize+1024)
		_, err = io.Copy(part, bytes.NewReader(hugePayload))
		require.NoError(t, err)
		writer.Close()

		req := httptest.NewRequest("POST", "/api/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		var res map[string]string
		err = json.NewDecoder(resp.Body).Decode(&res)
		require.NoError(t, err)
		assert.Equal(t, "File size exceeds 10MB limit", res["error"])
	})

	t.Run("unsupported mime type", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := createFormFileWithHeader(writer, "file", "sample.png", "application/pdf")
		require.NoError(t, err)
		_, err = io.Copy(part, bytes.NewReader([]byte("not actually an image")))
		require.NoError(t, err)
		writer.Close()

		req := httptest.NewRequest("POST", "/api/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("unsupported file extension", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := createFormFileWithHeader(writer, "file", "malicious.exe", "image/png")
		require.NoError(t, err)
		_, err = io.Copy(part, bytes.NewReader([]byte("not an image")))
		require.NoError(t, err)
		writer.Close()

		req := httptest.NewRequest("POST", "/api/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("missing file in form", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		writer.Close()

		req := httptest.NewRequest("POST", "/api/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}
