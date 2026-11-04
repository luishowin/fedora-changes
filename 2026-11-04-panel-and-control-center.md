# Top bar and Control Center — weight, icon size, blur, corners

**Partial** as of 2026-11-04. Everything is installed and queued; the stylesheet and the user
copy of Blur My Shell load at the next login.

**Revised 2026-11-04:** Blur My Shell updated to 77, so the static-blur workaround was replaced
by dynamic popup blur. See [Control Center live blur](2026-11-04-control-center-live-blur.md).
The weight, icon-size and corner results here still stand.

Four requests landed together because three of them share the same surface:

1. the date/time text is one weight too heavy (stock bold 700);
2. the Wi-Fi/volume/battery icons are too small at 1920×1080 on a 13-inch panel at scale 1.0;
3. the Control Center has square corners that should be rounded;
4. the Control Center background should be a blurred translucent material.

Items 3 and 4 are the same bug in two layers.

---

## Root causes

### The clock weight is hard-coded

GNOME Shell 51 sets the clock to bold in the stock theme, and the selectors are more specific
than they look:

```css
#panel .panel-button.clock-display {          /* 1,2,0 */
  font-weight: bold;
}
#panel.unlock-screen .panel-button.clock-display {  /* 1,3,0 */
  font-weight: bold;
}
```

There is no `clock-font-weight` setting. A weight override therefore needs a selector at least as
specific plus `!important`. Adwaita Sans ships a real SemiBold face, so 600 is not synthetic.

### Icon size does have a lever

Stock is `icon-size: 1.091em` (about 16 px at 11 pt). Just Perfection already exposes
`panel-icon-size`, implemented as a class whose CSS is `icon-size: Npx`; it reacts immediately,
no logout. The value is an exact pixel size, not an `em`, so it does not follow text scaling.

### The Fedora Blur My Shell package is missing its stylesheet tree

This is the important one:

```bash
rpm -ql gnome-shell-extension-blur-my-shell | grep css
# /usr/share/gnome-shell/extensions/blur-my-shell@aunetx/stylesheet.css
```

The installed `stylesheet.css` is only a list of imports:

```css
@import url("styles/panel.css");
@import url("styles/popup/base.css");
@import url("styles/popup/dark.css");
...
```

None of those files exist in the RPM. The extension's JavaScript and Clutter effects still run,
but every class that makes the popup background transparent — and every panel style class — is
missing. The result is exactly what was on screen: an opaque popup with no visible blur. The
upstream v75 release zip contains the whole `styles/` tree; the Fedora package does not.

### Dynamic popup blur has square corners by design on this system

BMS 75's dynamic blur uses the native `Shell.BlurEffect`. Rounded corners require a
`corner-radius` property:

```bash
gsettings get org.gnome.shell.extensions.blur-my-shell rounded-blur-found
# false
```

`NativeDynamicBlurEffect.supports_corner_radius` is false because the optional
`gnome-rounded-blur` library is not installed. The blur actor is therefore square even when the
menu CSS is rounded. Static popup blur is different: it runs the selected pipeline and applies a
`corner` effect with the per-surface radius, so it can be rounded without the native library.

---

## What changed

### Clock weight

New user extension `panel-tweaks@luis.local`:

```css
#panel .panel-button.clock-display,
#panel .panel-button.clock-display .clock,
#panel .clock-display StLabel {
    font-weight: 600 !important;
}
```

`metadata.json` lists `"45"` through `"51"`, so the next Fedora upgrade does not repeat the old
extension's failure. The extension is installed and queued in `enabled-extensions`.

### Icon size

```bash
gsettings set org.gnome.shell.extensions.just-perfection panel-icon-size 18
```

18 px is the first value against the 11 pt clock. It also scales app-indicator icons because
Just Perfection's selector is `.panel-button StIcon`; if only the three system indicators should
grow, move the rule into `panel-tweaks` and set this key back to 16.

### Blur and corners

- Installed the upstream v75 release zip into the **user** extension directory:
  `~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/`. The running system copy stays
  untouched; GNOME Shell prefers the user copy at login.
