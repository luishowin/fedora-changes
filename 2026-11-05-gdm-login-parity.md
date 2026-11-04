# GDM login screen — wallpaper, clock and cursor parity

**Live** as of 2026-11-05. Supersedes the greeter half of
[Clock — macOS date/time spacing, and greeter parity](2026-09-12-clock-gap-and-greeter.md);
the session clock-gap notes there still stand.

The Super+L lock screen showed the desktop wallpaper with a dark blur and the
WhiteSur cursor. Logging out instead produced a flat, default-looking GDM
screen. The request was to bring the logout screen closer: the supplied
`~/Downloads/wpp.jpg` as its wallpaper, the 12-hour weekday clock, and the
WhiteSur cursor. The desktop and lock-screen wallpaper were deliberately left
alone, so the two screens share a treatment, not the same image.

---

## Root cause

The two screens are different programs:

| | Super+L lock screen | Logout / login screen |
|---|---|---|
| process | the running user session's GNOME Shell | `gnome-shell --mode=gdm` |
| user | `luishowin` | `gdm` |
| settings | the user dconf | the `gdm` dconf profile |
| home access | full | none — `/home/luishowin` is mode `700` |
| background | `UnlockDialog`'s blurred wallpaper actor | flat `#lockDialogGroup` |

The Shell creates desktop background actors in `LayoutManager._updateBackgrounds`,
but skips them for a greeter:

```js
if (Main.sessionMode.isGreeter)
    return Promise.resolve();
```

The lock screen works because `UnlockDialog` adds its own background:

```js
// unlockDialog.js
const BLUR_BRIGHTNESS = 0.65;
const BLUR_RADIUS = 90;

const widget = new St.Widget({
    style_class: 'screen-shield-background',
    effect: new Shell.BlurEffect({name: 'blur'}),
});
const bgManager = new Background.BackgroundManager({
    container: widget,
    monitorIndex,
    controlPosition: false,
});
```

The GDM `LoginDialog` has no equivalent. With no background actor, the only
thing painted is the shell theme's fallback:

```css
#lockDialogGroup {
    background-color: #222226;
}
```

That flat `#222226` is the bland login screen.

GDM cannot simply be pointed at the user's files either. `/home/luishowin` is
mode `700`, and the greeter runs as `gdm`. The only greeter keyfile on the
system before this change was:

```ini
# /etc/dconf/db/gdm.d/10-luis-login-screen
[org/gnome/login-screen]
logo=''
```

No background, theme, cursor or clock keys. The greeter therefore used Adwaita
defaults and the flat shell colour.

### The misleading `DCONF_PROFILE=gdm` check

The gdm dconf profile starts with:

```ini
user-db:user
system-db:gdm
...
```

Running this as the logged-in user:

```bash
DCONF_PROFILE=gdm dconf read /org/gnome/desktop/background/picture-uri
```

reads the **user's** database first, so it appears to show the user's wallpaper.
It does not show what the `gdm` user sees. Use a system-only profile:

```bash
cat >/tmp/gdm-only <<'EOF'
system-db:gdm
system-db:local
system-db:site
system-db:distro
file-db:/usr/share/gdm/greeter-dconf-defaults
EOF

DCONF_PROFILE=/tmp/gdm-only dconf dump /org/gnome/desktop/background/
# empty before this change
```

The new package's `verify.sh` uses that system-only profile.

---

## What changed

New package [`gdm-login-parity/`](../gdm-login-parity/):

- **`gdm-background@luis.local`** — a GDM-only extension with
  `"session-modes": ["gdm"]` and a one-rule stylesheet:

  ```css
  #lockDialogGroup {
      background-image: url("file:///usr/local/share/backgrounds/luishowin/wpp-blur.jpg");
      background-size: cover;
      background-color: #222226;
  }
  ```

- **Wallpaper** — `install.sh` crops `~/Downloads/wpp.jpg` to 1920×1080 and
  writes a clear copy plus a blurred copy at
  `/usr/local/share/backgrounds/luishowin/`. The blurred copy uses ImageMagick
  sigma **40** and brightness **65%**, the closest stand-in for the lock
  screen's `BLUR_RADIUS=90` / `BLUR_BRIGHTNESS=0.65`. Both are world-readable
  because GDM may run as a dynamic greeter user.
- **Cursor** — copies `~/.local/share/icons/WhiteSur-cursors` to
  `/usr/local/share/icons/`, where the gdm user can read it.
- **Clock** — sets the greeter to `clock-format='12h'` and
  `clock-show-weekday=true`.
- **dconf** — writes `/etc/dconf/db/gdm.d/20-luis-login-parity` with the
  extension UUID, clock keys and cursor-theme, then runs `dconf update`. The
  legacy `10-luis-login-screen` logo key is left untouched.

The extension is installed under `/usr/local/share/gnome-shell/extensions/`.
GDM's `XDG_DATA_DIRS` includes `/usr/local/share`, and the extension system
concatenates the greeter mode's (empty) extension list with the
`org.gnome.shell enabled-extensions` key from the gdm dconf. The
`"session-modes": ["gdm"]` metadata is what makes it eligible in this mode.

