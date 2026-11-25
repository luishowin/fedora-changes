# Battery icon at full charge — green fill and bolt

**Live** as of 2026-11-25. Extends
[Power profile icon — leaf, bolt, and a 23 px panel](2026-11-04-power-profile-icons.md)
and the battery mapping in `whitesur-system-status-custom/README.md`.

While charging, the top-bar battery uses the custom outline-and-bolt design. The moment the
battery reported fully charged it switched to a plain white WhiteSur battery with a different
outline. The goal: keep the same custom icon at full charge, with a green fill and the bolt.

---

## Root cause

UPower reports `battery-level-100-charged-symbolic` for the `fully-charged` state, and GNOME
Shell uses that name verbatim. The theme only shipped the older name
`battery-full-charged-symbolic`, so the lookup fell through to the inherited `WhiteSur` theme.

```bash
gdbus call --system --dest org.freedesktop.UPower \
  --object-path /org/freedesktop/UPower/devices/battery_BAT0 \
  --method org.freedesktop.DBus.Properties.Get org.freedesktop.UPower.Device IconName
# (<'battery-level-100-charged-symbolic'>,)   <- when UPower State is 4 (fully-charged)

ls ~/.local/share/icons/WhiteSur-System-Status-Custom/status/symbolic/ | grep charged
# before: battery-full-charged-symbolic.svg only
```

---

## What changed

- New `battery-level-100-charged-symbolic.svg`: the 100 % charging artwork (split body, bolt
  cut-out, solid bolt) with the body fill switched from `currentColor` to `class="success"`.
  GTK/St recolours `success` to the shell's success colour (`#4e9a06`); `fill="#4e9a06"` is the
  fallback for viewers that do no recolouring.
- `battery-full-charged-symbolic.svg` (legacy name) replaced with the same artwork so older
  lookups match. It was a flat `#73d216` rectangle with no bolt.
- `SHA256SUMS`: 77 → 78 entries.

The outline and bolt still follow the panel foreground colour, so only the fill is green.

---

## Files

| | |
|---|---|
| `whitesur-system-status-custom/status/symbolic/battery-level-100-charged-symbolic.svg` | new |
| `whitesur-system-status-custom/status/symbolic/battery-full-charged-symbolic.svg` | replaced |
| `whitesur-system-status-custom/SHA256SUMS` | one new line, one hash updated |

---

## Verification

```bash
cd ~/Documents/fedora-changes/whitesur-system-status-custom
./install.sh && ./verify.sh
# all checksum lines OK, 41 padded icons verified
```

Then log out and back in (Wayland does not reload top-bar icons in place) and charge to 100 %
on AC. **Misleading check:** `gtk4-icon-browser` and a plain SVG viewer do not apply the
shell's recolouring, so the fill can look different there than in the top bar.

---

## Rollback

```bash
git revert <this commit>   # or: git apply -R battery-full-charged.patch
./install.sh
```

---

## Known gaps

- The 100 % charging and plugged-in icons are still white-filled; only the fully-charged state
  is green.
- The greeter keeps its own copy of the status icons. Re-run `gdm-login-parity/install.sh` to
  carry this change to the login screen. That re-run first exposed a copy bug in the overlay; see
  [`2026-11-25-gdm-icon-overlay-symlinks.md`](2026-11-25-gdm-icon-overlay-symlinks.md).
