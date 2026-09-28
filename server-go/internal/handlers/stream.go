package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"

	"open-clickup-server/internal/realtime"
)

func StreamHandler(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	c.Context().SetBodyStreamWriter(fasthttp.StreamWriter(func(w *bufio.Writer) {
		events, unsubscribe := realtime.DefaultHub.Subscribe()
		defer unsubscribe()

		// Initial connect message
		_, _ = fmt.Fprintf(w, ": connected\n\n")
		_ = w.Flush()

		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case e, ok := <-events:
				if !ok {
					return
				}
				data, err := json.Marshal(e)
				if err == nil {
					_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
					if err := w.Flush(); err != nil {
						return
					}
				}
			case <-ticker.C:
				_, _ = fmt.Fprintf(w, ": ping\n\n")
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	}))

	return nil
}
