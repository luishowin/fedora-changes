# Power profile icon — leaf, bolt, and a 23 px panel

**Live** as of 2026-11-04. Extends the icon-size half of
[Top bar and Control Center](2026-11-04-panel-and-control-center.md); the clock weight,
blur and corners there are unchanged.

The power-mode icon in the top-right was visibly larger than the Wi-Fi, volume and
battery icons. All three power profiles also drew the same gauge. The request was a
leaf in power-saver mode, a bolt in performance mode, and a panel icon size that
matched the rest of the status area — including indicators added in the future.

**Revised 2026-11-04:** the outline leaf was replaced with the supplied
`~/Downloads/leaf.svg` (21×32) and the panel size was raised from 21 to 23 px.

---

## Root cause

GNOME Shell's `PowerProfilesIndicator` binds the panel icon to the active profile's
symbolic name:

```js
'performance': {iconName: 'power-profile-performance-symbolic'},
'balanced':    {iconName: 'power-profile-balanced-symbolic'},
'power-saver': {iconName: 'power-profile-power-saver-symbolic'},
```

`WhiteSur-System-Status-Custom` overrides Wi-Fi, volume and battery with 22×22 SVGs
whose artwork occupies a 16×16 optical box. It does not ship `power-profile-*`, so
the lookup falls through to the base `WhiteSur` theme. WhiteSur's power-profile SVGs
are 16×16 and full-bleed.

Just Perfection renders every `.system-status-icon` at one `icon-size`:

```css
.just-perfection-api-panel-icon-size18 .system-status-icon,
.just-perfection-api-panel-icon-size18 .panel-button StIcon { icon-size: 18px; }
```

At 18 px, the 16-unit gauge spans the full 18 px width and about 16.9 px height,
while a 16-unit icon inside a 22×22 canvas fills only `16/22 × 18 ≈ 13.1 px`.
That is the whole size difference.

