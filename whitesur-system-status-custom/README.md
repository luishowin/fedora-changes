# WhiteSur System Status Custom

This package changes the Wi-Fi, volume, and battery indicators in GNOME Shell's
top-right status area. It is designed for this Fedora 45 GNOME 51.1 Wayland
session and uses the SVGs supplied in:

`/run/media/luishowin/MX500/Reference/System Tray Icons`

It is a separate user-level icon theme called `WhiteSur-System-Status-Custom`.
It inherits the active `WhiteSur` theme, so all icons outside these status
indicators continue to come from WhiteSur. No files under `/usr` are changed
and no administrator access is required.

## What was created

- `index.theme` defines the new theme and its `WhiteSur` fallback.
- `status/symbolic/` contains 72 renamed copies of the supplied SVGs. The
  names are the ones GNOME Shell 50 looks up for status indicators.
- `SHA256SUMS` records the expected contents of the package.
- `install.sh`, `activate.sh`, `verify.sh`, `revert.sh`, and `uninstall.sh`
  make the change repeatable and reversible.

The three supplied display/brightness assets are deliberately not installed:
they are not part of the requested top-right Wi-Fi, volume, and battery group.

## Mapping policy

GNOME's current symbolic names do not match the supplied panel-style names, so
the package provides an explicit compatibility layer:

- Volume: `high`, `medium`, `low`, `muted`, and `muted-blocking` panel assets
  become GNOME's `audio-volume-*-symbolic` assets. High is also used for the
  overamplified state.
- Wi-Fi: 0/20/40/60/100 percent assets become none/weak/ok/good/excellent.
  The supplied acquiring, connected, hotspot, off, and disconnected assets
  cover the matching GNOME states. Encrypted Wi-Fi deliberately falls back to
  WhiteSur so that its security marker is retained.
- Battery: the supplied 0–100 percent assets (and charging equivalents) map to
  GNOME's `battery-level-*-symbolic`, charging, and plugged-in names. Semantic
  states such as empty, low, full, charged, caution, missing, and action use
  the corresponding supplied asset.

All SVGs use `currentColor`, so GNOME Shell can apply the appropriate colour
for the top bar.

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

## Follow-up: larger status icons (current state)

The 20 October 2026 follow-up originally used
`../topbar-status-sizing@luis.local/` to make the icons 15% larger and set a
regular battery label weight. That extension was removed during the Fedora 45
upgrade: its metadata listed only shell version `"50"`, so GNOME 51 disabled
it and the directory was cleaned up.

The current configuration on Fedora 45 / GNOME Shell 51.1 is:

- **Icon size:** Just Perfection's `panel-icon-size` key is set to 18 (stock is
  16). It applies immediately and can be raised to 19 or 20 without a logout:

  ```bash
  gsettings set org.gnome.shell.extensions.just-perfection panel-icon-size 18
  ```

- **Date/time weight:** `../panel-tweaks@luis.local/` sets the top-bar clock to
  weight 600 (stock bold is 700). The battery percentage now follows the same
  panel font; there is no separate 400-weight rule.

The original SVG package is intentionally unchanged: GNOME Shell sets the
drawn icon size in its panel styling, so changing SVG dimensions would not
reliably change their on-screen size. The custom icon theme remains separate
and unaffected by either adjustment.

Full detail, verification and rollback are in
[`2026-11-04-panel-and-control-center.md`](../2026-11-04-panel-and-control-center.md).

## Install or refresh

From this directory, run:

```bash
./install.sh
```

This copies the package to
`~/.local/share/icons/WhiteSur-System-Status-Custom`, saves the previously
selected icon theme once at
`~/.local/state/whitesur-system-status-custom/previous-icon-theme`, selects the
new theme, and verifies checksums. Log out and back in afterwards; a Wayland
GNOME session does not support the old in-place Shell restart shortcut.

Running `install.sh` again refreshes the installed files without replacing the
saved original theme, so it is safe to use after editing this package.

## Verify

```bash
./verify.sh
```

It verifies every installed package file against `SHA256SUMS` and confirms that
the custom theme is active.

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

The source icons differ from the current WhiteSur files and will replace only
the matching GNOME status states. A shell or application icon that is not in
this package continues to use WhiteSur. GNOME's built-in Wi-Fi lock overlay is
purposely left to WhiteSur rather than being approximated by an unlocked asset.
