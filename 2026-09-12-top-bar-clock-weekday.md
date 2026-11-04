# Top bar clock — the weekday, and what the macOS reference already matched

**Live** as of 2026-09-12.

The goal was to rebuild the top bar to look like a macOS menu bar, from a screenshot crop
showing a Control Center glyph and `Wed Sep 9  3:42 PM` in white over an untinted wallpaper.
Scope was then narrowed by choice: keep the status icons, keep Blur My Shell's panel blur,
leave the left side alone. What remained was the clock — and measuring the crop against the
running bar showed the 2026-09-04 typography work had already landed on its numbers. One
property had not: the weekday was missing. That is the entire change.

---

## What changed

```bash
gsettings set org.gnome.desktop.interface clock-show-weekday true
```

`Sep 12  3:46 PM` → `Sat Sep 12  3:46 PM`. It takes effect immediately — `GnomeDesktop.WallClock`
watches the key itself and `dateMenu.js` binds its label to the resulting `clock` property, so
there is no theme reload and no logout.

**The format string is not a setting.** The three booleans (`clock-show-weekday`,
`clock-show-date`, `clock-show-seconds`) plus `clock-format` only *select* one of nine C
strings compiled into `libgnome-desktop-4`:

```bash
strings /usr/lib64/libgnome-desktop-4.so.2 | grep '%a %b'
# %a %b %-e_%R:%S / %a %b %-e_%R / %a %b %-e_%l:%M:%S %p / %a %b %-e_%l:%M %p
```

The one selected here is `%a %b %-e_%l:%M %p`, and two of its characters are not what they
look like:

| in the format | on screen | why |
|---|---|---|
| `_` | U+2002 EN SPACE | a fixed-width separator, so the clock does not jitter as the date changes |
| `%l` pad | U+2007 FIGURE SPACE | `%l` space-pads a single-digit hour; gnome-desktop swaps it for a digit-width space |

So the gap between date and time is a deliberate, wide, non-breaking pair — not the two plain
spaces it resembles.

---

## What the reference already matched

Method: the crop was measured in pixels (cap height 31px, baseline y=53), every length
normalised to cap heights, then converted at this panel's cap — `0.9em × 14.67px × 0.728 =
9.61px`. Font weight was compared by rendering each Adwaita Sans named instance at cap 31 and
integrating sub-pixel ink coverage across a stem-only row.

| property | reference | this bar | verdict |
|---|---|---|---|
| clock at far right | yes | Just Perfection `clock-menu-position=1`, offset 20 clamps to the end of `_rightBox` | match |
| 12-hour time | `3:42 PM` | `clock-format='12h'` | match |
| **weekday** | **`Wed`** | **absent** | **the change** |
| month before day | `Sep 9` | `Sep 12` | match |
| text colour | `#FFFFFF` | `#FFFFFF` | match |
| font weight | stem/cap 0.1486 | `font-weight: 500` = Adwaita Sans Medium, 0.1466 | match, 1.4% |
| clock ink width | 396px @ cap 31 | Adwaita Sans 385px @ cap 31 | match, −2.8% |
| icon → clock gap | 2.61 cap | 2.81 cap | match |
| text shadow | none — background 4px from a stem reads 55.4 vs 54.0 far away | none | match |
| date ↔ time gap | 0.94 cap | 1.74 cap | differs, see Known gaps |
| icon ink : cap | 1.387 | 1.218 | left alone, see Known gaps |

Adwaita Sans Medium is a genuinely close stand-in for SF Pro here: the next instances either
side miss by 19% (Regular, 0.1197) and 17% (SemiBold, 0.1734).

---

## Three constraints found on the way

**1. The American date order is an accident of packaging, and it can flip.**
`libgnome-desktop-4` translates through gettext domain `gnome-desktop-4.0`, and no `.mo` for
it exists in any `en*` locale — only `gnome-desktop-3.0.mo`, which is *not* consulted. So
despite `LANG=en_GB.UTF-8` the untranslated C string wins and the date reads `Sep 12`. The
British string is already sitting on disk waiting:

```bash
python3 -c "
import gettext
c = gettext.translation('gnome-desktop-3.0','/usr/share/locale',languages=['en_GB'])._catalog
print(c['%a %b %-e_%l:%M %p'])"          # -> %a %-e %b_%l:%M %p     ("Wed 12 Sep")
```

