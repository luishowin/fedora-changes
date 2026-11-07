#!/usr/bin/env bash
# Remove the GDM login-screen parity package.  The user wallpaper is untouched.
set -euo pipefail

extension_name='gdm-background@luis.local'
background_dir='/usr/local/share/backgrounds/luishowin'
extension_root='/usr/local/share/gnome-shell/extensions'
icons_root='/usr/local/share/icons'
cursor_name='WhiteSur-cursors'
icon_name='WhiteSur-GDM'
dconf_file='/etc/dconf/db/gdm.d/20-luis-login-parity'

if ! command -v sudo >/dev/null; then
    printf '%s\n' 'sudo is required to remove the system-wide files.' >&2
    exit 1
fi

sudo -v

sudo rm -f "$dconf_file"
sudo rm -rf "$extension_root/$extension_name"
sudo rm -f "$background_dir/wpp.jpg" "$background_dir/wpp-blur.jpg"
sudo rmdir "$background_dir" 2>/dev/null || true
sudo rm -rf "$icons_root/$cursor_name"
sudo rm -rf "$icons_root/$icon_name"
sudo dconf update

printf '%s\n' 'Removed the GDM login-screen parity package.'
printf '%s\n' 'The desktop and lock-screen wallpaper were not changed.'
printf '%s\n' 'Log out and back in to return to the flat GDM background.'
