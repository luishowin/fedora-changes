# Resource monitor — compact CPU, RAM, disk and network in the top bar

**Live** as of 2026-11-25. Installed in the user extensions directory; a new
extension is discovered at the next GNOME login on Wayland.

The top bar carried no ambient view of machine load. This adds one compact
panel group and a dropdown, without pulling in GTop, a system-monitor process,
or a background daemon.

```text
CPU 12% │ RAM 34% │ DISK 67% │ ↓1.2M ↑84K
```

---

## What changed

`resource-monitor@luis.local` adds a single `PanelMenu.Button` to the left edge
of the right-hand status area. The group shows four live readouts:

| readout | source | refresh |
|---|---|---|
| CPU | `/proc/stat` aggregate line | 1 s |
| RAM | `/proc/meminfo` (`MemTotal`, `MemAvailable`) | 1 s |
| storage | `Gio.File.query_filesystem_info` on `/` | 10 s |
| network | `/proc/net/route` + `/proc/net/dev` | 1 s |

The dropdown expands those into used/total values and adds a **Disks** section:
one row per mounted real block device, deduplicated by source. On this machine
that means one btrfs row for `/` and `/home`, plus `/boot`, `/boot/efi` and any
mounted removable drive. Drive rows are rebuilt on `Gio.VolumeMonitor` mount
signals and every 30 seconds, so removable media appears and disappears
without a restart.

### Settings

The Extensions app now shows a **Resource Monitor** preferences page with five
switches:

- CPU usage
- RAM usage
- Storage usage
- Network throughput
- Drive breakdown

Each switch hides that metric from both the panel and the dropdown. Disabled
metrics are also not sampled, so switching CPU or network off removes their
`/proc` reads until they are enabled again. Toggles apply immediately; no logout
is needed.

If every metric is switched off, the panel keeps a small `MON` placeholder. The
dropdown still has a **Settings** item, so the preferences remain reachable
without going through the Extensions app.

### Why no GTop and no shell commands

`gnome-system-monitor` and GTop give richer data, but they also add a library
dependency or a spawned process. The extension only performs small synchronous
reads of procfs plus `query_filesystem_info` for mounted filesystems. That is
well under a millisecond per tick on this machine, and the panel stays useful
even if the system monitor is not installed.

The one-second timer is shared by all four live metrics. Storage and drive
usage are slower-moving, so they are sampled less often from the same timer.

### Why storage uses `used / (used + free)`

On btrfs, `filesystem::size` includes space that is not available to files.
Dividing used by size reports 67% where `df` reports 70%, because `df` uses
`used / (used + available)`. The panel and menu follow `df` so the number agrees
with the tool used to check it.

### Why text rather than icons

The custom WhiteSur status icons are 22×22 SVGs with a 16×16 optical box, and
Just Perfection sizes every `.system-status-icon` at 23 px. Adding new symbolic
icons would need matching optical sizing; text labels inherit the panel font
and avoid that whole class of mismatch. Value labels reserve a fixed width and
use tabular figures so the panel does not jitter every second.

---

## Files

| | |
|---|---|
| `resource-monitor@luis.local/metadata.json` | extension UUID, name, Shell 45–51 |
| `resource-monitor@luis.local/extension.js` | panel item, timer, menu, drive list, visibility handling |
| `resource-monitor@luis.local/metrics.js` | pure procfs parsers and formatters |
| `resource-monitor@luis.local/prefs.js` | Extensions-app preferences page |
| `resource-monitor@luis.local/schemas/org.gnome.shell.extensions.resource-monitor.gschema.xml` | `show-*` keys |
| `resource-monitor@luis.local/stylesheet.css` | compact panel group, menu rows, `MON` placeholder |
| `resource-monitor@luis.local/selftest.js` | parser/formatting checks, run with `gjs -m` |
| `resource-monitor@luis.local/install.sh` | copy runtime files and enable/queue |
| `resource-monitor@luis.local/verify.sh` | compare installed files, run selftest, check state |
| `resource-monitor@luis.local/revert.sh` | disable while leaving files installed |
| `resource-monitor@luis.local/uninstall.sh` | disable and archive the installed copy |

---

## Install, verify, revert, or remove

```bash
./install.sh
./verify.sh
./revert.sh
./uninstall.sh
```

`revert.sh` disables the extension but leaves the installed copy ready to be
enabled again. `uninstall.sh` disables it and moves the installed copy to a
timestamped archive at `~/.local/state/resource-monitor/archives/`; it does not
delete that copy. In either case, log out and back in for Wayland GNOME Shell
to load or unload the extension.

`install.sh` copies `prefs.js` and the schema, then runs
`glib-compile-schemas --strict` in the installed `schemas/` directory. The
preferences window cannot open until that compiled schema exists.

If a zip is ever needed, `gnome-extensions pack` only includes `extension.js`,
`prefs.js`, `stylesheet.css` and `metadata.json` by default, and a schema must
be requested explicitly:

```bash
gnome-extensions pack \
  --extra-source=metrics.js \
  --schema=schemas/org.gnome.shell.extensions.resource-monitor.gschema.xml \
  resource-monitor@luis.local
```

---

## Verification

```bash
./resource-monitor@luis.local/install.sh
glib-compile-schemas --strict --dry-run \
  ~/.local/share/gnome-shell/extensions/resource-monitor@luis.local/schemas
gsettings --schemadir \
  ~/.local/share/gnome-shell/extensions/resource-monitor@luis.local/schemas \
  list-keys org.gnome.shell.extensions.resource-monitor
gjs -m resource-monitor@luis.local/selftest.js
./resource-monitor@luis.local/verify.sh
```

Open the preferences from the Extensions app or with:

```bash
gnome-extensions prefs resource-monitor@luis.local
```

Compare the panel and dropdown with:

```bash
top
free -h
df -h
cat /proc/net/dev
```

A new extension cannot load into an already-running Wayland Shell. `verify.sh`
accepts either `State: ACTIVE` or the UUID being present in
`org.gnome.shell enabled-extensions`; the latter means it will load at the next
login. After logging back in:

```bash
gnome-extensions info resource-monitor@luis.local
journalctl -b -o cat /usr/bin/gnome-shell | grep -i 'resource monitor'
```

The first command should report `State: ACTIVE`. The second should show no
extension errors.

---

## Rollback

```bash
./resource-monitor@luis.local/revert.sh
./resource-monitor@luis.local/uninstall.sh
```

`revert.sh` disables the extension and removes its UUID from
`org.gnome.shell enabled-extensions`. `uninstall.sh` also moves the installed
copy to `~/.local/state/resource-monitor/archives/` rather than deleting it.
Log out and back in to unload or reload the extension on Wayland.

---

## Known gaps

- No disk read/write throughput. Per the requested layout, “disk” is the
  per-drive space breakdown in the dropdown, not I/O activity.
- No per-core CPU view, process list, history graph, or threshold colours.
- Preferences cover visibility only. Refresh cadence, metric order and panel
  placement are still constants in `extension.js`.
- Storage on the panel is the root filesystem only. The dropdown lists every
  mounted real block device.
- Network is the default-route interface, not a sum of all interfaces. This
  avoids double-counting VPN traffic, at the cost of not showing a second
  interface's separate throughput.