If Fedora ever ships a `gnome-desktop-4.0` catalogue for `en_GB`, the clock silently becomes
`Sat 12 Sep`. That is a package change, not a config change, so nothing here will warn about it.

**2. `#panel { color }` never reaches a panel button.** Stock sets `color: #ffffff` on both
`#panel .panel-button` (1,1,0) and `#panel .panel-button.clock-display` (1,2,0); a bare
`#panel` is (1,0,0). LuisDark's `color: #F5F5F5` has therefore always been inert, and the clock
was already the reference's pure white. Restyling panel text means matching those selectors.
This is a *specificity* loss against the base layer — a different failure from the
`background-color` on the same rule, which loses to a Blur My Shell class instead.

**3. `#panel { padding }` does not move the boxes.** `Panel.vfunc_allocate` (`panel.js:492`)
computes from the raw allocation and allocates `_rightBox` to `x2 = allocWidth`, never calling
`get_content_box()`. The theme node's padding and border are ignored outright. This is the same
constraint already known for `ButtonBox` — which lays out purely from `-natural-hpadding` — one
level further up the tree. The end inset of the bar can only be changed by moving
`-natural-hpadding`, which moves every inter-item gap with it.

---

## Files

| | |
|---|---|
| `dconf /org/gnome/desktop/interface/clock-show-weekday` | `false` → `true`. The only functional change. |
| `~/.local/share/themes/LuisDark/gnome-shell/gnome-shell.css` | comment only, at the `#panel` rule — records both inert declarations and *why each* is inert. No declaration changed. |

---

## Verification

```bash
gsettings get org.gnome.desktop.interface clock-show-weekday      # -> true

# The panel's own data source. WallClock is the exact object dateMenu.js binds
# its label to, so this is the rendered string, not a reconstruction of it.
python3 -c "
import gi; gi.require_version('GnomeDesktop','4.0')
from gi.repository import GnomeDesktop
print(repr(GnomeDesktop.WallClock().get_clock()))"
# -> 'Sat Sep 12\u2002\u20073:46 PM'
```

`repr()` matters: the U+2002 and U+2007 are invisible when printed plainly, and they are the
part worth checking.

**Misleading check:** `date '+%a %b %-e %l:%M %p'` prints something that looks identical but
uses ASCII spaces throughout. It will convince you the separator is two ordinary spaces and
hide the real, much wider gap.

---

## Rollback

```bash
gsettings reset org.gnome.desktop.interface clock-show-weekday
```

---

## Known gaps

- **The date ↔ time gap stays 1.9× the macOS one.** At cap 31 the reference is 29px; the
  U+2002 + U+2007 pair renders 54px in Adwaita Sans. Nothing in CSS or gsettings reaches it —
  the separator is inside the C format string. The two levers are an extension overwriting
  `dateMenu._clockDisplay.text` on each `notify::clock` (a logout to load, and another for every
  edit, since GJS caches the module for the session), or a hand-built
  `/usr/share/locale/en_GB/LC_MESSAGES/gnome-desktop-4.0.mo`, which an update would clobber —
  and which would also pull in constraint 1 above. Not worth 25px.
- **The icon-to-text ratio is left at its 2026-09-04 value.** The reference's glyph inks
  1.387 × cap against 1.218 here. Matching it means `icon-size: 16px` or `font-size: 0.79em`.
  Deliberately not done: the reference's calibration glyph is an SF Symbol drawn edge-to-edge
  in its box, which is not how a status icon is drawn, and the 0.9em/14px pairing was measured
  against the WhiteSur icons actually installed.
- **The greeter clock does not follow.** `clock-show-weekday` is a user key; the GDM greeter
  reads the `gdm` dconf profile and its panel carries `dateMenu` in `center`
  (`sessionMode.js:61`). Bringing it in line means adding `[org/gnome/desktop/interface]` with
  `clock-format` and `clock-show-weekday` to the block `~/.config/gdm-theme/install.sh` writes
  at `/etc/dconf/db/gdm.d/10-luis-login-screen`, then `dconf update`. Needs sudo; not done.
