#!/usr/bin/env bash
# Restore the icon theme active before this package was first enabled.
set -euo pipefail

state_root="${XDG_STATE_HOME:-$HOME/.local/state}/whitesur-system-status-custom"
previous_file="$state_root/previous-icon-theme"

if [[ ! -s "$previous_file" ]]; then
    printf '%s\n' "No saved previous icon theme was found at $previous_file; nothing was changed." >&2
    exit 1
fi

previous=$(<"$previous_file")
gsettings set org.gnome.desktop.interface icon-theme "$previous"
printf '%s\n' "Restored icon theme: $previous"
printf '%s\n' 'Log out and back in to make GNOME Shell reload the top-bar icons on Wayland.'
