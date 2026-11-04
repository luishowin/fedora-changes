# Fedora 45 upgrade — dead extensions, caches and stale state

**Live** as of 2026-11-04. Both the user-side and root-side cleanup have been executed.

**Revised 2026-11-04:** the first sudo pass named only the `kernel` meta-packages and was a
no-op; the full trap and corrected removal are in
[Cleanup follow-up](2026-11-04-cleanup-followup.md).

The F44 → F45 upgrade left the desktop working but the log describing it out of date. Two
extensions the README treated as live had been removed, their UUIDs were still in
`enabled-extensions`, and several tables pointed at directories that no longer exist. This entry
records the real post-upgrade state, the safe cleanup, and the leftovers that must **not** be
deleted.

---

## What the machine actually is

```bash
cat /etc/fedora-release                 # Fedora release 45 (Forty Five)
gnome-shell --version                   # GNOME Shell 51.1
uname -r                                # 7.2.15-300.fc45.x86_64
```

The 13-inch internal panel runs 1920×1080 at scale **1.0**, not fractional scaling. That is why
16 px status icons read as small: there is no 1.25× or 1.5× multiplier behind them.

---

## Dead extension UUIDs

`gnome-extensions list` and `gnome-extensions info` disagreed with `enabled-extensions`:

```bash
gsettings get org.gnome.shell enabled-extensions
# ... 'topbar-clock@luis.local', 'topbar-status-sizing@luis.local', ...
gnome-extensions info topbar-clock@luis.local
# Extension "topbar-clock@luis.local" doesn't exist
```

Their directories were gone from `~/.local/share/gnome-shell/extensions/`, so the UUIDs were
inert strings, not active extensions. They were removed while preserving the order of the other
seven. A fresh extension, `panel-tweaks@luis.local`, was then appended — see
[Top bar and Control Center](2026-11-04-panel-and-control-center.md).

`topbar-clock` and `topbar-status-sizing` are not being restored. Their metadata listed only
shell version `"50"`, which is why the F45 upgrade rejected them; the replacement extension
lists 45–51 instead.

---

## What was cleaned

User-level, executed:

| what | before | result |
|---|---|---|
| `~/.cache/libdnf5/` | 360 MB | removed |
| `~/.cache/gnome-software/` | 64 MB | removed |
| `~/.cache/thumbnails/` | 121 MB | removed |
| `~/.cache/flatpak/` | 7.6 MB | removed |
| `~/.cache/mesa_shader_cache/` | 6.0 MB | regenerates on demand |
| `~/.cache/radv_builtin_shaders/` | 2.5 MB | regenerates on demand |
| `~/.local/state/dnf5.log.*` | 4.8 MB | removed |

`~/.cache` went from 4.3 GB to 3.8 GB. The rest is Chrome (1.8 GB) and the Codex runtime
(1.7 GB); both are deliberately kept. Chrome's cache is disposable, but clearing it while Chrome
is running is pointless and it will re-download. The Codex directory is an app runtime, not a
stale log.

### The `.fc44` packages are mostly not leftovers

`rpm -qa | grep fc44` originally found 18 packages. After the old kernels were removed, eight
non-kernel `.fc44` packages remain, and most are required by `.fc45` binaries through their
sonames:

```bash
rpm -q --whatrequires 'libsimdutf.so.24()(64bit)'   # vte291, vte291-gtk4 (fc45)
rpm -q --whatrequires 'libzimg.so.2()(64bit)'       # ffmpeg-libs, mpv-libs, vapoursynth (fc45)
rpm -q --whatrequires 'libjsoncpp.so.26()(64bit)'   # cmake, openxr-libs (fc45)
```

Removing them would break working F45 packages. `ida` and `tubegrab` are applications, not
dependencies. Only the two old kernels are safe to drop.

### Root cleanup — executed

The first attempt targeted the `kernel` meta-packages and was a no-op: the F44 `kernel` packages
had already been removed, while their payload packages remained. Fedora splits a kernel into
`kernel-core`, `kernel-modules`, `kernel-modules-core` and `kernel-modules-extra`; the `kernel`
package is only a meta-package that requires them. The correct removal is:

