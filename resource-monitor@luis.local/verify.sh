#!/usr/bin/env bash
# Confirm installed files/schema, parser tests, and active or queued state.
set -euo pipefail

uuid='resource-monitor@luis.local'
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
extensions_root="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions"
target="$extensions_root/$uuid"

for file in metadata.json extension.js metrics.js prefs.js stylesheet.css; do
    if ! cmp --silent "$script_dir/$file" "$target/$file"; then
        printf '%s\n' "Installed $file does not match the documented source package." >&2
        exit 1
    fi
done

schema='org.gnome.shell.extensions.resource-monitor.gschema.xml'
if ! cmp --silent "$script_dir/schemas/$schema" "$target/schemas/$schema"; then
    printf '%s\n' "Installed schema does not match the documented source package." >&2
    exit 1
fi

if [[ ! -f "$target/schemas/gschemas.compiled" ]]; then
    printf '%s\n' 'Installed schema cache is missing; run install.sh again.' >&2
    exit 1
fi

if ! glib-compile-schemas --strict --dry-run "$target/schemas"; then
    printf '%s\n' 'Installed schema does not compile cleanly.' >&2
    exit 1
fi

gjs -m "$script_dir/selftest.js" >/dev/null

info=$(gnome-extensions info "$uuid" 2>&1 || true)
state=$(sed -n 's/^State: //p' <<<"$info")

if [[ "$state" == 'ACTIVE' ]]; then
    printf '%s\n' "$uuid is active."
    exit 0
fi

if [[ -n "$state" ]]; then
    printf '%s\n' "Expected $uuid to be ACTIVE; actual state: $state" >&2
    exit 1
fi

enabled=$(gsettings get org.gnome.shell enabled-extensions)
if [[ "$enabled" == *"'$uuid'"* ]]; then
    printf '%s\n' "$uuid is queued to become active at the next GNOME login."
    exit 0
fi

printf '%s\n' "Expected $uuid to be ACTIVE or queued; actual state: not installed" >&2
exit 1
