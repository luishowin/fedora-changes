# GDM greeter — minimal single-user rebuild

**Source complete** as of 2026-11-07. Run `./install.sh` and log out/in to make
it live. Supersedes
[GDM login screen — wallpaper, clock and cursor parity](2026-11-05-gdm-login-parity.md).
The package is still `gdm-login-parity/`, but the GDM extension is no longer
just a wallpaper stylesheet.

The request was a greeter that matches the Super+L lock screen **and feels more
modern/minimal**, using:

- `~/Downloads/log in.svg` as the login-screen reference;
- `~/Downloads/slate desktop.svg` as the clock treatment;
- `~/Downloads/wpp.jpg` as the wallpaper.

The result is the layout from `log in.svg`: a live-blurred wallpaper, one
centred avatar/name pill, a password pill that appears beside it, and a single
**Options** menu at the bottom right. The large time/date from the slate
reference appears first and fades out when authentication starts.

---

## What was wrong with the 2026-11-05 version

The previous package was a CSS-only extension:

```css
#lockDialogGroup {
    background-image: url("file:///usr/local/share/backgrounds/luishowin/wpp-blur.jpg");
}
```

That produced a flat, pre-blurred forest image and left GDM's stock user-list
and panel-clock layout in place. It also used the older `~/Downloads/wpp.jpg`
(forest) while the lock screen used the newer desktop wallpaper, so the two
screens did not even share an image.

The greeter and the lock screen are different classes:

- Super+L: the user session's `UnlockDialog` creates a live
  `Background.BackgroundManager` on `#lockDialogGroup`, applies
  `Shell.BlurEffect` (`BLUR_RADIUS = 90`, `BLUR_BRIGHTNESS = 0.65`), and draws
  a large `.unlock-dialog-clock`.
- Logout: `gnome-shell --mode=gdm` runs as the `gdm` user with its own dconf
  profile. `LoginDialog` has no background actor and GDM's session mode puts a
  `dateMenu` in the panel centre.

The greeter also cannot read `/home/luishowin` (mode `700`), so the wallpaper,
cursor and any user theme must be copied under `/usr/local/share` and be
world-readable.

---

## Design derived from `log in.svg`

Measured at the SVG's native 1920×1080:

| element | value |
|---|---|
| wallpaper | `wpp.jpg`, 1920×1080, live 10 px blur, 20% black scrim |
| user pill | 68.8 px tall, 34.4 px radius, black 30%, 1 px white 10% border |
| password pill | 315.7 × 68.8 px, 34.4 px radius, black 30%, 1 px white 20% border |
| gap | 15.2 px |
| avatar | 38 px circle |
| name | ~24 px, medium |
| password text | ~24 px, 29.5 px left inset |
| Options | bottom-right, 32 px inset, 2 px chevron |
| clock time | ~95 px cap height at y≈227 (21% of 1080) |
| clock date | ~24 px at y≈361 (33.5%) |

The clock sits above the avatar row. It fades out as soon as
`AuthPrompt.visible` becomes true, and fades back in if the user returns to the
avatar state.

The mockup's frosted-glass pills are approximated: St has no per-actor backdrop
blur, so the wallpaper is blurred globally and the pills use a translucent
black fill plus a white border. The reference's “Anna” is a placeholder; the
real AccountsService avatar and name are used.

The reference's battery pill (“19 min to full charge”) is not part of the
login-screen mockup and is not included. The top bar is transparent with its
centre clock hidden; the quick-settings/power control is kept so the greeter
remains recoverable.

---

## What changed

### Extension

`gdm-login-parity/gdm-background@luis.local/` is now a real GDM-mode
extension, not just a stylesheet:

- **Live background:** `BackgroundManager` + `Shell.BlurEffect` on a
  `screen-shield-background` widget behind `#lockDialogGroup`, plus one
  full-screen 20% black scrim. The CSS rule still contains a
  pre-blurred `wpp-blur.jpg` fallback; `extension.js` adds
  `gdm-live-background` to `#lockDialogGroup` only after the background manager
  reports loaded, and that class removes the static image.
