#!/usr/bin/env bash
# Disable the extension while keeping it installed for an easy redo.
set -euo pipefail

uuid='panel-tweaks@luis.local'

if gnome-extensions info "$uuid" >/dev/null 2>&1; then
    gnome-extensions disable "$uuid"
fi

enabled=$(gsettings get org.gnome.shell enabled-extensions)
without_uuid=${enabled/"'$uuid', "/}
without_uuid=${without_uuid/", '$uuid'"/}
without_uuid=${without_uuid/"'$uuid'"/}
if [[ "$without_uuid" != "$enabled" ]]; then
    gsettings set org.gnome.shell enabled-extensions "$without_uuid"
fi

printf '%s\n' 'Disabled the panel typography override.'
printf '%s\n' 'Log out and back in to reload GNOME Shell styling on Wayland.'
