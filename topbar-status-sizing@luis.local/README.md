# Top Bar Status Sizing

> **Superseded on 2026-11-04.** This extension was removed during the Fedora 45 /
> GNOME 51 upgrade because its `metadata.json` listed only shell version `"50"`. Its icon-size
> job is now done by Just Perfection's `panel-icon-size` key, and the clock weight by
> [`../panel-tweaks@luis.local/`](../panel-tweaks@luis.local/). The source is kept for history;
> do not reinstall it.

This small GNOME Shell 50 extension makes the top-right system status icons
approximately 15% larger and gives the battery percentage the same regular
font weight as the date and time.

## Exact changes

- Status icons change from 16px to 18.4px (16 × 1.15).
- The battery percentage label is targeted through GNOME Shell's
  `power-status` class and receives `font-weight: 400`.
- The selector affects top-bar system indicators only; app icons and the clock
  itself are not resized.

GNOME Shell reads this package's `stylesheet.css` after its own panel theme,
so it works independently of the current WhiteSur icon theme. It complements
the existing `topbar-clock@luis.local` extension, which already sets the
date/time label to weight 400.

## Install, verify, revert, or remove

```bash
./install.sh
./verify.sh
./revert.sh
./uninstall.sh
```

`revert.sh` disables the style but leaves the installed extension ready to be
enabled again. `uninstall.sh` disables it and moves the installed copy to a
timestamped archive at `~/.local/state/topbar-status-sizing/archives/`; it does
not delete that copy. In either case, log out and back in for Wayland GNOME
Shell to reload the styling.

If the extension is installed while the current Wayland session is already
running, GNOME discovers it at the next login. The installer records it as
enabled in advance, and `verify.sh` reports that queued state as successful.