- **Clock:** a `GnomeDesktop.WallClock` and a date label added to the shield
  group. `notify::clock` refreshes the time; `notify::allocation` re-centres it.
- **User pill:** each `UserListItem` is made non-expanding and horizontally
  centred; its `UserWidget` is forced horizontal, spacing 17 px. The single
  account is shown as a 176 × 44 px avatar/name pill with a 30 px avatar; the
  “Not listed?” link is hidden when there is only one account.
- **Password row:** `AuthPrompt` is changed to `Clutter.Orientation.HORIZONTAL`
  with 12 px spacing. Its internal `_userWell` is kept as the left pill and
  `_inputWell` becomes the right 253 × 44 px password pill. The stock cancel
  button is hidden; the avatar pill is the back control and Escape still
  works. Empty message labels are hidden so they do not add height. The stock
  peek/eye icon is disabled so the full “Password” hint fits; the submit
  chevron stays at the right.
- **Options:** the existing `AuthMenuButton` popup is reused, relabelled to
  “Options ›”, and made visible by its Switch User, Restart and Power Off
  items. Accessibility
  toggles are added as `PopupSwitchMenuItem`s; Restart and Power Off use
  `SystemActions`. The separate accessibility button is hidden. The trigger
  and popup items are 12 px and the switches are 32 × 18 px.
- **Panel:** `Main.panel.statusArea.dateMenu.container` is hidden so the large
  clock is the only clock.

All internal accesses are guarded. If a future Shell removes one of them, the
extension logs and stock GDM login still works.

### Refinements after the first live look

The first live session exposed three visual problems:

- the avatar sat 2 px too far right because the pill used a 17 px left inset
  against 15 px top/bottom padding, while the user-list item also inherited a
  2 px transparent `.user-icon` border;
- a 45%-height top scrim created a visible horizontal boundary across the
  wallpaper even though the full-screen base scrim was uniform;
- the stock `St.PasswordEntry` peek/eye icon squeezed the hint into `Pass…`
  and left the password pill looking scattered between the text, the eye and
  the submit chevron.

The final layout therefore uses:

- a 15 px left inset on both avatar pills, `.user-icon { border: 0 !important; }`,
  and a 555 px prompt row (224 px user pill + 15 px gap + 316 px password pill);
- one full-screen 20% black scrim and no separate top scrim;
- `show_peek_icon = false` on the password entry, with the submit chevron kept
  at the far right.

Headless GDM 51.1 verification after the refinements:

```text
topScrim=false            scrim=1920x1080
prompt=555x70             prompt avatar=16,16 38x38
password entry=316x69     show_peek_icon=false
item=224x70               prompt row centred
```

The visible avatar inset is now equal left/top (16 px including the 1 px pill
border), and there is no mid-screen scrim edge.

### Second follow-up — shorter pills and top-bar theme

The next live pass asked for a shorter, tighter row:

- both pills are now **56 px** tall (20% shorter than 70 px), with a 28 px
  radius; the prompt row is 551 px (220 px user pill + 15 px gap + 316 px
  password pill);
- the avatar moved 4 px left, from a 15 px to an 11 px left inset;
- the auth prompt's user widget is converted to horizontal as soon as its
  child is set, and a prompt-scoped CSS rule fixes the avatar at 38 px. The
  shell's vertical 160 px avatar can no longer paint for a transition frame;
- the GDM top bar now uses a generated `WhiteSur-GDM` icon theme: the user's
  WhiteSur symbolic `actions`, `categories`, `devices`, `places` and `status`
  directories, with `WhiteSur-System-Status-Custom/status/symbolic` overlaid.
  The gdm profile sets `icon-theme='WhiteSur-GDM'`.

