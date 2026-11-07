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
  centred; its `UserWidget` is forced horizontal, spacing 21 px. The single
  account is shown as the avatar/name pill; the “Not listed?” link is hidden
  when there is only one account.
- **Password row:** `AuthPrompt` is changed to `Clutter.Orientation.HORIZONTAL`
  with 15 px spacing. Its internal `_userWell` is kept as the left pill and
  `_inputWell` becomes the right password pill. The stock cancel button is
  hidden; the avatar pill is the back control and Escape still works. Empty
  message labels are hidden so they do not add height. The stock peek/eye
  icon is disabled so the full “Password” hint fits; the submit chevron stays
  at the right.
- **Options:** the existing `AuthMenuButton` popup is reused, relabelled to
  “Options ›”, and made visible by its Switch User, Restart and Power Off
  items. Accessibility
  toggles are added as `PopupSwitchMenuItem`s; Restart and Power Off use
  `SystemActions`. The separate accessibility button is hidden.
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

### Assets and dconf

`install.sh` now:

- crops `~/Downloads/wpp.jpg` (or the path argument) to 1920×1080;
- writes the clear `wpp.jpg` and a 10 px, 20%-dim `wpp-blur.jpg` fallback;
- sets the greeter background URI to the clear image;
- keeps the WhiteSur cursor copy;
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
| `gdm-login-parity/install.sh` | images, cursor, gdm dconf |
| `gdm-login-parity/verify.sh` | files, design tokens, dconf |
| `gdm-login-parity/revert.sh` | remove system files and dconf |
| `/usr/local/share/gnome-shell/extensions/gdm-background@luis.local/` | installed extension |
| `/usr/local/share/backgrounds/luishowin/{wpp,wpp-blur}.jpg` | greeter wallpaper and fallback |
| `/etc/dconf/db/gdm.d/20-luis-login-parity` | extension, background, interface keys |

---

## Verification

```bash
cd ~/Documents/fedora-changes/gdm-login-parity
./install.sh
./verify.sh
```

`verify.sh` checks the extension metadata, the presence of the live-background
and clock code, both 1920×1080 images, the cursor, and these greeter values
using a system-only dconf profile:

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
```

Log out and back in. The greeter is a fresh process; do not restart GDM (that
would kill the session).

Visual checklist:

- live blurred woodshop wallpaper, top clock and date visible;
- one avatar/name pill centred;
- click the avatar: clock fades out, password pill appears beside the avatar
  and receives focus;
- wrong password shows the normal error below the row;
- click the avatar or press Escape: return to the avatar state and fade the
  clock back in;
- Options: accessibility toggles, Switch User, Restart, Power Off;
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

This removes the dconf keyfile, extension, both wallpaper copies and the
system cursor copy, then runs `dconf update`. The desktop and Super+L wallpaper
are untouched. Log out and back in to return to the flat GDM screen.

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
