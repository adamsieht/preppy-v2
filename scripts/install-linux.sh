#!/usr/bin/env bash
# Preppy Linux installer — downloads the latest AppImage from GitHub and
# configures autostart in kiosk mode for Debian/Ubuntu/Raspberry Pi OS.
#
# Usage:
#   bash install-linux.sh
#   bash install-linux.sh --no-kiosk
#   bash install-linux.sh --token=ghp_...   (private repo)
#   bash install-linux.sh --install-dir=/custom/path
#
# Env vars (alternative to flags):
#   GITHUB_TOKEN  — PAT for private repos
#   REPO_OWNER    — default: adamsieht
#   REPO_NAME     — default: preppy-v2
#   INSTALL_DIR   — default: ~/.local/share/preppy

set -euo pipefail

# ── Defaults (overridable via env or flags) ───────────────────────────────────
REPO_OWNER="${REPO_OWNER:-adamsieht}"
REPO_NAME="${REPO_NAME:-preppy-v2}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/preppy}"
KIOSK=1

# ── Parse flags ───────────────────────────────────────────────────────────────
for arg in "$@"; do
    case "$arg" in
        --no-kiosk)          KIOSK=0 ;;
        --token=*)           GITHUB_TOKEN="${arg#*=}" ;;
        --repo=*)            IFS='/' read -r REPO_OWNER REPO_NAME <<< "${arg#*=}" ;;
        --install-dir=*)     INSTALL_DIR="${arg#*=}" ;;
        -h|--help)
            sed -n '2,20p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
    esac
done

echo ""
echo "=== Preppy Linux Installer ==="
echo ""

# ── Detect architecture ───────────────────────────────────────────────────────
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)         ASSET_ARCH="x64"   ;;
    aarch64|arm64)  ASSET_ARCH="arm64" ;;
    *)
        echo "ERROR: Unsupported architecture: $ARCH"
        echo "Supported: x86_64, aarch64"
        exit 1
        ;;
esac
echo "Architecture : $ARCH ($ASSET_ARCH)"

# ── Check dependencies ────────────────────────────────────────────────────────
for cmd in curl python3; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: Required command not found: $cmd"
        echo "Install with: sudo apt-get install $cmd"
        exit 1
    fi
done

# ── Fetch latest release from GitHub API ─────────────────────────────────────
echo "Fetching latest release..."

AUTH_HEADER=""
[ -n "$GITHUB_TOKEN" ] && AUTH_HEADER="Authorization: Bearer $GITHUB_TOKEN"

RELEASE_JSON=$(curl -fsSL \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "User-Agent: PrepyInstaller" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest")

# Parse version and download URL using Python 3 (always available on Debian/Ubuntu)
read -r VERSION DOWNLOAD_URL < <(python3 - "$ASSET_ARCH" <<'PYEOF'
import sys, json
arch = sys.argv[1]
data = json.load(sys.stdin)
version = data.get('tag_name', 'unknown')
assets = data.get('assets', [])
# Prefer arch-specific AppImage; fall back to any AppImage
url = next((a['browser_download_url'] for a in assets
            if a['name'].endswith('.AppImage') and arch in a['name']), '')
if not url:
    url = next((a['browser_download_url'] for a in assets
                if a['name'].endswith('.AppImage')), '')
print(version, url)
PYEOF
)

if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" = "None" ]; then
    echo "ERROR: No AppImage found for $ASSET_ARCH in the latest release."
    echo ""
    echo "Available assets:"
    python3 - <<PYEOF
import json, sys
data = json.loads('''$RELEASE_JSON''')
for a in data.get('assets', []):
    print("  -", a['name'])
PYEOF
    exit 1
fi

echo "Latest version : $VERSION"

# ── Download AppImage ─────────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
APP_FILE="$INSTALL_DIR/Preppy.AppImage"

echo "Downloading to $APP_FILE..."
curl -fL --progress-bar \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -o "$APP_FILE" \
    "$DOWNLOAD_URL"

chmod +x "$APP_FILE"
echo "Download complete."

# ── Configure autostart ───────────────────────────────────────────────────────
AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/preppy.desktop"
mkdir -p "$AUTOSTART_DIR"

EXEC_LINE="$APP_FILE"
[ "$KIOSK" = "1" ] && EXEC_LINE="$APP_FILE --kiosk"

cat > "$DESKTOP_FILE" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Preppy
Exec=$EXEC_LINE
X-GNOME-Autostart-enabled=true
Hidden=false
NoDisplay=false
Comment=Preppy Label Management System
DESKTOP

echo "Autostart configured at: $DESKTOP_FILE"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "=== Installation complete ==="
echo "App        : $APP_FILE"
echo "Autostart  : on login$([ "$KIOSK" = "1" ] && echo ' (kiosk mode)')"
echo ""
echo "To start now  : $EXEC_LINE"
echo "To uninstall  : rm '$DESKTOP_FILE' && rm -rf '$INSTALL_DIR'"
echo ""
