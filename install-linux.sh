#!/bin/bash
# Generates the .desktop launcher for this machine and optionally installs it
# to the application menu. Run once after cloning or moving the project.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Make scripts executable
chmod +x "$SCRIPT_DIR/start.sh" "$SCRIPT_DIR/launch.sh"

# Write .desktop file with the correct absolute path for this machine
cat > "$SCRIPT_DIR/Cal2Work.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Cal2Work
Comment=Browse and export calendar events to Outlook
Exec="$SCRIPT_DIR/launch.sh"
Icon=calendar
Terminal=false
Categories=Utility;Office;
StartupNotify=false
EOF

chmod +x "$SCRIPT_DIR/Cal2Work.desktop"
echo "Created: $SCRIPT_DIR/Cal2Work.desktop"

# Optionally add to the application menu
echo ""
read -rp "Add to your application menu (makes it searchable in GNOME/KDE/etc.)? [y/N] " add_to_menu
if [[ "${add_to_menu,,}" == "y" ]]; then
    mkdir -p "$HOME/.local/share/applications"
    cp "$SCRIPT_DIR/Cal2Work.desktop" "$HOME/.local/share/applications/cal2work.desktop"
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    echo "Added to application menu."
fi

echo ""
echo "Done. To launch the app, double-click 'Cal2Work.desktop'."
echo "If your file manager asks, choose 'Run' or 'Allow Launching'."
echo ""
echo "To trust it automatically on GNOME, run:"
echo "  gio set \"$SCRIPT_DIR/Cal2Work.desktop\" metadata::trusted true"
