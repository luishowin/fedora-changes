# Clock — macOS date/time spacing, and greeter parity

**Retired** as of 2026-11-04. The `topbar-clock@luis.local` extension was removed during the
Fedora 45 / GNOME 51 upgrade, and the greeter half was never applied. The entry is kept for its
root-cause notes: GNOME's date/time separator is compiled into `libgnome-desktop-4`, so no CSS
or gsettings key can change the gap. The weekday setting from the parent entry is still live.

Follow-on from [Top bar clock — the weekday](2026-09-12-top-bar-clock-weekday.md), which closed
everything in the macOS reference that a setting could reach and left two things behind: the
login screen still showed a 24-hour clock with no weekday, and the gap between the date and the
time did not match the reference.

---

## Part 1 — the greeter

The greeter reads the `gdm` dconf profile, never the user's, so no `gsettings set` in a session
can reach it. `/usr/share/dconf/profile/gdm` already declares `system-db:gdm`, and
`~/.config/gdm-theme/install.sh` already owns a keyfile there for the logo, so the two clock
keys went into that same block rather than into a new file:

```ini
[org/gnome/login-screen]
logo=''

[org/gnome/desktop/interface]
clock-format='12h'
clock-show-weekday=true
```

`clock-show-date` is deliberately absent — its schema default is already `true`, which is why
the greeter shows `Sep 12` today. The change belongs in `install.sh` rather than in `/etc`
because the script rewrites that file wholesale on every run; editing `/etc` directly would be
silently undone the next time the greeter theme is rebuilt. `revert.sh` deletes the whole file,
so rollback needed no change.

Re-running the installer is safe: `build/gnome-shell-theme.gresource` and the installed
`/usr/share/gnome-shell/gnome-shell-theme.gresource` are byte-identical (`md5 93fc0732…`), so
the theme half is a no-op and only the dconf half moves.

---

## Part 2 — the date/time gap