The icon-theme work was deliberately scoped to the **theme only**; GDM keeps
its default panel icon size (1.091em), height and spacing. The home bar's 23 px
Just Perfection size is not applied, so the padded custom status icons render
smaller than the home bar. This is a known gap, not a missing install step.

Headless GDM 51.1 verification after this pass:

```text
prompt=551x56             prompt avatar=12,9 38x38
user pill=220x56          password entry=316x56
show_peek_icon=false      icon-theme=WhiteSur-GDM
panel height=32           top-bar size unchanged
```

### Third follow-up — about 20% smaller row, bottom anchor, compact Options

The live greeter still felt oversized. This pass:

- the pill row is now **441 × 44 px**: 176 px user pill + 12 px gap + 253 px
  password pill;
- both pills use a 22 px radius and a **single 1 px border**; the old
  selected-state inset shadow was removed so focus cannot add a second ring;
- the avatar is 30 px with a **7 px left inset** — 5 px further left than the
  previous 12 px;
- the pill name and password text are 19 px; the clock is unchanged;
- both the initial avatar pill and the password row are anchored **80 px above
  the bottom edge**; the clock stays at the top;
- the Options trigger and popup items are 12 px, with 3 px vertical item
  padding and 32 × 18 px toggle switches.

The greeter is **not** at 150% scale: `~/.config/monitors.xml` has
`<scale>1</scale>`, `text-scaling-factor` is `1.0`, and the gdm profile sets no
scale. At 1.0 a 1 px CSS border is 1 device pixel; the earlier size was simply
the design.

`LoginDialog` centres its children in `vfunc_allocate()`, so the bottom anchor
is a `translation_y` in `extension.js` rather than CSS. It accounts for the
stock `+50 px` auth-prompt offset and is recomputed on height, visibility and
monitor changes. The fixed 44 px prompt keeps the row in place while an error
message renders below it inside the 80 px bottom gap.

Headless GDM 51.1 verification after this pass:

```text
prompt=441x44             prompt avatar=7,7 30x30
user pill=176x44          password entry=253x44
user list bottom=1000     prompt bottom=1000
show_peek_icon=false      icon-theme=WhiteSur-GDM
options item height=24    switch=32x18
```

### Assets and dconf

`install.sh` now:

- crops `~/Downloads/wpp.jpg` (or the path argument) to 1920×1080;
- writes the clear `wpp.jpg` and a 10 px, 20%-dim `wpp-blur.jpg` fallback;
- sets the greeter background URI to the clear image;
- keeps the WhiteSur cursor copy;
- generates `/usr/local/share/icons/WhiteSur-GDM` from WhiteSur and the custom
  status theme, and sets `icon-theme='WhiteSur-GDM'`;
- sets `accent-color='slate'` and `color-scheme='prefer-dark'`;
- keeps the existing 12h weekday clock setting and the blank logo.

`BLUR` and `DIM` still override the fallback generation; the live blur radius
is the `BLUR_RADIUS` constant in `extension.js`.

### Files

| | |
|---|---|
| `gdm-login-parity/gdm-background@luis.local/extension.js` | live background, clock, login layout, Options menu |
| `gdm-login-parity/gdm-background@luis.local/stylesheet.css` | pill geometry, clock, panel, fallback |
| `gdm-login-parity/gdm-background@luis.local/metadata.json` | `session-modes: ["gdm"]`, shell 51 |
| `gdm-login-parity/install.sh` | images, cursor, generated GDM icon theme, gdm dconf |
| `gdm-login-parity/verify.sh` | files, design tokens, icon theme, dconf |
| `gdm-login-parity/revert.sh` | remove system files, icon theme and dconf |
| `/usr/local/share/gnome-shell/extensions/gdm-background@luis.local/` | installed extension |
| `/usr/local/share/backgrounds/luishowin/{wpp,wpp-blur}.jpg` | greeter wallpaper and fallback |
| `/usr/local/share/icons/WhiteSur-GDM/` | generated minimal WhiteSur icon theme for the GDM top bar |
| `/etc/dconf/db/gdm.d/20-luis-login-parity` | extension, background, interface keys |

