#!/usr/bin/env bash
# Revert the active selection and archive the installed copy without deleting it.
set -euo pipefail

theme_name='WhiteSur-System-Status-Custom'
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
data_root="${XDG_DATA_HOME:-$HOME/.local/share}"
target="$data_root/icons/$theme_name"
state_root="${XDG_STATE_HOME:-$HOME/.local/state}/whitesur-system-status-custom"

current=$(gsettings get org.gnome.desktop.interface icon-theme)
current=${current#\'}
current=${current%\'}

if [[ "$current" == "$theme_name" ]]; then
    "$script_dir/revert.sh"
fi

if [[ -d "$target" ]]; then
    install -d "$state_root/archives"
    timestamp=$(date +%Y%m%d-%H%M%S)
    archive="$state_root/archives/$theme_name-$timestamp"
    mv "$target" "$archive"
    printf '%s\n' "Archived the installed theme at $archive"
else
    printf '%s\n' "No installed theme was found at $target"
fi

printf '%s\n' 'The source package remains in the workspace; run install.sh to install it again.'
