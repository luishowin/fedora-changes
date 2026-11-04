# Control Center live blur — show the app, not the wallpaper

**Live** as of 2026-11-04. Supersedes the static-blur workaround in
[Top bar and Control Center](2026-11-04-panel-and-control-center.md).

The Control Center now had rounded corners and a translucent material, but the material was
showing the desktop wallpaper even when a maximized application sat behind the popup. The blur
was not sampling the composited windows at all.

---

## Root cause

Blur My Shell has two popup implementations:

| mode | what it samples | rounded corners |
|---|---|---|
| **static** | `Meta.BackgroundGroup` + `BackgroundManager` — the wallpaper only | BMS `RoundedPipeline` |
| **dynamic** | `BackdropCaptureEffect` — the live framebuffer, including windows | BMS `RoundedPipeline` |

BMS 77 made `static-blur` the default (`true`) for popups. The earlier entry set it explicitly to
`true` to get rounded corners on BMS 75, where dynamic blur needed the native
`gnome-rounded-blur` library. That workaround produced the correct shape but the wrong content:
the static actor has no access to application windows, so it always paints the desktop.

BMS 77 no longer needs that native library. `render/dynamic_surface.js` creates a
`BackdropCaptureEffect` on the content actor and `render/rounded_pipeline.js` attaches BMS's own
corner effect. Dynamic blur is therefore both live and rounded on this install.

The old `org.gnome.shell.extensions.blur-my-shell rounded-blur-found` key still reads `false`;
in 77 it is vestigial. It describes native `Shell.BlurEffect` support, not the mask BMS now
applies itself.

---

## What changed

```bash
gsettings set org.gnome.shell.extensions.blur-my-shell.popup static-blur false
```

- The Control Center, calendar, menus and notification popups now sample the live backdrop.
- The top bar intentionally stays on static blur (`panel.static-blur=true`); the request was
  scoped to the Control Center.
- Corner radii are unchanged: `quick-settings-corner-radius=36`, `menu-corner-radius=20`,
  `notification-corner-radius=18`.
- The setting change resets the popup component live; no logout.

The user copy of BMS is version **77**, not the v75 documented in the parent entry. It was
updated from extensions.gnome.org after the previous login. The user copy still shadows the
Fedora 75 RPM, which is fine.

---

## Files

| | |
|---|---|
| `org.gnome.shell.extensions.blur-my-shell.popup static-blur` | `true` → `false` |
| `~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/` | user copy now v77 |

---

## Verification

```bash
gnome-extensions info blur-my-shell@aunetx | grep Version
# Version: 77

gsettings get org.gnome.shell.extensions.blur-my-shell.popup static-blur
# false
```

Then open a maximized application with visible content — a browser page or a photo — and open
the Control Center over it. The material should show that content, blurred, rather than the
wallpaper. Move the window while the Control Center is open: dynamic blur follows it.

**Misleading check:** judging the blur over an empty desktop proves nothing — static and dynamic
look identical there. Put a window behind the popup first.

---

## Rollback

```bash
gsettings set org.gnome.shell.extensions.blur-my-shell.popup static-blur true
```

That returns to the wallpaper-only material. To go back to the Fedora RPM entirely, remove the
user copy and log out; that returns to the opaque/short-bus case.

---

## Known gaps

- Dynamic blur costs more GPU than static blur. On this 13-inch 1080p panel it is not noticeable;
  if it becomes a problem, `hacks-level 2` disables clipped redraws but sacrifices compositor
  performance.
- If redraw artefacts appear while scrolling behind the popup, try:
  ```bash
  gsettings set org.gnome.shell.extensions.blur-my-shell hacks-level 2
  ```
  and revert with `1`.
- The top bar still shows wallpaper-only static blur. Set `panel.static-blur=false` if that
  inconsistency becomes visible over maximized apps.
- The `rounded-blur-found=false` value should not be chased; BMS 77 rounds in its own shader
  pipeline. Installing `gnome-rounded-blur` is unnecessary.
