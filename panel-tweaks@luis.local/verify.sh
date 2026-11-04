#!/usr/bin/env bash
# Confirm that this extension is installed and active.
set -euo pipefail

uuid='panel-tweaks@luis.local'
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
extensions_root="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions"
target="$extensions_root/$uuid"

for file in metadata.json extension.js stylesheet.css; do
    if ! cmp --silent "$script_dir/$file" "$target/$file"; then
        printf '%s\n' "Installed $file does not match the documented source package." >&2
        exit 1
    fi
done

info=$(gnome-extensions info "$uuid" 2>&1 || true)
state=$(sed -n 's/^State: //p' <<<"$info")

if [[ "$state" == 'ACTIVE' ]]; then
    printf '%s\n' "$uuid is active."
    exit 0
fi

enabled=$(gsettings get org.gnome.shell enabled-extensions)
if [[ "$enabled" == *"'$uuid'"* ]]; then
    printf '%s\n' "$uuid is queued to become active at the next GNOME login."
    exit 0
fi

printf '%s\n' "Expected $uuid to be ACTIVE or queued; actual state: ${state:-not installed}" >&2
exit 1
