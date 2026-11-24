# Resource monitor settings — per-metric visibility toggles

**Live** as of 2026-11-25. Extends
[Resource monitor — compact CPU, RAM, disk and network in the top bar](2026-11-24-resource-monitor.md).

The panel group previously had a fixed set of readouts. This adds a schema-backed
preferences page so CPU, RAM, storage, network and the per-drive breakdown can
each be switched off without editing `extension.js`.

---

## What changed

### GSettings schema

`resource-monitor@luis.local/schemas/org.gnome.shell.extensions.resource-monitor.gschema.xml`
defines five booleans, all defaulting to `true`:

| key | controls |
|---|---|
| `show-cpu` | CPU panel readout and dropdown row |
| `show-memory` | RAM panel readout and dropdown row |
| `show-storage` | DISK panel readout and Storage dropdown row |
| `show-network` | download/upload panel readout and dropdown row |
| `show-disks` | per-drive section in the dropdown |

`metadata.json` now declares:

```json
"settings-schema": "org.gnome.shell.extensions.resource-monitor"
```

For a user extension, `getSettings()` looks for a compiled schema inside the
extension's own `schemas/` directory. The schema is not in the system schema
source, so `install.sh` copies it to the installed extension and runs:

```bash
glib-compile-schemas --strict "$target/schemas"
```

Without `gschemas.compiled`, the extension fails at `getSettings()` and the
preferences page cannot open.

### Preferences page

`prefs.js` builds an `Adw.PreferencesPage` with five `Adw.SwitchRow`s. Each row
is bound straight to its key with `Gio.SettingsBindFlags.DEFAULT`, so there is
no Apply button and no separate settings-reload path.

The prefs process imports the Shell's prefs base with the capitalised path:

```js
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
```

That is different from the extension-side `resource:///org/gnome/shell/...`
path.

### Live visibility

The extension keeps a record of each panel metric's box, separator and value
label, and each menu row's item and value label. A single `_applyVisibility()`
reads all five keys and:

- hides or shows panel boxes;
- recomputes separator visibility so no leading or doubled separator remains;
- hides the matching dropdown rows;
- hides the **Disks** header and section together;
- shows a `MON` placeholder when CPU, RAM, storage and network are all off.

A `changed` handler on the `Gio.Settings` object calls `_applyVisibility()` for
`show-*` keys. Toggles therefore take effect in the running Shell without a
logout.

Disabled metrics are also skipped by `_refresh()`: CPU and network stop reading
`/proc/stat` and `/proc/net/*`, storage stops querying the filesystem, and the
drive list stops polling `/proc/mounts`. When a metric is re-enabled:

- CPU and network samples are re-primed so there is no long-gap spike;
- memory and storage refresh immediately;
- drives refresh and rebuild immediately.

### Settings entry in the dropdown

The menu now ends with a **Settings** item that calls `this.openPreferences()`.
This keeps preferences reachable when the panel is showing only the `MON`
placeholder. The separator above it is hidden when there are no detail rows and
no disk section.

---

## Files

| | |
|---|---|
| `resource-monitor@luis.local/metadata.json` | adds `settings-schema` |
| `resource-monitor@luis.local/prefs.js` | five switch rows bound to the schema |
| `resource-monitor@luis.local/schemas/org.gnome.shell.extensions.resource-monitor.gschema.xml` | visibility keys |
| `resource-monitor@luis.local/extension.js` | live visibility, skipped sampling, Settings item |
| `resource-monitor@luis.local/stylesheet.css` | `MON` placeholder style |
| `resource-monitor@luis.local/install.sh` | copies prefs/schema and compiles it |
| `resource-monitor@luis.local/verify.sh` | checks prefs/schema and compiled cache |
| `resource-monitor@luis.local/README.md` | settings documentation |

---

## Verification

```bash
glib-compile-schemas --strict --dry-run \
  ~/.local/share/gnome-shell/extensions/resource-monitor@luis.local/schemas
gsettings --schemadir \
  ~/.local/share/gnome-shell/extensions/resource-monitor@luis.local/schemas \
  list-keys org.gnome.shell.extensions.resource-monitor
gjs -m resource-monitor@luis.local/selftest.js
./resource-monitor@luis.local/verify.sh
```

The key list is expected to contain `show-cpu`, `show-disks`, `show-memory`,
`show-network` and `show-storage`.

A nested headless Shell was used to exercise the live path: the extension
reached `State: ACTIVE`, every key was set to `false` and back to `true` while
running, all five were set to `false` together, and the keys were reset to their
defaults afterward. No JS, Clutter or disposal errors appeared in the Shell log.

After the next login, open:

```bash
gnome-extensions prefs resource-monitor@luis.local
```

or use the Extensions app, then toggle each switch and confirm the panel and
dropdown update immediately. No logout is needed for toggles; only the initial
extension/schema install needs one on Wayland.

---

## Rollback

Reset the toggles to their defaults:

```bash
dconf reset -f /org/gnome/shell/extensions/resource-monitor/
```

Disable or remove the extension:

```bash
./resource-monitor@luis.local/revert.sh
./resource-monitor@luis.local/uninstall.sh
```

`uninstall.sh` archives the installed extension, including its compiled schema.

---

## Known gaps

- Preferences control visibility only. Refresh cadence, metric order and panel
  placement remain constants in `extension.js`.
- The all-off `MON` placeholder is intentional; it keeps the dropdown and
  Settings entry reachable.
- The schema must be requested explicitly when packing a zip:

  ```bash
  gnome-extensions pack \
    --extra-source=metrics.js \
    --schema=schemas/org.gnome.shell.extensions.resource-monitor.gschema.xml \
    resource-monitor@luis.local
  ```