---

## Verification

```bash
cd ~/Documents/fedora-changes/gdm-login-parity
./install.sh
./verify.sh
```

`verify.sh` checks the extension metadata, the presence of the live-background
and clock code, the 441 × 44 px / 80 px layout tokens, both 1920×1080 images,
the cursor, and these greeter values using a system-only dconf profile:

```text
enabled-extensions  includes gdm-background@luis.local
clock-format        12h
clock-show-weekday  true
cursor-theme        WhiteSur-cursors
accent-color        slate
color-scheme        prefer-dark
picture-uri         file:///usr/local/share/backgrounds/luishowin/wpp.jpg
picture-uri-dark    file:///usr/local/share/backgrounds/luishowin/wpp.jpg
picture-options     zoom
icon-theme          WhiteSur-GDM
```

Log out and back in. The greeter is a fresh process; do not restart GDM (that
would kill the session).

Visual checklist:

- live blurred woodshop wallpaper, top clock and date visible;
- one avatar/name pill centred horizontally near the bottom;
- click the avatar: clock fades out, password pill appears beside the avatar
  and receives focus; the row stays 80 px above the bottom edge;
- wrong password shows the normal error below the row;
- click the avatar or press Escape: return to the avatar state and fade the
  clock back in;
- Options: compact 12 px accessibility toggles, Switch User, Restart,
  Power Off; toggle switches are visibly smaller;
- top-right quick settings/power still works;
- if the extension fails, the CSS fallback shows the blurred image and stock
  login is still usable.

**Misleading check:** `DCONF_PROFILE=gdm dconf read ...` as the logged-in user
reads `user-db:user` first and says nothing about the greeter. Use the
system-only profile in `verify.sh`.

---

## Rollback

```bash
cd ~/Documents/fedora-changes/gdm-login-parity
./revert.sh
```

This removes the dconf keyfile, extension, both wallpaper copies, the system
cursor copy and the generated `WhiteSur-GDM` icon theme, then runs
`dconf update`. The desktop and Super+L wallpaper are untouched. Log out and
back in to return to the flat GDM screen.

---

## Known gaps

- **Internal API.** `Main.screenShield._dialog`, `_authPrompt`, `_userWell`,
  `_inputWell`, `_authMenuButton`, `_onUserListActivated` and `_showUserList`
  are not public. Shell 51.1 is the only declared version. A GNOME update can
  require a fix; the extension is defensive but not future-proof.
- **No true local backdrop blur.** St cannot blur behind an individual actor.
  The wallpaper blur is real; the pills are translucent fills.
- **GDM's login flow remains.** The extension changes layout, not
  authentication. Password/fingerprint/PAM paths are unchanged.
- **Panel quick settings still exist.** The mockup has no visible top bar; a
  fully invisible bar would remove the only mouse-accessible power control.
- **Top-bar icons use GDM's default size.** The generated `WhiteSur-GDM` theme
  supplies the home artwork, but GDM keeps its 1.091em panel icon size, height
  and spacing. Matching the home bar's 23 px size is a separate CSS/JS step.
- **Clock format.** The large clock honours the greeter's `clock-format` but
  intentionally omits the AM/PM suffix: 12h renders `8:31`, 24h renders
  `20:31`. The date format is `%A %-d %B`.
- **Single-user assumption.** The avatar-pill layout is designed for one
  account. With multiple accounts the user list still works, but the “Not
  listed?” link is only hidden when AccountsService reports one user.
- **Assets are world-readable.** `/usr/local/share` is readable by every local
  user. The current image is a non-personal woodshop photo; a personal image
  should go in a gdm-private location.
- **The source SVG/JPEG references are not in the repo.** The installed copies
  remain, but a reinstall needs `~/Downloads/wpp.jpg` (or a supplied path).
