# GDM Login Parity

Makes the GDM logout/login screen look closer to the Super+L lock screen:
the supplied wallpaper behind the login dialog, the 12-hour weekday clock,
and the WhiteSur cursor. Built for Fedora 45 / GNOME Shell 51.1.

The package is intentionally scoped to GDM. It does **not** change the
desktop wallpaper, the lock-screen wallpaper, the GTK theme or the icon theme.

## Why the login screen is normally flat

The logout screen and the Super+L lock screen are different programs:

- Super+L locks the running user session. `UnlockDialog` creates a
  `Background.BackgroundManager` over `#lockDialogGroup` and applies a
  `Shell.BlurEffect` (`BLUR_RADIUS = 90`, `BLUR_BRIGHTNESS = 0.65`).
- Logging out starts the GDM greeter: a separate `gnome-shell --mode=gdm`
  process running as the `gdm` user with its own dconf profile.
- `layout.js` skips background creation for greeters, and `LoginDialog` does
  not create one. The shell theme therefore leaves `#lockDialogGroup` at its
  flat `#222226` colour.
- GDM cannot read the user's home directory (`/home/luishowin` is mode `700`),
  so the user's wallpaper and themes are unavailable even if its dconf pointed
  at them.

The fix is a small GDM-only extension whose stylesheet gives
`#lockDialogGroup` the pre-blurred wallpaper. GDM does load system extensions
from `/usr/local/share` when they are enabled in its own dconf and their
metadata declares `"session-modes": ["gdm"]`.

## What it installs

| path | purpose |
|---|---|
| `/usr/local/share/gnome-shell/extensions/gdm-background@luis.local/` | GDM-only stylesheet extension |
| `/usr/local/share/backgrounds/luishowin/wpp.jpg` | clear 1920×1080 copy of the source |
| `/usr/local/share/backgrounds/luishowin/wpp-blur.jpg` | sigma-40, 65%-brightness copy used by GDM |
| `/usr/local/share/icons/WhiteSur-cursors/` | system copy of the user's cursor theme |
| `/etc/dconf/db/gdm.d/20-luis-login-parity` | enables the extension; sets clock and cursor |

The greeter dconf block is:

```ini
[org/gnome/shell]
enabled-extensions=['gdm-background@luis.local']

[org/gnome/desktop/interface]
clock-format='12h'
clock-show-weekday=true
cursor-theme='WhiteSur-cursors'
```

The existing `/etc/dconf/db/gdm.d/10-luis-login-screen` is left alone; it still
sets `[org/gnome/login-screen] logo=''`.

## Install

The script writes to `/usr/local/share`, `/etc/dconf` and runs `dconf update`,
so it needs sudo. Run it as your user, not with `sudo ./install.sh`, so it can
read `~/Downloads/wpp.jpg` and `~/.local/share/icons/WhiteSur-cursors`:

```bash
cd ~/Documents/fedora-changes/gdm-login-parity
./install.sh
```

By default it reads `~/Downloads/wpp.jpg`. Pass another path as the first
argument, or override the image treatment:

```bash
./install.sh ~/Pictures/login.jpg
SIGMA=60 BRIGHTNESS=65 ./install.sh
```

`SIGMA` is the ImageMagick Gaussian sigma, not the Clutter blur radius. The
default 40 is the closest reasonable stand-in for the lock screen's radius-90
blur without turning the image into a flat gradient. The source is cropped to
1920×1080; the display is 1920×1080 at scale 1.0.

## Verify

```bash
./verify.sh
```

It checks the extension, both wallpaper copies, the cursor theme, and the
greeter dconf values using a **system-only** dconf profile. It does not need
sudo.

Log out and back in after installing. The greeter is started fresh at logout;
there is no need to restart GDM (which would kill the session).

**Misleading check:** do not verify with

```bash
DCONF_PROFILE=gdm dconf read /org/gnome/desktop/interface/clock-format
```

as your user. The gdm profile starts with `user-db:user`, so that command reads
your user database, not the greeter's. Use `DCONF_PROFILE=/tmp/gdm-only` with
only the system databases, as `verify.sh` does.

## Revert

```bash
./revert.sh
```

`./uninstall.sh` is a thin alias for the same operation.

It removes the dconf keyfile, extension, images and system cursor copy, then
runs `dconf update`. The desktop and lock-screen wallpaper are untouched. Log
out and back in to return to the flat `#222226` GDM background.

## Known gaps

- The login screen still uses GDM's user-list/password layout. It will not
  become the single-user unlock prompt with the large clock.
- The GDM clock is the panel clock, not the lock screen's `unlock-dialog-clock`.
  It now reads 12-hour time with a weekday, but the layout differs.
- The blur is pre-rendered. If the source wallpaper changes, re-run
  `install.sh`; GDM has no live background actor to attach an effect to.
- GDM does not load the user's session extensions (`panel-tweaks`, Blur My
  Shell). Only the GDM-only extension's stylesheet applies.
- The wallpaper and cursor theme are world-readable under `/usr/local/share`.
  `wpp.jpg` is a forest wallpaper rather than a personal photo; if that
  changes, move the image to a gdm-private path and update the stylesheet.
- The source image is not committed to this repository. The installed copies
  remain if `~/Downloads/wpp.jpg` is deleted; re-running the installer then
  needs the source again.
- The cursor theme is a system-wide copy. Changes to
  `~/.local/share/icons/WhiteSur-cursors` require re-running `install.sh`.
- The `#lockDialogGroup` selector is stable in GNOME Shell 51.1. A future
  shell theme could rename it; `verify.sh` will still pass because it checks
  the files, not the rendered pixels.
