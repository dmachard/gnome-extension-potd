#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

UUID="potd-test@dmachard.dev"
TMP_DIR=$(mktemp -d -t gnome-test-XXXXXX)
EXT_DIR="$TMP_DIR/.local/share/gnome-shell/extensions/$UUID"

# Cleanup temporary folder on exit
trap 'rm -rf "$TMP_DIR"' EXIT

echo "[+] Setting up isolated test environment in $TMP_DIR ..."
mkdir -p "$EXT_DIR/schemas" "$TMP_DIR/.config"

# Copy extension files with isolated test UUID so host version is never picked up
cp extension.js prefs.js bing.js wikimedia.js spotlight.js overlay.js provider.js metadata.json "$EXT_DIR/"
cp -r icons "$EXT_DIR/"
sed -i "s/potd@dmachard.dev/$UUID/" "$EXT_DIR/metadata.json"
cp schemas/*.gschema.xml "$EXT_DIR/schemas/"

# Compile GSettings schemas in test directory
echo "[+] Compiling GSettings schemas..."
glib-compile-schemas "$EXT_DIR/schemas/"

echo "[+] Launching isolated nested GNOME Shell..."
echo "[i] Close the window to exit and clean up."

# Strip snap overrides (e.g. when launched from a snap terminal like VS Code)
unset GSETTINGS_SCHEMA_DIR GIO_MODULE_DIR
if [[ -n "${XDG_DATA_DIRS_VSCODE_SNAP_ORIG:-}" ]]; then
    export XDG_DATA_DIRS="$XDG_DATA_DIRS_VSCODE_SNAP_ORIG"
elif [[ -n "${XDG_DATA_DIRS:-}" ]]; then
    CLEAN_XDG_DATA_DIRS=$(printf '%s\n' "${XDG_DATA_DIRS//:/$'\n'}" | grep -v '/snap/' | paste -sd: - || true)
    export XDG_DATA_DIRS="${CLEAN_XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
fi

# Run nested GNOME Shell with isolated HOME/XDG and extension pre-enabled
HOME="$TMP_DIR" \
XDG_DATA_HOME="$TMP_DIR/.local/share" \
XDG_CONFIG_HOME="$TMP_DIR/.config" \
dbus-run-session bash -c "
    gsettings set org.gnome.shell disable-user-extensions false
    gsettings set org.gnome.shell enabled-extensions \"['$UUID']\"
    exec gnome-shell --devkit --wayland
"
