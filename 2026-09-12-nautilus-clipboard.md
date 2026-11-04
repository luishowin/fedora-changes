# Nautilus "Copy Path" — in-process clipboard + GPaste

**Retired** as of 2026-11-04. `gpaste` and `nautilus-python` are no longer installed on this
machine after the Fedora 45 upgrade, so the extension and daemon are gone. The entry is kept for
the in-process clipboard / GPaste root-cause notes.

Right-clicking a file → **Copy Path** copied correctly but left two artefacts: a grey cog
appeared in the dock, and the context menu refused to dismiss. Both cleared together on the
next click anywhere.

---

## Root cause

One mechanism, two symptoms. The custom menu shelled out to `wl-copy`:

```python
subprocess.Popen(["wl-copy"], stdin=subprocess.PIPE,
                 start_new_session=True).communicate(text.encode())
```

On Wayland only a **focused** client may claim the clipboard — `wl_data_device.set_selection`
must carry a serial from a real input event. The escape hatch is the `wlr-data-control` /
`ext-data-control` protocol, which lets a windowless client set the selection. `wl-copy`
supports both; all eight interfaces are in the binary. **Mutter implements neither:**

```bash
strings /usr/lib64/libmutter-18.so.0 | grep data_control    # returns nothing
```

That is deliberate, not an oversight — the protocol would let any background client read every
password you copy.

So `wl-copy` falls back to `xdg_wm_base` / `xdg_toplevel` / `wl_compositor` / `wl_shm`, plus
`get_gtk_surface` and `request_focus` from Mutter's private `gtk_shell1`. **It creates a real
toplevel window and explicitly steals focus** purely to earn the right to set the clipboard.

| symptom | why |
|---|---|
| cog in the dock | the window's `app_id` is `io.github.bugaevc.wl-clipboard`, and no matching `.desktop` exists. GNOME Shell's window tracker can't resolve it to an app, so it synthesises a window-backed app with the generic `application-x-executable` icon — a grey cog that reads as "Settings". Dash to Dock shows it. |
| menu won't dismiss | `communicate()` blocks Nautilus's main thread until `wl-copy` exits, and per `man wl-copy` it forks into the background only **after** acquiring the selection. Nautilus is frozen through the whole create-surface → steal-focus → set-selection sequence. Mutter sends `xdg_popup.popup_done` the instant focus leaves, but the event loop can't process it. |

The next click is what lets Nautilus drain that pending event while the Shell re-evaluates the
now-gone window — which is why both cleared at the same moment.

The bug predated the menu items added on 2026-09-04; the same code is in `custom_menu.py.bak`.

---

## What changed

### 1. `copy_to_clipboard` — set the selection in-process

Nautilus is *already* a focused Wayland client with a live data device; spawning a second one
was never necessary. This is exactly how Nautilus does its own Copy
(`nm -D /usr/bin/nautilus` → `gdk_clipboard_set_content`).

```python
def copy_to_clipboard(self, text):
    display = Gdk.Display.get_default()
    if not display:
        return

    provider = Gdk.ContentProvider.new_for_value(GObject.Value(str, text))
    display.get_clipboard().set_content(provider)
```

The serial requirement is satisfied rather than faked: the click that activated the menu item
*is* the input event, and GDK attaches its serial automatically. Same rule is why a background
daemon cannot do this, and why `wl-copy` had to manufacture a window — it had no input event of
its own to point at.

### 2. `copy_sha256` — async, no shell pipeline

The old version piped through `sh -c '... | wl-copy'`, carrying the same defect. Hashing still
happens out of process (it must never block the main thread), but the digest now returns on the
main loop via `Gio.Subprocess` + `communicate_utf8_async`, and the clipboard set is in-process.

Side benefit: `Gio.Subprocess` installs a child watch and reaps the process. The old detached
`Popen` was never `wait()`ed, so every SHA-256 left a zombie until CPython's GC happened to poll.

`analyze_disk_usage` was left alone — `baobab` has a real `.desktop`, so it shows its own icon.

### 3. GPaste, for persistence

The in-process clipboard is owned by Nautilus, so a copied path dies when the last window
closes — identical to Nautilus's native <kbd>Ctrl</kbd>+<kbd>C</kbd>. Nothing was preserving it.

A plain daemon cannot fix this on GNOME: with `data-control` withheld, a windowless background
process can neither read nor re-own the selection. But Mutter exposes `meta_selection_set_owner`
and `meta_selection_source_memory_new` to code running **inside** the Shell, so a Shell extension
can re-claim the clipboard after the owning app exits. Hence GPaste ships both halves, and both
are required:

