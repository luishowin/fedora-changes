# WhiteSur System Status Custom

This package changes the Wi-Fi, volume, battery and power-mode indicators in
GNOME Shell's top-right status area. It is designed for this Fedora 45 GNOME
51.1 Wayland session and uses the SVGs supplied in:

`/run/media/luishowin/MX500/Reference/System Tray Icons`

It is a separate user-level icon theme called `WhiteSur-System-Status-Custom`.
It inherits the active `WhiteSur` theme, so all icons outside these status
indicators continue to come from WhiteSur. No files under `/usr` are changed
and no administrator access is required.

## What was created

- `index.theme` defines the new theme and its `WhiteSur` fallback.
- `status/symbolic/` contains 72 renamed copies of the supplied SVGs plus four
  power-profile SVGs (the supplied leaf, the authored bolt and their RTL
  mirrors). The names are the ones GNOME Shell looks up for status indicators.
- `panel-status-icons.txt` lists the 41 remaining GNOME 51 panel indicators
  that are padded at install time from the installed WhiteSur theme.
- `pad-status-icons.sh` and `pad-status-icons.py` generate those padded
  fallbacks on a 22×22 canvas.
- `SHA256SUMS` records the expected contents of the files shipped in this
  package.
- `install.sh`, `activate.sh`, `verify.sh`, `revert.sh`, and `uninstall.sh`
  make the change repeatable and reversible.

The three supplied display/brightness assets are still not installed. Brightness
now uses a padded WhiteSur fallback from the generated panel set instead.

## Mapping policy

GNOME's current symbolic names do not match the supplied panel-style names, so
the package provides an explicit compatibility layer:

- Volume: `high`, `medium`, `low`, `muted`, and `muted-blocking` panel assets
  become GNOME's `audio-volume-*-symbolic` assets. High is also used for the
  overamplified state.
- Wi-Fi: 0/20/40/60/100 percent assets become none/weak/ok/good/excellent.
  The supplied acquiring, connected, hotspot, off, and disconnected assets
  cover the matching GNOME states. Encrypted Wi-Fi keeps the WhiteSur lock
  marker and is padded like the rest of the panel set.
- Battery: the supplied 0–100 percent assets (and charging equivalents) map to
  GNOME's `battery-level-*-symbolic`, charging, and plugged-in names. Semantic
  states such as empty, low, full, charged, caution, missing, and action use
  the corresponding supplied asset.
- Power mode: the power-saver and performance states use the supplied leaf and
  the authored bolt; balanced keeps WhiteSur's gauge because the panel hides the
  indicator in balanced mode and only Quick Settings uses it.

The authored SVGs use `currentColor`. The generated fallbacks keep the source
fills, which St recolours because every name ends in `-symbolic`.

## Activity record

The work documented here was performed on 20 October 2026:

1. Inspected the running desktop: Fedora 44 Workstation, GNOME Shell 50.5,
   Wayland, and the `WhiteSur` icon theme.
2. Inspected the supplied reference directory: 54 SVG files (30 battery, 17
   Wi-Fi, 5 volume, and 2 display assets).
3. Confirmed that the supplied files are valid SVG status-style assets using
   `currentColor`, but that their filenames are not the symbolic filenames
   requested by current GNOME Shell.
4. Created this derived icon theme with a `WhiteSur` fallback, copied the
   requested Wi-Fi, volume, and battery designs into 72 explicit symbolic
   mappings, and generated the checksum manifest.
5. Installation, activation, verification, rollback, and removal are carried
   out only by the scripts in this package. Their outcome is recorded below
   once installation has run.

### Installation result

Completed on 20 October 2026:

- Installed to `~/.local/share/icons/WhiteSur-System-Status-Custom`.
- Created the GTK icon cache successfully.
- Saved the prior selection (`WhiteSur`) at
  `~/.local/state/whitesur-system-status-custom/previous-icon-theme`.
- Activated `WhiteSur-System-Status-Custom` through GNOME Settings.
- Verified all 73 manifest entries (the theme index plus 72 SVG mappings) by
  SHA-256 after installation.

