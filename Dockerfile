# syntax=docker/dockerfile:1
# Production image for Open ClickUp (Vite 8 + React 19 SPA + Go Fiber + PostgreSQL)

# --- Stage 1: Build Frontend (Vite SPA) ---
FROM node:22-alpine AS frontend-builder
RUN corepack enable && corepack prepare pnpm@10.6.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm build

# --- Stage 2: Build Backend (Go Fiber) ---
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app
COPY server-go/go.mod server-go/go.sum ./
RUN go mod download
COPY server-go/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/goserver ./cmd/server

# --- Stage 3: Minimal Production Runner ---
FROM alpine:3.21 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=frontend-builder /app/dist ./dist
COPY --from=backend-builder /app/goserver ./goserver

EXPOSE 3000
CMD ["/app/goserver"]
