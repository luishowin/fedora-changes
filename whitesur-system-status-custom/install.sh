#!/usr/bin/env bash
# Install or refresh the personal icon theme, then make it active.
set -euo pipefail

theme_name='WhiteSur-System-Status-Custom'
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
data_root="${XDG_DATA_HOME:-$HOME/.local/share}"
target="$data_root/icons/$theme_name"

if ! command -v gsettings >/dev/null; then
    printf '%s\n' 'gsettings is required to activate the GNOME icon theme.' >&2
    exit 1
fi

install -d "$target"
cp -a "$script_dir/index.theme" "$script_dir/status" "$script_dir/SHA256SUMS" "$target/"

# Add padded 22x22 copies of the remaining GNOME panel indicators.  These are
# generated from the installed WhiteSur theme so no third-party artwork needs
# to live in this package.
"$script_dir/pad-status-icons.sh" "$target"

if command -v gtk4-update-icon-cache >/dev/null; then
    gtk4-update-icon-cache --force --ignore-theme-index "$target" || true
elif command -v gtk-update-icon-cache >/dev/null; then
    gtk-update-icon-cache --force --ignore-theme-index "$target" || true
fi

"$script_dir/activate.sh"
"$script_dir/verify.sh"

printf '\n%s\n' "Installed $theme_name at $target."
printf '%s\n' 'Log out and back in to make GNOME Shell reload the top-bar icons on Wayland.'