The only pending visual step is to log out and back in, which makes GNOME
Shell reload its top-bar icons in this Wayland session.

## Power-profile icons and the 23 px panel (current state)

The 20 October 2026 follow-up originally used
`../topbar-status-sizing@luis.local/` to make the icons 15% larger and set a
regular battery label weight. That extension was removed during the Fedora 45
upgrade: its metadata listed only shell version `"50"`, so GNOME 51 disabled
it and the directory was cleaned up.

The current configuration on Fedora 45 / GNOME Shell 51.1 is:

- **Icon size:** Just Perfection's `panel-icon-size` key is set to 23 (stock is
  16), up from 18 on 4 November. It applies immediately; no logout for the size
  alone.

  ```bash
  gsettings set org.gnome.shell.extensions.just-perfection panel-icon-size 23
  ```

- **Power mode:** power saver uses the supplied leaf and performance uses the
  solid bolt. Both sit on the same 22×22 canvas / 16×16 optical box as the rest
  of this theme. Balanced keeps WhiteSur's gauge; GNOME hides the panel
  indicator in balanced mode, so that icon is only used by Quick Settings.

- **Date/time weight:** `../panel-tweaks@luis.local/` sets the top-bar clock to
  weight 600 (stock bold is 700). The battery percentage now follows the same
  panel font; there is no separate 400-weight rule.

### Padded panel fallbacks

Most WhiteSur symbolic SVGs are 16×16 and full-bleed, while this theme's SVGs
are 22×22 with a 16×16 optical box. At one St `icon-size` the inherited icons
therefore look about a third larger. `install.sh` runs
`pad-status-icons.sh` to wrap the remaining GNOME 51 panel indicators in the
same 22×22 canvas. The names are listed in `panel-status-icons.txt`; the
artwork is read from the installed WhiteSur theme (and from GNOME Shell's
`gnome-shell-icons.gresource` for `accessibility-menu-symbolic`), so no
third-party SVG is committed here.

The generated files are tracked in
`~/.local/share/icons/WhiteSur-System-Status-Custom/.generated-status-icons`
and refreshed on every `install.sh` run. To add a newly appearing indicator,
add its symbolic name to `panel-status-icons.txt` and reinstall.

Full detail, verification and rollback are in
[`2026-11-04-power-profile-icons.md`](../2026-11-04-power-profile-icons.md).

## Install or refresh

From this directory, run:

```bash
./install.sh
```

This copies the package to
`~/.local/share/icons/WhiteSur-System-Status-Custom`, generates the padded
panel fallbacks from the installed WhiteSur theme, refreshes the icon cache,
saves the previously selected icon theme once at
`~/.local/state/whitesur-system-status-custom/previous-icon-theme`, selects the
new theme, and verifies the package and generated icons. Log out and back in
afterwards; a Wayland GNOME session does not support the old in-place Shell
restart shortcut.

Running `install.sh` again refreshes the installed files without replacing the
saved original theme, so it is safe to use after editing this package.

## Verify

```bash
./verify.sh
```

It verifies every installed package file against `SHA256SUMS`, runs
`pad-status-icons.sh --check` over the generated fallback set, and confirms
that the custom theme is active.

## Revert or remove

To switch immediately back to the saved icon theme while keeping the package
available for later use:

```bash
./revert.sh
```

To revert and remove the installed copy without destroying it:

```bash
./uninstall.sh
```

`uninstall.sh` moves the installed theme to a timestamped archive under
`~/.local/state/whitesur-system-status-custom/archives/`. The source package
remains here, so re-running `./install.sh` recreates the custom theme.

## Expected appearance and limits

The source icons replace the matching GNOME status states. An icon not named
in `panel-status-icons.txt` continues to use WhiteSur and keeps its 16×16
canvas, so it may look larger than the padded set; add the symbolic name and
reinstall when a new indicator appears. Quick Settings renders icons at
`1.091em`, so the 22×22 padded icons are about 27% smaller there than 16×16
fallbacks. Those are the trade-offs of matching the top bar's optical size.