Measured alpha bounding boxes (render at the SVG's own canvas, then trim):

```bash
magick -background none <svg> -resize 22x22 -trim -format '%wx%h%O\n' info:
# custom Wi-Fi      16x11+3+6
# custom volume     16x12+3+5
# custom battery    22x12+0+5
# WhiteSur gauge    16x15+0+1   (at 16x16)
```

WhiteSur's three power-profile files are also effectively the same gauge with a
different needle, so the panel never showed which mode was active.

---

## What changed

### Leaf and bolt

Four new SVGs in `whitesur-system-status-custom/status/symbolic/`:

| mode | files | artwork |
|---|---|---|
| power saver | `power-profile-power-saver-{,-rtl-}symbolic.svg` | solid leaf from the supplied 21×32 SVG, fitted to a 16×16 optical box |
| performance | `power-profile-performance-{,-rtl-}symbolic.svg` | solid lightning bolt |

Both use a 22×22 canvas with the artwork inside a 16×16 optical box, `currentColor`
for the stroke/fill, and a mirrored RTL copy. The balanced profile is deliberately
left as WhiteSur's gauge: GNOME Shell hides the power-profile indicator in balanced
mode, so that icon is only used by the Quick Settings header and power-mode menu.

### Panel size

```bash
gsettings set org.gnome.shell.extensions.just-perfection panel-icon-size 23
```

23 px is **+27.8%** over the previous 18 px. The request started at +10%; 21 was
chosen first and then raised to 23 on the same day. Because Just Perfection's
selector is `.system-status-icon` and `.panel-button StIcon`, it applies to every
current and future panel indicator, not just the three original icons.

### Padded inherited icons

The rest of the GNOME 51 panel set is inherited from WhiteSur, where most SVGs are
16×16 and full-bleed. To keep those from looking oversized, the package now ships:

- `panel-status-icons.txt` — 41 panel indicator names: airplane, Bluetooth,
  brightness, night light, do-not-disturb, location, camera, microphone (four
  states), screen sharing/recording, Thunderbolt, wired/VPN/cellular network states,
  encrypted Wi-Fi, dark mode, keyboard, rotation lock, unsafe mode, dwell-click
  pointers, the accessibility menu and the `gnome-power-manager` fallback.
- `pad-status-icons.py` + `pad-status-icons.sh` — reads each name from the installed
  WhiteSur theme (falling back to GNOME Shell's `gnome-shell-icons.gresource` for
  `accessibility-menu-symbolic`), scales the source artwork into a 16×16 box and
  centres it on a 22×22 canvas. `install.sh` runs it; `verify.sh` runs it with
  `--check`.

No WhiteSur SVG is committed to this repository. The generated copies are derived
from the user's local theme at install time and tracked in
`~/.local/share/icons/WhiteSur-System-Status-Custom/.generated-status-icons` so a
re-run removes stale files before regenerating.

---

## Files

| | |
|---|---|
| `whitesur-system-status-custom/status/symbolic/power-profile-*` | four new leaf/bolt SVGs |
| `whitesur-system-status-custom/panel-status-icons.txt` | the 41-name padded fallback list |
| `whitesur-system-status-custom/pad-status-icons.{sh,py}` | generator and checker |
| `whitesur-system-status-custom/install.sh` | runs the generator before refreshing the icon cache |
| `whitesur-system-status-custom/verify.sh` | checks the generated set |
| `whitesur-system-status-custom/SHA256SUMS` | 73 → 77 entries |
| `org.gnome.shell.extensions.just-perfection panel-icon-size` | `18` → `23` |
| `~/.local/share/icons/WhiteSur-System-Status-Custom/` | installed theme with the new SVGs and generated fallbacks |

---

## Verification

```bash
gsettings get org.gnome.shell.extensions.just-perfection panel-icon-size
# 23

gsettings get org.gnome.desktop.interface icon-theme
# 'WhiteSur-System-Status-Custom'

cd ~/Documents/fedora-changes/whitesur-system-status-custom
./verify.sh
# checksum lines ... OK
# Padded status icons: 41 entries verified.

busctl --system get-property org.freedesktop.UPower.PowerProfiles \
  /org/freedesktop/UPower/PowerProfiles org.freedesktop.UPower.PowerProfiles ActiveProfile
# s "power-saver"
```

After logging out and back in:

- power-saver shows the supplied leaf;
- performance shows the solid bolt;
- balanced hides the indicator (stock behaviour);
- toggling night light, Bluetooth, airplane mode, screen sharing, etc. should show
  icons at the same optical size as Wi-Fi, volume and battery;
- Quick Settings power-mode icons should match the Wi-Fi menu icon's scale.

A GTK4 icon-theme lookup at 23 px already resolves
`power-profile-power-saver-symbolic` and `power-profile-performance-symbolic` to the
installed custom theme, and `power-profile-balanced-symbolic` to WhiteSur, which
confirms the files are in the lookup path even before the shell reloads them.

**Misleading check:** a clean journal does not prove the stylesheet or icon theme
matched anything. GNOME Shell caches icon lookups at login, so the new SVGs are not
visible until the next session. Verify visually after the logout.

To exercise the two other profiles without `powerprofilesctl`:

```bash
busctl --system set-property org.freedesktop.UPower.PowerProfiles \
  /org/freedesktop/UPower/PowerProfiles org.freedesktop.UPower.PowerProfiles \
  ActiveProfile s performance
# then back to power-saver
```

---

## Rollback

```bash
gsettings set org.gnome.shell.extensions.just-perfection panel-icon-size 18

theme=~/.local/share/icons/WhiteSur-System-Status-Custom
manifest="$theme/.generated-status-icons"
if [[ -s "$manifest" ]]; then
    (cd "$theme" && xargs -d '\n' rm -f < "$manifest")
fi
rm -f "$theme"/status/symbolic/power-profile-{power-saver,performance}{,-rtl}-symbolic.svg
rm -f "$manifest"
gtk4-update-icon-cache --force --ignore-theme-index "$theme"
```

Then log out and back in. The source package can be reverted with git; because
`install.sh` uses `cp -a`, it does not delete files that disappeared from the source,
so the explicit removal above is what actually restores the old lookup fallbacks.

---

## Known gaps

- **Quick Settings icons are smaller.** Menu icons are `1.091em` (about 16 px), so
  the 22×22 padded icons render about 27% smaller there than 16×16 fallbacks. The
  existing Wi-Fi, volume and battery overrides already had this behaviour.
- **A future GNOME indicator not in the list still falls back to 16×16.** Add its
  symbolic name to `panel-status-icons.txt` and re-run `install.sh`. The list covers
  the status indicators exposed by GNOME Shell 51.1 on this install.
- **RTL variants are authored for the leaf and bolt only.** The generated panel
  fallbacks use the LTR artwork.
- **23 px is +27.8%, not +10%.** Just Perfection's key is integer-only; 21 was
  briefly in place on the same day before the size was raised to 23.
- **WhiteSur updates do not propagate until reinstall.** The generated fallbacks are
  refreshed from the local WhiteSur copy every time `install.sh` runs.
