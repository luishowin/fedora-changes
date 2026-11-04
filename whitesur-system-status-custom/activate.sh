#!/usr/bin/env bash
# Select the personal icon theme and preserve the previous selection once.
set -euo pipefail

theme_name='WhiteSur-System-Status-Custom'
state_root="${XDG_STATE_HOME:-$HOME/.local/state}/whitesur-system-status-custom"
previous_file="$state_root/previous-icon-theme"

if ! command -v gsettings >/dev/null; then
    printf '%s\n' 'gsettings is required to activate the GNOME icon theme.' >&2
    exit 1
fi

current=$(gsettings get org.gnome.desktop.interface icon-theme)
current=${current#\'}
current=${current%\'}

if [[ "$current" != "$theme_name" && ! -f "$previous_file" ]]; then
    install -d "$state_root"
    printf '%s\n' "$current" >"$previous_file"
fi

gsettings set org.gnome.desktop.interface icon-theme "$theme_name"
printf '%s\n' "Activated $theme_name."
