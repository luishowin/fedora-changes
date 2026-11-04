# Panel Tweaks

A one-rule GNOME Shell extension for the top-bar date/time label.

## What it changes

- `#panel .panel-button.clock-display` and its `.clock` label move from the
  stock `font-weight: bold` (700) to `font-weight: 600`.
- Adwaita Sans ships a real SemiBold face, so this is not a synthetic weight.
- Nothing else is touched: no colour, size, spacing, icon sizing or date
  format.

The selector includes the unlock/login panel rules on purpose. Stock sets the
clock to bold there too, so the `!important` keeps the two clocks consistent.

## Icon size is not in this extension

The Wi-Fi, volume and battery icons are sized through Just Perfection's
existing `panel-icon-size` key:

```bash
gsettings set org.gnome.shell.extensions.just-perfection panel-icon-size 23
```

23 is the current value (2026-11-04), up from 18 via 21. It applies immediately
and needs no logout. The same key also sizes the power-profile and other panel
indicators; the leaf/bolt artwork and padded fallbacks are documented in
[`../2026-11-04-power-profile-icons.md`](../2026-11-04-power-profile-icons.md).
Set it back to 16 for stock.

## Install, verify, revert, or remove

```bash
./install.sh
./verify.sh
./revert.sh
./uninstall.sh
```

`revert.sh` disables the style but leaves the installed extension ready to be
enabled again. `uninstall.sh` disables it and moves the installed copy to a
timestamped archive at `~/.local/state/panel-tweaks/archives/`; it does not
delete that copy. In either case, log out and back in for Wayland GNOME Shell
to reload the styling.

If the extension is installed while the current Wayland session is already
running, GNOME discovers it at the next login. The installer records it as
enabled in advance, and `verify.sh` reports that queued state as successful.

## Why `shell-version` lists every release from 45 to 51

The previous `topbar-status-sizing@luis.local` extension listed only `"50"`,
so the Fedora 45 upgrade disabled it even though its CSS was still valid. This
package lists the whole range so a minor Shell upgrade does not repeat that.
Add `"52"` here when Fedora 46 arrives, after checking that the stock clock
still uses the `clock-display` class.