```bash
# Confirm the running kernel is the F45 one first.
uname -r        # 7.2.15-300.fc45.x86_64

sudo dnf remove \
  kernel-core-7.2.13-200.fc44.x86_64 \
  kernel-modules-7.2.13-200.fc44.x86_64 \
  kernel-modules-core-7.2.13-200.fc44.x86_64 \
  kernel-modules-extra-7.2.13-200.fc44.x86_64 \
  kernel-core-7.2.14-200.fc44.x86_64 \
  kernel-modules-7.2.14-200.fc44.x86_64 \
  kernel-modules-core-7.2.14-200.fc44.x86_64 \
  kernel-modules-extra-7.2.14-200.fc44.x86_64

# The dnf5 daemon cache is not touched by `dnf clean all`.
sudo rm -rf /var/cache/dnf5daemon-server/*
```

Result:

| item | before | after |
|---|---|---|
| F44 kernel payload packages | 8 packages | none |
| `/usr/lib/modules/7.2.1{3,4}-200.fc44` | 340 MB | removed |
| `/boot/initramfs-7.2.1{3,4}-200.fc44.img` | 148 MB | removed |
| `/boot` usage | 609 MB | 402 MB |
| `/var/cache/dnf5daemon-server/` | 207 MB | 0 |

The other root commands were genuinely already clean:

- `flatpak uninstall --unused -y` → “Nothing unused to uninstall”. The remaining Platform 25.08
  / 26.08, GL, codecs and SDK branches are all referenced by VS Code, LocalSend or Spotifast.
- `dnf clean all` → removed 0 files; the dnf caches were already empty. The 207 MB daemon cache
  above was the actual remainder.
- `journalctl --vacuum-size=100M` → 98.3 MB, already under the target; freed 0.
- `/var/cache/swcatalog` and `/var/cache/fwupd` were already empty.

The 263 MB `initramfs-0-rescue-*.img` is left alone: deleting it saves space but leaves a GRUB
entry that cannot boot until the rescue image is regenerated.

---

## Files

| | |
|---|---|
| `org.gnome.shell enabled-extensions` | 9 UUIDs → 7 valid; the two dead ones removed |
| `~/.cache/` | six regenerable caches and the rotated dnf5 logs removed |
| `kernel-core-7.2.1{3,4}-200.fc44` + modules | eight payload packages and their initramfs removed |
| `/var/cache/dnf5daemon-server/` | 207 MB dnf5 daemon cache removed |
| `README.md` | version, index, live-state tables and "things that bite" corrected |
| `2026-09-12-clock-gap-and-greeter.md` | status changed to **retired** |
| `2026-09-12-nautilus-clipboard.md` | status changed to **retired** |

---

## Verification

```bash
gnome-extensions list --enabled
# 8 entries, no topbar-clock, no topbar-status-sizing, panel-tweaks present

gnome-extensions info topbar-clock@luis.local
# "doesn't exist" is the expected, correct answer now

du -sh ~/.cache
journalctl --disk-usage
rpm -q kernel-core          # -> only kernel-core-7.2.15-300.fc45.x86_64
ls -lh /boot/*.img          # -> rescue + fc45 only
df -h /boot                 # -> ~402 MB used
```

**Misleading check:** `gnome-extensions list` reads the directories the running Shell
enumerated at login; it does not prove the GSettings list is clean. Check both
`gnome-extensions list --enabled` and `gsettings get org.gnome.shell enabled-extensions`.

---

## Rollback

Cache removal is not reversible and needs no rollback. To restore a dead UUID, add it back to
`enabled-extensions` — but there is no directory behind it, so do not. The old F44 kernels are no
longer available from the F45 repositories, so that removal is not practically reversible; they
were only needed to boot an F44 userspace that no longer exists.

---

## Known gaps

- The 263 MB rescue initramfs is deliberately kept, as are Chrome's cache (~1.8 GB) and the Codex
  runtime (~1.7 GB). Only they and the eight legitimate `.fc44` dependency packages remain from
  the upgrade leftovers.
- The `LuisDark` shell theme, `~/.config/gdm-theme`, the Nautilus Python extensions and GPaste are
  all gone. Only their historical entries remain.
- There is no User Themes extension on F45, so `.themes` is a GTK3-only surface. Panel CSS now
  comes from `panel-tweaks@luis.local`.