- `gnome-extensions install --force` reported `Can't recursively copy directory` while the
  system copy of the same UUID was installed. Extracting the zip directly into the user
  extension directory worked and is what the installed copy contains.
- Switched popups from dynamic to static blur so the corner effect is used:

  ```bash
  gsettings set org.gnome.shell.extensions.blur-my-shell.popup static-blur true
  ```

- Kept the existing dark material and matched the radii to stock GNOME 51:
  `override-background=true`, `style-popup=3` (automatic; resolves to dark because the session
  prefers dark), `quick-settings-corner-radius=36`, `menu-corner-radius=20`.
- The visible material is now BMS's dark surface (`rgba(255,255,255,0.11)` over a 30σ blur at
  0.6 brightness), not an opaque theme fill.

---

## Files

| | |
|---|---|
| `panel-tweaks@luis.local/` | new source package: metadata, empty `extension.js`, one CSS rule, install/verify/revert/uninstall, README |
| `~/.local/share/gnome-shell/extensions/panel-tweaks@luis.local/` | installed copy, queued for the next login |
| `~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/` | upstream v75 with the complete `styles/` tree |
| `org.gnome.shell.extensions.just-perfection panel-icon-size` | `16` → `18` |
| `org.gnome.shell.extensions.blur-my-shell.popup static-blur` | `false` → `true` |

---

## Verification

After logging out and back in:

```bash
gnome-extensions info panel-tweaks@luis.local | grep State
# State: ACTIVE

gnome-extensions info blur-my-shell@aunetx | grep Path
# Path: /home/luishowin/.local/share/gnome-shell/extensions/blur-my-shell@aunetx

test -f ~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/styles/popup/base.css \
  && echo styles-present

gsettings get org.gnome.shell.extensions.blur-my-shell.popup static-blur   # true
gsettings get org.gnome.shell.extensions.just-perfection panel-icon-size    # 18

journalctl --user -b _COMM=gnome-shell | grep -iE 'panel-tweaks|blur-my-shell'
# no JS errors
```

Visually: the date/time is lighter than the stock bold, the three status icons are roughly the
clock's line height, the Control Center has rounded corners, and the background shows the
desktop through a blur instead of a flat grey fill.

**Misleading check:** before the logout, `gnome-extensions info blur-my-shell@aunetx` still
reports the `/usr/share` path and `panel-tweaks` "doesn't exist". A running Wayland Shell
enumerated its extension directories at login; the queued state is the correct pre-login result.

---

## Rollback

```bash
# Clock weight
~/Documents/fedora-changes/panel-tweaks@luis.local/revert.sh

# Icon size back to stock
gsettings set org.gnome.shell.extensions.just-perfection panel-icon-size 16

# Back to the Fedora copy of Blur My Shell (opaque, square popups)
rm -rf ~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx
gsettings set org.gnome.shell.extensions.blur-my-shell.popup static-blur false
```

Each needs a logout to take effect, except the icon size.

---

## Known gaps

- **Static popup blur is a snapshot.** It does not continuously update the backdrop while the
  menu is open. The only way to keep dynamic blur and rounded corners is to build and install
  `gnome-rounded-blur` against mutter; that adds a native library to `/usr` and survives package
  updates poorly.
- **The user copy of BMS shadows Fedora package updates.** Remove it when the RPM starts shipping
  `styles/`, otherwise the user copy will stay at v75.
- **`panel-icon-size 18` may still be short.** The display is 166 PPI at scale 1.0, so try 19 or
  20 if it does not match the clock's line height. The setting is live.
- **The panel itself becomes translucent.** `style-panel=0` is BMS's `transparent-panel` class;
  once the missing styles load, the previously opaque top bar shows the blur instead. If that is
  too transparent, set `style-panel` to `2` (`dark-panel`, `rgba(100,100,100,0.35)`).
- The clock weight also applies on the lock/login panel, because the selector deliberately
  matches the `unlock-screen` / `login-screen` rules. That keeps both clocks consistent.
