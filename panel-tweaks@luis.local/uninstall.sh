#!/usr/bin/env bash
# Disable the extension and archive the installed copy without deleting it.
set -euo pipefail

uuid='panel-tweaks@luis.local'
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
extensions_root="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions"
target="$extensions_root/$uuid"
state_root="${XDG_STATE_HOME:-$HOME/.local/state}/panel-tweaks"

"$script_dir/revert.sh"

if [[ -d "$target" ]]; then
    install -d "$state_root/archives"
    timestamp=$(date +%Y%m%d-%H%M%S)
    archive="$state_root/archives/$uuid-$timestamp"
    mv "$target" "$archive"
    printf '%s\n' "Archived the installed extension at $archive"
else
    printf '%s\n' "No installed extension was found at $target"
fi

printf '%s\n' 'The source package remains in the workspace; run install.sh to install it again.'
