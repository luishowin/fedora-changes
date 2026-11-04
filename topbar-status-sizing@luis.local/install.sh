#!/usr/bin/env bash
# Install or refresh the extension, then enable it for the current GNOME user.
set -euo pipefail

uuid='topbar-status-sizing@luis.local'
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
extensions_root="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions"
target="$extensions_root/$uuid"

install -d "$target"
cp -a "$script_dir/metadata.json" "$script_dir/extension.js" "$script_dir/stylesheet.css" "$target/"

# A running Wayland shell does not discover an extension copied after login.
# Ask the extension manager to enable it when it already knows the UUID;
# otherwise record the UUID in GSettings so the next login loads it.
if gnome-extensions info "$uuid" >/dev/null 2>&1; then
    gnome-extensions enable "$uuid"
else
    enabled=$(gsettings get org.gnome.shell enabled-extensions)
    if [[ "$enabled" != *"'$uuid'"* ]]; then
        if [[ "$enabled" == '[]' ]]; then
            enabled="['$uuid']"
        else
            enabled="${enabled%]}, '$uuid']"
        fi
        gsettings set org.gnome.shell enabled-extensions "$enabled"
    fi
    printf '%s\n' "Queued $uuid to load at the next GNOME login."
fi
"$script_dir/verify.sh"

printf '%s\n' "Installed and enabled $uuid at $target."
printf '%s\n' 'Log out and back in to reload GNOME Shell styling on Wayland.'
