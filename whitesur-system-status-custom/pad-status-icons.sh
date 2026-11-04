#!/usr/bin/env bash
# Add 22x22 padded copies of the GNOME 51 panel icons to the installed theme.
set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v python3 >/dev/null; then
    printf '%s\n' 'python3 is required to pad the inherited status icons.' >&2
    exit 1
fi

exec python3 "$script_dir/pad-status-icons.py" \
    --list "$script_dir/panel-status-icons.txt" "$@"
