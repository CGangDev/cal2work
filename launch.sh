#!/bin/bash
# Detects the available terminal emulator and opens start.sh inside it.
# This is called by the .desktop launcher.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START="$SCRIPT_DIR/start.sh"

if command -v gnome-terminal &>/dev/null; then
    gnome-terminal -- bash "$START"
elif command -v xfce4-terminal &>/dev/null; then
    xfce4-terminal --command="bash \"$START\""
elif command -v konsole &>/dev/null; then
    konsole -e bash "$START"
elif command -v mate-terminal &>/dev/null; then
    mate-terminal -e "bash \"$START\""
elif command -v xterm &>/dev/null; then
    xterm -e bash "$START"
else
    notify-send "Calendar Export" "No terminal emulator found. Install xterm: sudo apt install xterm" 2>/dev/null
    echo "No terminal emulator found. Install one with: sudo apt install xterm" >&2
    exit 1
fi
