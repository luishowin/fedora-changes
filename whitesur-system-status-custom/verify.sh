#!/usr/bin/env bash
# Confirm that the installed copy exactly matches this documented package.
set -euo pipefail

theme_name='WhiteSur-System-Status-Custom'
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
data_root="${XDG_DATA_HOME:-$HOME/.local/share}"
target="$data_root/icons/$theme_name"

if [[ ! -d "$target" ]]; then
    printf '%s\n' "Theme is not installed: $target" >&2
    exit 1
fi

(
    cd "$target"
    sha256sum --check "$script_dir/SHA256SUMS"
)

current=$(gsettings get org.gnome.desktop.interface icon-theme)
current=${current#\'}
current=${current%\'}
printf '%s\n' "Active icon theme: $current"

if [[ "$current" != "$theme_name" ]]; then
    printf '%s\n' "The package is installed but not active. Run $script_dir/activate.sh to select it." >&2
    exit 1
fi
