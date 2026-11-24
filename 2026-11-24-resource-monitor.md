# Resource monitor — compact CPU, RAM, disk and network in the top bar

**Live** as of 2026-11-24. Installed in the user extensions directory; a newly
installed extension is discovered at the next GNOME login on Wayland.

The top bar carried no ambient view of machine load. This adds one compact panel
group and a dropdown, without pulling in GTop, spawning a system-monitor process,
or adding a settings schema.

```text
CPU 12% │ RAM 34% │ DISK 67% │ ↓1.2M ↑84K
```

---

## What changed

`resource-monitor@luis.local` adds a single `PanelMenu.Button` at the left edge
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
signals and every 30 seconds, so removable media appears and disappears without
a restart.

### Why no GTop and no shell commands

`gnome-system-monitor` and GTop give richer data, but they also add a library
dependency or a spawned process. The extension only performs small synchronous
reads of procfs plus `query_filesystem_info` for mounted filesystems. That is
well under a millisecond per tick on this machine, and the panel stays useful
even if the system monitor is not installed.

The one-second timer is shared by all four live metrics. Storage and drive
usage move slowly, so they are sampled less often from the same timer.

### Why storage uses `used / (used + free)`

On btrfs, `filesystem::size` includes space that is not available to files.
Dividing used by size reports 67% where `df` reports about 70%, because `df`
uses `used / (used + available)`. The panel and menu use the `df` denominator
so the number agrees with the tool used to check it. The menu still shows the
full filesystem size as the right-hand total.

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
| `resource-monitor@luis.local/extension.js` | panel item, timer, menu, drive list |
| `resource-monitor@luis.local/metrics.js` | pure procfs parsers and formatters |
| `resource-monitor@luis.local/stylesheet.css` | compact panel group and menu rows |
| `resource-monitor@luis.local/selftest.js` | parser/formatting checks, run with `gjs -m` |
| `resource-monitor@luis.local/install.sh` | copy runtime files and enable/queue |
| `resource-monitor@luis.local/verify.sh` | compare installed files, run selftest, check state |
| `resource-monitor@luis.local/revert.sh` | disable while leaving files installed |
| `resource-monitor@luis.local/uninstall.sh` | disable and archive the installed copy |

---

## Verification

```bash
gjs -m resource-monitor@luis.local/selftest.js
./resource-monitor@luis.local/verify.sh
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
extension errors. A nested headless Shell smoke test was used during
development: the extension reaches `State: ACTIVE` and leaves no JS or disposal
errors in the journal when the Shell shuts down.

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
- No preferences schema. The metric set and refresh cadence are constants in
  `extension.js`; add a GSettings schema only if toggles are needed later.
- Storage on the panel is the root filesystem only. The dropdown lists every
  mounted real block device.
- Network is the default-route interface, not a sum of all interfaces. This
  avoids double-counting VPN traffic, at the cost of not showing a second
  interface's separate throughput.
