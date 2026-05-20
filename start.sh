#!/bin/bash
# Keep the terminal open on any error so the user can read the output
trap 'echo ""; echo "Something went wrong — see output above."; read -rp "Press Enter to close..."' ERR
set -e

cd "$(dirname "$0")"

# Ensure common install locations are in PATH (gnome-terminal via .desktop
# launches a non-login shell that may not have the full user PATH).
# Prepend nvm's highest installed version so it wins over the system node.
NVM_NODE_BIN="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)/bin"
export PATH="$NVM_NODE_BIN:/usr/local/bin:/usr/bin:/snap/bin:$PATH"

# ── Check Node.js ────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed."
  echo "Install it with: sudo apt install nodejs npm"
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
fuser -k 3001/tcp 5173/tcp 5174/tcp 5175/tcp 2>/dev/null || true
sleep 1

echo "Starting Calendar Export..."
echo ""

# ── Start the proxy server in background ─────────────────────────────────────
node server.mjs &
PROXY_PID=$!

# ── Start Vite and watch its output for the URL ──────────────────────────────
# Rather than polling with curl, read Vite's stdout directly and open the
# browser the moment Vite prints its own "Local: http://..." line.
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
      xdg-open "$URL" 2>/dev/null || sensible-browser "$URL" 2>/dev/null || true
    fi
  fi
done

# Vite exited — shut down the proxy too
kill $PROXY_PID 2>/dev/null

echo ""
read -rp "App has stopped. Press Enter to close this window..."
