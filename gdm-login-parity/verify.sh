#!/usr/bin/env bash
# Verify the installed GDM login package.
set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
extension_name='gdm-background@luis.local'
background_dir='/usr/local/share/backgrounds/luishowin'
extension_dir="/usr/local/share/gnome-shell/extensions/$extension_name"
cursor_dir='/usr/local/share/icons/WhiteSur-cursors'
wallpaper_uri='file:///usr/local/share/backgrounds/luishowin/wpp.jpg'

fail=0
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

system_profile() {
    cat >"$tmp" <<'EOF'
system-db:gdm
system-db:local
system-db:site
system-db:distro
file-db:/usr/share/gdm/greeter-dconf-defaults
EOF
}

check_file() {
    if [[ ! -r "$1" ]]; then
        printf 'missing or unreadable: %s\n' "$1" >&2
        fail=1
    fi
}

check_grep() {
    if ! grep -q "$2" "$1" 2>/dev/null; then
        printf '%s does not contain %s\n' "$1" "$2" >&2
        fail=1
    fi
}

check_file "$background_dir/wpp.jpg"
check_file "$background_dir/wpp-blur.jpg"
check_file "$extension_dir/metadata.json"
check_file "$extension_dir/extension.js"
check_file "$extension_dir/stylesheet.css"
check_file "$cursor_dir/index.theme"

check_grep "$extension_dir/metadata.json" '"session-modes"[[:space:]]*:[[:space:]]*\["gdm"\]'
check_grep "$extension_dir/extension.js" 'BackgroundManager'
check_grep "$extension_dir/extension.js" 'gdm-login-clock'
check_grep "$extension_dir/extension.js" 'gdm-live-background'
check_grep "$extension_dir/stylesheet.css" 'wpp-blur'
check_grep "$extension_dir/stylesheet.css" 'login-dialog-prompt-entry'
check_grep "$extension_dir/stylesheet.css" 'gdm-login-clock-time'

if command -v magick >/dev/null; then
    for image in wpp.jpg wpp-blur.jpg; do
        dimensions=$(magick identify -format '%wx%h' "$background_dir/$image" 2>/dev/null || true)
        if [[ "$dimensions" != '1920x1080' ]]; then
            printf 'unexpected %s dimensions: %s (expected 1920x1080)\n' \
                "$image" "${dimensions:-unknown}" >&2
            fail=1
        fi
    done
fi

system_profile
enabled=$(DCONF_PROFILE="$tmp" dconf read /org/gnome/shell/enabled-extensions || true)
clock=$(DCONF_PROFILE="$tmp" dconf read /org/gnome/desktop/interface/clock-format || true)
weekday=$(DCONF_PROFILE="$tmp" dconf read /org/gnome/desktop/interface/clock-show-weekday || true)
cursor=$(DCONF_PROFILE="$tmp" dconf read /org/gnome/desktop/interface/cursor-theme || true)
accent=$(DCONF_PROFILE="$tmp" dconf read /org/gnome/desktop/interface/accent-color || true)
scheme=$(DCONF_PROFILE="$tmp" dconf read /org/gnome/desktop/interface/color-scheme || true)
background=$(DCONF_PROFILE="$tmp" dconf read /org/gnome/desktop/background/picture-uri || true)
background_dark=$(DCONF_PROFILE="$tmp" dconf read /org/gnome/desktop/background/picture-uri-dark || true)
background_options=$(DCONF_PROFILE="$tmp" dconf read /org/gnome/desktop/background/picture-options || true)
logo=$(DCONF_PROFILE="$tmp" dconf read /org/gnome/login-screen/logo || true)

case "$enabled" in
    *"$extension_name"*) ;;
    *)
        printf 'gdm enabled-extensions does not include %s: %s\n' \
            "$extension_name" "$enabled" >&2
        fail=1
        ;;
esac

if [[ "$clock" != "'12h'" ]]; then
    printf 'unexpected gdm clock-format: %s\n' "$clock" >&2
    fail=1
fi

if [[ "$weekday" != 'true' ]]; then
    printf 'unexpected gdm clock-show-weekday: %s\n' "$weekday" >&2
    fail=1
fi

if [[ "$cursor" != "'WhiteSur-cursors'" ]]; then
    printf 'unexpected gdm cursor-theme: %s\n' "$cursor" >&2
    fail=1
fi

if [[ "$accent" != "'slate'" ]]; then
    printf 'unexpected gdm accent-color: %s\n' "$accent" >&2
    fail=1
fi

if [[ "$scheme" != "'prefer-dark'" ]]; then
    printf 'unexpected gdm color-scheme: %s\n' "$scheme" >&2
    fail=1
fi

if [[ "$background" != "'$wallpaper_uri'" ]]; then
    printf 'unexpected gdm background picture-uri: %s\n' "$background" >&2
    fail=1
fi

if [[ "$background_dark" != "'$wallpaper_uri'" ]]; then
    printf 'unexpected gdm background picture-uri-dark: %s\n' "$background_dark" >&2
    fail=1
fi

if [[ "$background_options" != "'zoom'" ]]; then
    printf 'unexpected gdm background picture-options: %s\n' "$background_options" >&2
    fail=1
fi

if [[ "$logo" != "''" ]]; then
    printf 'note: gdm logo is %s (the legacy keyfile normally keeps it blank)\n' "$logo" >&2
fi

if (( fail != 0 )); then
    exit 1
fi

printf '%s\n' 'GDM login package verified.'
printf '  extension: %s\n' "$extension_name"
printf '  wallpaper: %s\n' "$background_dir/wpp.jpg"
printf '  fallback:  %s\n' "$background_dir/wpp-blur.jpg"
printf '  clock:     12h, weekday\n'
printf '  cursor:    WhiteSur-cursors\n'
printf '  accent:    slate\n'
printf '%s\n' 'Log out and back in to start a fresh greeter.'