```bash
sudo dnf install gpaste gnome-shell-extension-gpaste     # 50.6, matches gnome-shell 50.4
```

`gnome-extensions enable` will not work — the running Shell enumerated extensions at startup and
does not know the UUID. Write the key directly instead, as a **single standalone command, never
chained with `&&`**, appending to the existing list:

```bash
gsettings set org.gnome.shell enabled-extensions "[... , 'GPaste@gnome-shell-extensions.gnome.org']"
```

Then **log out and back in**. Wayland has no Shell restart. The daemon is D-Bus- and
systemd-activated (`org.gnome.GPaste.service`); the extension starts it, so no manual
`systemctl --user enable` is needed.

---

## Two traps in the GTK4 clipboard API

Both verified by introspection on this machine, both easy to get wrong:

| trap | reality |
|---|---|
| `gi.require_version("Gdk", "4.0")` looks optional | **It is mandatory.** `Gdk-3.0.typelib` is installed alongside 4.0; letting PyGObject pick risks pulling GTK3 symbols into a GTK4 process. |
| `Gdk.Clipboard.set_text` looks like the obvious call | Not introspectable — it does not exist from Python. |
| `Gdk.Clipboard.set` passes `hasattr` | It is the inherited `GObject.set()` **property setter**, not a clipboard API. |

The working route is `set_content(Gdk.ContentProvider.new_for_value(GObject.Value(str, …)))`,
which reports format `gchararray` and serialises to `text/plain;charset=utf-8`.

---

## Files

| | |
|---|---|
| `~/.local/share/nautilus-python/extensions/custom_menu.py` | the change |
| `~/.config/nautilus/custom_menu.py.pre-clipboard-fix` | rollback copy (4-item menu, pre-fix) |
| `~/.local/share/nautilus-python/extensions/custom_menu.py.bak` | **untouched** — the original 2-item file that `revert-tweaks.sh` restores |

`~/.config/nautilus/revert-tweaks.sh` is *not* a rollback for this change: its line 17 restores
`custom_menu.py.bak`, which predates the 2026-09-04 menu items entirely.

---

## Verification

```bash
rm -rf ~/.local/share/nautilus-python/extensions/__pycache__
nautilus -q
```

Relaunch, wait a moment — extensions load *after* window creation, so checking immediately gives
a false negative — then right-click a file:

- All four items present. A Python error makes nautilus-python drop the **entire** extension, so
  missing items mean a syntax/import failure, not a partial one.
- **Copy Path** → menu closes immediately, no cog in the dock.
- `pgrep -a wl-copy` → nothing. Confirms no second Wayland client was spawned.

Confirm the module was actually imported (bytecode is regenerated on load):

```bash
ls -la ~/.local/share/nautilus-python/extensions/__pycache__/
journalctl --user -b _COMM=nautilus | tail -40      # tracebacks land here
```

**Do not verify with `wl-paste`.** It hits the identical missing-`data-control` fallback and
spawns its own focus-stealing surface — reintroducing the exact cog being removed. Paste into a
text field, or once GPaste is live use the D-Bus route, which needs no Wayland surface:

```bash
gpaste-client history | head -3
```

After the re-login:

```bash
gnome-extensions info GPaste@gnome-shell-extensions.gnome.org   # expect State: ACTIVE
systemctl --user status org.gnome.GPaste.service
```

End-to-end: Copy Path → close every Nautilus window → paste elsewhere. The path survives, which
it would not have before.

---

## Rollback

```bash
cp ~/.config/nautilus/custom_menu.py.pre-clipboard-fix \
   ~/.local/share/nautilus-python/extensions/custom_menu.py
rm -rf ~/.local/share/nautilus-python/extensions/__pycache__
nautilus -q
```

GPaste: `sudo dnf remove gpaste gnome-shell-extension-gpaste`, then drop the UUID from
`org.gnome.shell enabled-extensions`.

---

## Known gaps

Deliberately not fixed; noted so they are not rediscovered as bugs.

- **Copy Path silently no-ops on remote locations.** `location.get_path()` returns `None` for
  `sftp://`, `trash://` etc., so the path list ends up empty and the item does nothing with no
  feedback. A `get_uri()` fallback would fix it.
- **`analyze_disk_usage` launches via `subprocess.Popen`**, bypassing startup notification — so
  `baobab` gets no launch feedback and may lose focus to focus-stealing prevention.
  `Gio.AppInfo` with an activation token is the correct route.
