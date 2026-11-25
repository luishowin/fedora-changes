# GDM icon overlay — writing through WhiteSur symlinks

**Live** as of 2026-11-25. The corrected `install.sh` was re-run, the
`WhiteSur-GDM` theme rebuilt, and `verify.sh` passes with no status-icon drift.

Re-running the login-parity install to carry the green fully-charged battery to
the greeter reported success and verified — but the `WhiteSur-GDM` icon theme
came out wrong. 23 of the 77 custom status icons differed from the home theme:
`battery-full-symbolic.svg` held the green charged artwork,
`battery-level-10-charging-symbolic.svg` held the caution artwork, and the
power-saver/performance pair were swapped.

---

## Root cause

WhiteSur ships most status names in `status/symbolic` as **alias symlinks**, e.g.
`battery-level-100-charged-symbolic.svg -> battery-full-charging-symbolic.svg`
(390 of its 790 files are symlinks). `install.sh` builds `WhiteSur-GDM` by
copying that directory and then overlaying the custom theme:

```bash
cp -a "$icon_custom/status/symbolic/." "$icon_tmp/status/symbolic/"
```

`cp -a` follows an existing **destination** symlink, so every overlaid file whose
name was already a WhiteSur alias was written into the link's *target* instead of
replacing the link. 34 of the custom names collide with aliases. Where the target
is also a custom file, the two artworks clobber each other; the last copy wins.

```bash
ls -l /usr/local/share/icons/WhiteSur-GDM/status/symbolic/battery-full-charged-symbolic.svg
# ... -> battery-full-symbolic.svg          <- alias still a link
sha256sum /usr/local/share/icons/WhiteSur-GDM/status/symbolic/battery-full-symbolic.svg
# f4fffe7c...                              <- the green charged artwork, not the white "full" icon
```

`verify.sh` never noticed because it only checked that a handful of files
existed, not what they contained.

---

## What changed

- `gdm-login-parity/install.sh`: the overlay copy is now
  `cp -a --remove-destination ...`, which unlinks each alias and writes a
  regular file with the custom artwork. A comment records why.
- `gdm-login-parity/verify.sh`: after the existing checks it walks every SVG in
  the home theme's `status/symbolic` and fails if the GDM copy is a symlink or
  differs byte-for-byte.
- `gdm-login-parity/README.md`: the top-bar section and the verify description
  now say the overlay replaces alias links and that verification is
  content-based.

The custom theme itself is unchanged; no symlinks are added to the repo.

---

## Files

| | |
|---|---|
| `gdm-login-parity/install.sh` | overlay uses `--remove-destination` |
| `gdm-login-parity/verify.sh` | byte-for-byte status icon comparison |
| `gdm-login-parity/README.md` | documents the copy rule and the check |

---

## Verification

`verify.sh` flags the previously installed tree on both counts — every custom
name that is still an alias link, and every file whose bytes differ:

```bash
cd ~/Documents/fedora-changes/gdm-login-parity
./verify.sh
# status icon is a symlink: battery-level-100-charged-symbolic.svg -> ...
# status icon differs from the home theme: battery-full-symbolic.svg
# ... 34 symlink lines and 7 differ lines ...
```

23 of the 77 paths served the wrong artwork: 7 regular files directly and 16
more through alias links whose targets had been clobbered.

Prove the new copy rule in a scratch directory first (no sudo needed):

```bash
tmp=$(mktemp -d)
mkdir -p "$tmp/status"
cp -a ~/.local/share/icons/WhiteSur/status/symbolic "$tmp/status/"
cp -a --remove-destination \
  ~/.local/share/icons/WhiteSur-System-Status-Custom/status/symbolic/. \
  "$tmp/status/symbolic/"
cd ~/Documents/fedora-changes/whitesur-system-status-custom/status/symbolic
for f in *.svg; do
    [ -L "$tmp/status/symbolic/$f" ] && echo "STILL A LINK $f"
    cmp -s "$f" "$tmp/status/symbolic/$f" || echo "MISMATCH $f"
done
# no output: 0 mismatches, 0 remaining symlinks
```

After re-running `install.sh` the real theme is clean. The same loop pointed at
`/usr/local/share/icons/WhiteSur-GDM/status/symbolic` printed nothing, and
`./verify.sh` exited 0:

```bash
ls -l /usr/local/share/icons/WhiteSur-GDM/status/symbolic/battery-full-symbolic.svg
# -rwxrwxrwx ... battery-full-symbolic.svg        <- regular file, not a link
sha256sum /usr/local/share/icons/WhiteSur-GDM/status/symbolic/battery-full-symbolic.svg
# 8d57bab5...                                      <- the white "full" artwork
```

**Misleading check:** `install.sh` and `verify.sh` both succeeded while the icons
were corrupted. Success of the scripts, and the presence of each filename, say
nothing about the artwork behind it.

---

## Rollback

```bash
git revert <this commit>
cd gdm-login-parity && ./install.sh   # rebuilds the icon theme with the old copy rule
```

---

## Known gaps

- The repaired theme appears in the greeter only after logging out; the running
  user session is unaffected either way.
- WhiteSur aliases that do not collide with a custom name (for example
  `nm-signal-100-symbolic.svg` behind the Wi-Fi names) still resolve to the
  target the overlay rewrote. That is intended: the alias and the custom name
  describe the same artwork.
- `verify.sh` compares the GDM theme against the **installed** home theme, so it
  assumes `whitesur-system-status-custom/install.sh` has been run since the last
  theme change.
