#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Detect Go binary
if command -v go >/dev/null 2>&1; then
    GO_CMD="go"
elif [ -x "$HOME/go/bin/go" ]; then
    GO_CMD="$HOME/go/bin/go"
    export GOROOT="$HOME/go"
    export GOPATH="${GOPATH:-$HOME/.go}"
elif [ -x "/usr/local/go/bin/go" ]; then
    GO_CMD="/usr/local/go/bin/go"
else
    echo "❌ Error: Go binary not found in PATH, \$HOME/go/bin/go, or /usr/local/go/bin/go."
    exit 1
fi

# 2. Detect package manager (pnpm preferred, fallback to npm)
if command -v pnpm >/dev/null 2>&1; then
    PKG_CMD="pnpm"
elif command -v npm >/dev/null 2>&1; then
    PKG_CMD="npm"
else
    echo "❌ Error: Neither pnpm nor npm found in PATH."
    exit 1
fi

echo "🚀 Starting Open ClickUp (Backend + Frontend)..."
echo "  • Go: $($GO_CMD version)"
echo "  • Package Manager: $PKG_CMD ($($PKG_CMD --version))"
echo "  • Press Ctrl+C to stop both services."
echo ""

# Graceful shutdown handler
cleanup() {
    echo -e "\n🛑 Stopping services..."
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    wait 2>/dev/null || true
    echo "👋 Done."
}
trap cleanup SIGINT SIGTERM EXIT

# 3. Start Go Backend
echo "📦 Starting Go backend on http://localhost:8080..."
(
    cd "$SCRIPT_DIR/server-go"
    PORT="${PORT:-8080}" "$GO_CMD" run ./cmd/server
) &
BACKEND_PID=$!

# Wait briefly for backend to initialize
sleep 1

# 4. Start Frontend
echo "💻 Starting Vite frontend on http://localhost:3000..."
"$PKG_CMD" dev &
FRONTEND_PID=$!

# Keep running until Ctrl+C
wait "$BACKEND_PID" "$FRONTEND_PID"
