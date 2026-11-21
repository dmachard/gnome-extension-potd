#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Script to install the Picture of the day GNOME Shell extension

UUID="potd@dmachard.dev"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Install Picture of the day GNOME Shell extension"

# Create installation directories
mkdir -p "$INSTALL_DIR/schemas"

# Copy files
echo "Copying files to $INSTALL_DIR ..."
cp extension.js prefs.js bing.js wikimedia.js overlay.js provider.js metadata.json "$INSTALL_DIR/"
cp -r icons "$INSTALL_DIR/"

# Copy GSettings schemas
cp schemas/*.gschema.xml "$INSTALL_DIR/schemas/"

# Compile GSettings schemas
echo "Generating GSettings schemas ..."
glib-compile-schemas "$INSTALL_DIR/schemas/"

echo "Installation completed successfully!"
echo ""
echo "To activate the extension:"
echo "  1. Restart GNOME Shell (Alt+F2, then 'r' on X11) or disconnect/reconnect on Wayland"
echo "  2. Activate the extension with: gnome-extensions enable $UUID"
echo ""
echo "To open settings:"
echo "  gnome-extensions prefs $UUID"

