package realtime

import (
	"sync"
)

type Event struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type Hub struct {
	mu      sync.RWMutex
	clients map[chan Event]struct{}
}

var DefaultHub = NewHub()

func NewHub() *Hub {
	return &Hub{
		clients: make(map[chan Event]struct{}),
	}
}

func (h *Hub) Subscribe() (chan Event, func()) {
	ch := make(chan Event, 64)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()

	unsubscribe := func() {
		h.mu.Lock()
		delete(h.clients, ch)
		h.mu.Unlock()
		close(ch)
	}

	return ch, unsubscribe
}

func (h *Hub) Broadcast(e Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for ch := range h.clients {
		select {
		case ch <- e:
		default:
			// Client channel full, skip to prevent stalling others
		}
	}
}