**What the reference actually differs by.** Measured with Pango at the panel's real size
(Adwaita Sans Medium 9.9pt = the 11pt system font times the stylesheet's `0.9em`):

| | advance |
|---|---|
| tabular digit | 9px |
| U+2007 FIGURE SPACE — what `%l` pads a 1-digit hour with | 9px |
| U+2002 EN SPACE — what `_` in the format string becomes | 7px |
| two ASCII spaces — the macOS reference | 8px |

So GNOME's gap is **16px from 1 to 9 o'clock and 7px from 10 to 12**, because the pad only
exists for single-digit hours. The reference is a constant 8px. The earlier entry described
this as "1.9x too wide", which is only true for the nine hours that have a single digit.

**Why it cannot be narrowed in place.** The pad stands in for the missing hour digit, and it
sits *inside* the gap. Its width is exactly one tabular digit, so removing it makes the label
9px narrower for those nine hours. A constant gap and a constant width are therefore mutually
exclusive: GNOME chose the width, macOS chose the gap. There is no third arrangement, and no
setting or CSS reaches either — the separator is compiled into `libgnome-desktop-4`.

The digits are tabular only because the stock sheet puts `font-feature-settings: "tnum"` on
`#panel` (`gnome-shell-dark.css:412`) and St inherits it down to the label; `#panel` holds no
text of its own, so the rule can have no other purpose. Adwaita Sans's own figures are
proportional — `1` is 5px, `4` is 9px, the rest 8px — so without that rule the clock would
change width every minute and the padding would be pointless.

**The extension.** `~/.local/share/gnome-shell/extensions/topbar-clock@luis.local/`, about
thirty lines. The one non-obvious part is that it unbinds nothing:

```js
// dateMenu.js:972
this._clock.bind_property('clock', this._clockDisplay, 'text',
                          GObject.BindingFlags.SYNC_CREATE);
```

That `GBinding` is never stored, so it cannot be removed. It does not need to be. A `GBinding`
*is* a `notify::` handler on the source object, handlers run in connection order, and an
extension connects later than the constructor did — so its handler always overwrites the raw
string within the same tick. `disable()` restores the stock text by re-emitting
`this._clock.notify('clock')` and letting the binding, still attached, rewrite the label.

The rewrite itself is one regex, covering both formats:

```js
const SEPARATOR   = /\u2002\u2007?|\u2007/;
const MAC_SPACING = m => (m[0] === '\u2002' ? '  ' : '');
```

With the date on, the run is `EN FIG` or `EN` and becomes two spaces. With
`clock-show-date=false` the format is `%a %l:%M %p` — a bare pad and no EN SPACE at all — and
that branch drops it instead of widening it.

---

## Files

| | |
|---|---|
| `~/.config/gdm-theme/install.sh` | the two clock keys in the dconf heredoc, plus the comments explaining why they live there |
| `/etc/dconf/db/gdm.d/10-luis-login-screen` | rewritten by that script; needs sudo |
| `~/.local/share/gnome-shell/extensions/topbar-clock@luis.local/` | new, self-authored: `metadata.json` + `extension.js` |
| `org.gnome.shell enabled-extensions` | UUID appended, 13 entries to 14 |

---

## Verification

**Test the logic without paying for a logout.** GJS caches the ES module for the whole session,
so a code change cannot be reloaded — every edit otherwise costs a login cycle. The transform is
pure string work, so it can be lifted straight out of the file and run standalone:

```bash
D=~/.local/share/gnome-shell/extensions/topbar-clock@luis.local
{ grep -E '^const (SEPARATOR|MAC_SPACING)' "$D/extension.js"; cat mycases.js; } > /tmp/t.js
gjs -m /tmp/t.js          # -> all cases pass
node --input-type=module --check < "$D/extension.js"   # syntax gate; no shell resources needed
```

Six cases were checked this way: date+12h at 1- and 2-digit hours, date+24h, no-date at both
hour widths, and idempotency.

**Live preview before committing to the logout**, in Looking Glass (`Alt+F2` -> `lg`) — the same
code, no reload, gone at the next login:

```js
const d = Main.panel.statusArea.dateMenu;
d._clock.connect('notify::clock', () => {
  d._clockDisplay.text = d._clock.clock.replace(/\u2002\u2007?|\u2007/, m => m[0] == '\u2002' ? '  ' : '');
});
d._clock.notify('clock')
```

**After the logout:**

```bash
gnome-extensions info topbar-clock@luis.local | grep State     # -> ACTIVE
journalctl --user -b _COMM=gnome-shell | grep -i topbar-clock  # silence = it did not throw
```

**Greeter:**

```bash
DCONF_PROFILE=gdm dconf read -d /org/gnome/desktop/interface/clock-format        # -> '12h'
DCONF_PROFILE=gdm dconf read -d /org/gnome/desktop/interface/clock-show-weekday  # -> true
```

**Misleading check:** `gnome-extensions info` says *"doesn't exist"* for a freshly installed
extension even when the files are perfect and the UUID is in `enabled-extensions`. The Shell
enumerates the extension directories only at startup, and Wayland has no restart. That message
before the first login means nothing.

---

## Rollback

```bash
gnome-extensions disable topbar-clock@luis.local   # disable() puts the stock string back at once
bash ~/.config/gdm-theme/revert.sh                 # greeter: removes the keyfile, dconf update
```

To remove the extension entirely, delete the directory and drop the UUID from
`org.gnome.shell enabled-extensions`.

---

## Known gaps

- **The greeter keeps the wide gap.** `gdm` mode inherits `enabledExtensions: []`
  (`sessionMode.js:51`), so no extension runs there and nothing can rewrite the greeter's label.
  The two clocks will read the same words with different spacing — 16px at the greeter, 8px in
  the session, for hours 1 to 9. Only a patched `libgnome-desktop-4` or a hand-built
  `gnome-desktop-4.0.mo` could change that, and both are clobbered by updates.
- **The clock now changes width twice per 12 hours**, by one tabular digit, at 10:00 and 1:00.
  The indicators to its left step 9px with it. This is deliberate and is what macOS does.
- **Every future edit to `extension.js` costs a logout.** Use the two harnesses above first.