The desktop and Super+L wallpaper are **not** changed. The lock screen therefore
keeps the current desktop image; the login screen uses wpp.jpg.

---

## Files

| | |
|---|---|
| `gdm-login-parity/gdm-background@luis.local/` | GDM-only stylesheet extension |
| `gdm-login-parity/install.sh` | generates the images and installs the system files; needs sudo |
| `gdm-login-parity/verify.sh` | checks files and greeter dconf with a system-only profile |
| `gdm-login-parity/revert.sh` | removes the package; leaves the user wallpaper alone |
| `gdm-login-parity/uninstall.sh` | thin alias for `revert.sh` |
| `/usr/local/share/gnome-shell/extensions/gdm-background@luis.local/` | installed extension |
| `/usr/local/share/backgrounds/luishowin/wpp.jpg` | clear 1920×1080 copy |
| `/usr/local/share/backgrounds/luishowin/wpp-blur.jpg` | sigma-40, 65%-brightness GDM copy |
| `/usr/local/share/icons/WhiteSur-cursors/` | system cursor theme |
| `/etc/dconf/db/gdm.d/20-luis-login-parity` | greeter extension/clock/cursor keys |
| `~/Downloads/wpp.jpg` | source image; not committed to this repository |

---

## Verification

Run the package checker:

```bash
cd ~/Documents/fedora-changes/gdm-login-parity
./verify.sh
# GDM login-screen parity package verified.
```

Check the greeter values directly with a system-only profile:

```bash
cat >/tmp/gdm-only <<'EOF'
system-db:gdm
system-db:local
system-db:site
system-db:distro
file-db:/usr/share/gdm/greeter-dconf-defaults
EOF

DCONF_PROFILE=/tmp/gdm-only dconf read /org/gnome/shell/enabled-extensions
# ['gdm-background@luis.local']
DCONF_PROFILE=/tmp/gdm-only dconf read /org/gnome/desktop/interface/clock-format
# '12h'
DCONF_PROFILE=/tmp/gdm-only dconf read /org/gnome/desktop/interface/clock-show-weekday
# true
DCONF_PROFILE=/tmp/gdm-only dconf read /org/gnome/desktop/interface/cursor-theme
# 'WhiteSur-cursors'
```

Check the files:

```bash
magick identify -format '%wx%h\n' \
  /usr/local/share/backgrounds/luishowin/wpp-blur.jpg
# 1920x1080
ls /usr/local/share/gnome-shell/extensions/gdm-background@luis.local/
```

Log out and back in. The greeter is a fresh process; there is no need to restart
GDM, which would kill the session.

**Misleading check:** `DCONF_PROFILE=gdm dconf read ...` as the logged-in user
still shows the user's values, because the profile starts with `user-db:user`.
It says nothing about the greeter.

If the extension fails to load, the greeter still works and keeps the flat
`#222226` colour. Check the system journal after the logout:

```bash
journalctl -b -u gdm | grep -i gdm-background
```

---

## Rollback

```bash
cd ~/Documents/fedora-changes/gdm-login-parity
./revert.sh
```

This removes the dconf keyfile, extension, images and system cursor copy, then
runs `dconf update`. It does not touch the desktop or lock-screen wallpaper.
Log out and back in to return to the flat GDM background.

---

## Known gaps

- **The login layout is still GDM's.** The logout screen shows the user list /
  password prompt, not the lock screen's single-user unlock prompt and large
  clock. Only the background, clock format and cursor are aligned.
- **The wallpaper is GDM-only by choice.** Super+L keeps the desktop wallpaper,
  so the two screens do not show the same image. Setting
  `org.gnome.desktop.background picture-uri(-dark)` would align them, but that
  changes the desktop too.
- **The blur is pre-rendered.** The GDM login dialog has no background actor to
  attach a live `Shell.BlurEffect` to. If the source image changes, re-run
  `install.sh` with `SIGMA`/`BRIGHTNESS` overrides as needed.
- **GDM does not load the user's session extensions.** `panel-tweaks` and Blur
  My Shell are not available in the greeter; the GDM extension only supplies the
  background rule.
- **The login clock is the panel clock.** It now reads 12-hour time with a
  weekday, but it is not the lock screen's large `unlock-dialog-clock`.
- **World-readable assets.** `/usr/local/share` is readable by all local users.
  `wpp.jpg` is a forest wallpaper; if a personal image is used later, move it to
  a gdm-private location and update the stylesheet.
- **The source image is not in the repo.** The installed copies remain, but a
  reinstall needs `~/Downloads/wpp.jpg` (or a supplied path).
- **The cursor is a snapshot.** Updates to the user's WhiteSur-cursors require
  re-running `install.sh`.
- **`#lockDialogGroup` is a shell-theme implementation detail.** It is stable
  in GNOME Shell 51.1; a future theme could rename it.
