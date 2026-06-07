#!/bin/bash
# Keep the terminal open on any error so the user can read the output
trap 'echo ""; echo "Something went wrong — see output above."; read -rp "Press Enter to close..."' ERR
set -e

cd "$(dirname "$0")"

# ── Node.js path resolution ───────────────────────────────────────────────────
# Desktop launchers may not inherit the full login-shell PATH, so we build it
# explicitly. nvm must come first so it beats any older system node.
NVM_BIN=""
if [ -d "$HOME/.nvm/versions/node" ]; then
  NVM_LATEST="$(ls "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)"
  if [ -n "$NVM_LATEST" ]; then
    NVM_BIN="$HOME/.nvm/versions/node/$NVM_LATEST/bin:"
  fi
fi
# Single export keeps nvm ahead of system paths
export PATH="${NVM_BIN}/usr/local/bin:/usr/bin:/opt/homebrew/bin:/snap/bin:$PATH"

# ── Check Node.js ────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed."
  echo "Install it from https://nodejs.org/ (version 20 or later)"
  read -rp "Press Enter to close..."
  exit 1
fi

# ── Install dependencies (first run only) ────────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies (this only happens once)..."
  npm install
  echo ""
fi

# ── Clear any leftover processes from a previous session ─────────────────────
kill_port() {
  local port="$1"
  # fuser (most Linux distros) or lsof (macOS / distros without fuser)
  fuser -k "${port}/tcp" 2>/dev/null || \
    { lsof -ti ":${port}" 2>/dev/null | xargs kill -9 2>/dev/null; } || \
    true
}
kill_port 3001
kill_port 5173
kill_port 5174
kill_port 5175
sleep 1

echo "Starting Cal2Work..."
echo ""

# ── Start the proxy server in background ─────────────────────────────────────
node server.mjs &
PROXY_PID=$!

# ── Open the browser when Vite reports its URL ───────────────────────────────
open_browser() {
  local url="$1"
  if command -v xdg-open &>/dev/null; then
    xdg-open "$url" 2>/dev/null
  elif command -v open &>/dev/null; then
    open "$url" 2>/dev/null
  fi
}

OPENED=false
npm run dev 2>&1 | while IFS= read -r line; do
  printf '%s\n' "$line"
  if [ "$OPENED" = false ]; then
    URL=$(printf '%s' "$line" | grep -oE 'http://localhost:[0-9]+' | head -1)
    if [ -n "$URL" ]; then
      OPENED=true
      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "  Open this URL in your browser:"
      echo "  $URL"
      echo "  Close this window to stop the app"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo ""
      open_browser "$URL"
    fi
  fi
done

# Vite exited — shut down the proxy too
kill $PROXY_PID 2>/dev/null

echo ""
read -rp "App has stopped. Press Enter to close this window..."
