#!/usr/bin/env bash
# Install the GDM-only wallpaper, clock and cursor parity package.
set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
extension_name='gdm-background@luis.local'
wallpaper="${1:-${HOME}/Downloads/wpp.jpg}"
sigma="${SIGMA:-40}"
brightness="${BRIGHTNESS:-65}"

background_dir='/usr/local/share/backgrounds/luishowin'
extension_root='/usr/local/share/gnome-shell/extensions'
icons_root='/usr/local/share/icons'
cursor_source="${HOME}/.local/share/icons/WhiteSur-cursors"
cursor_name='WhiteSur-cursors'
dconf_file='/etc/dconf/db/gdm.d/20-luis-login-parity'

if [[ ! -f "$wallpaper" ]]; then
    printf 'Wallpaper not found: %s\n' "$wallpaper" >&2
    printf 'Pass a path as the first argument or put wpp.jpg in ~/Downloads.\n' >&2
    exit 1
fi

if [[ ! -d "$cursor_source" ]]; then
    printf 'Cursor theme not found: %s\n' "$cursor_source" >&2
    exit 1
fi

if command -v magick >/dev/null; then
    image_tool=magick
elif command -v convert >/dev/null; then
    image_tool=convert
else
    printf '%s\n' 'ImageMagick (magick or convert) is required.' >&2
    exit 1
fi

if ! command -v sudo >/dev/null; then
    printf '%s\n' 'sudo is required to install system-wide files and update GDM dconf.' >&2
    exit 1
fi

sudo -v

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# The session renders at 1920x1080 at scale 1.0.  Crop to 16:9 and keep the
# GDM copy close to the unlock dialog's effects: BLUR_RADIUS=90,
# BLUR_BRIGHTNESS=0.65.  A pre-rendered blur is required because GDM's login
# dialog does not create a background actor on which to put a live effect.
"$image_tool" "$wallpaper" \
    -auto-orient -resize '1920x1080^' -gravity center -extent 1920x1080 \
    -strip -quality 90 "$tmp/wpp.jpg"

"$image_tool" "$tmp/wpp.jpg" \
    -blur "0x${sigma}" -modulate "${brightness},100,100" \
    -strip -quality 90 "$tmp/wpp-blur.jpg"

sudo install -d -m 755 \
    "$background_dir" "$extension_root" "$icons_root" /etc/dconf/db/gdm.d

sudo install -m 644 "$tmp/wpp.jpg" "$background_dir/wpp.jpg"
sudo install -m 644 "$tmp/wpp-blur.jpg" "$background_dir/wpp-blur.jpg"

sudo rm -rf "$extension_root/$extension_name"
sudo cp -a "$script_dir/$extension_name" "$extension_root/"
sudo chmod -R a+rX "$extension_root/$extension_name"

sudo rm -rf "$icons_root/$cursor_name"
sudo cp -a "$cursor_source" "$icons_root/"
sudo chmod -R a+rX "$icons_root/$cursor_name"

sudo tee "$dconf_file" >/dev/null <<'EOF'
# Managed by ~/Documents/fedora-changes/gdm-login-parity/install.sh.
# See revert.sh to undo.  The legacy 10-luis-login-screen file still sets
# [org/gnome/login-screen] logo=''.
[org/gnome/shell]
enabled-extensions=['gdm-background@luis.local']

[org/gnome/desktop/interface]
clock-format='12h'
clock-show-weekday=true
cursor-theme='WhiteSur-cursors'
EOF

sudo dconf update

"$script_dir/verify.sh"

printf '\n%s\n' 'Installed the GDM login-screen parity package.'
printf '%s\n' 'Log out and back in to start a fresh greeter and see it.'
printf '%s\n' "Blur: sigma ${sigma}, brightness ${brightness}%. Override with SIGMA=... BRIGHTNESS=... ./install.sh"
