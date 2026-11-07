# GDM Login

Rebuilds the Fedora 45 / GDM 51 logout screen around the **minimal single-user
layout** in `~/Downloads/log in.svg`, with the large clock treatment from
`~/Downloads/slate desktop.svg`.

The greeter shows:

- the supplied `wpp.jpg` wallpaper with a live 10 px blur and a 20% black scrim;
- a large time and date at the top;
- one avatar/name pill near the bottom centre;
- after clicking the avatar, the avatar pill plus a password pill side by side;
- the password pill keeps the submit chevron but drops the stock peek/eye icon,
  so the full “Password” hint fits;
- the top bar uses the generated `WhiteSur-GDM` icon theme (custom status
  artwork over WhiteSur actions/devices/places);
- one **Options** menu at the bottom right;
- a transparent top bar with the quick-settings/power control still available.

The clock fades out when authentication begins and fades back in when the user
returns to the avatar state.

The prompt row is fixed at **441 px** for the current `luishowin` account:
176 px user pill + 12 px gap + 253 px password pill. Both pills are **44 px**
tall (about 20% shorter than the previous 56 px) with a 22 px radius and a single
1 px border. The avatar is 30 px with a 7 px left inset — 5 px further left
than the previous 12 px. The password entry keeps only the submit chevron; its
stock peek/eye icon is disabled. The live background uses one full-screen 20%
black scrim, so there is no mid-screen overlay boundary.

Both the initial avatar pill and the password row are anchored **80 px above
the bottom edge**; the clock stays at the top. `LoginDialog` centres its
children internally, so `extension.js` applies a translation and recomputes it
on visibility, height and monitor changes. The fixed 44 px prompt keeps the row
in place while a password error message renders below it inside the 80 px
bottom gap.

The auth prompt's user widget is converted to horizontal as soon as its child
is set, and a prompt-scoped CSS rule fixes the avatar at 30 px. This avoids the
brief 160 px avatar flash during the greeter-to-password transition.

The **Options** trigger and popup items are 12 px, the popup rows use 3 px
vertical padding, and the toggle switches are 32 × 18 px.

The package is intentionally scoped to GDM. It does **not** change the desktop
wallpaper, the Super+L lock screen or the GTK theme. GDM gets its own minimal
icon theme, `WhiteSur-GDM`, generated from the user's WhiteSur and custom
status assets; the desktop icon theme is untouched.

## Why this needs an extension, not a setting

GDM is `gnome-shell --mode=gdm`, a separate process running as the `gdm` user
with its own dconf profile. The Super+L lock screen is the running user
session's `UnlockDialog`. They are different classes with different actors:

| | Super+L lock screen | GDM login screen |
|---|---|---|
| class | `UnlockDialog` | `LoginDialog` |
| clock | `.unlock-dialog-clock` | panel date menu (unless removed) |
| user selector | single user + prompt | `UserList` + `AuthPrompt` |
| background | live `BackgroundManager` | none |
| home directory | full | none (`/home/luishowin` is mode `700`) |

GDM does load system extensions when their metadata declares
`"session-modes": ["gdm"]` and their UUID is in the greeter's
`org.gnome.shell enabled-extensions` key. That is the supported hook this
package uses.

The extension does four things:

1. creates a live blurred wallpaper actor, matching the `UnlockDialog`
   `BackgroundManager` + `Shell.BlurEffect` pattern;
2. adds the large time/date and fades it when `AuthPrompt.visible` changes;
3. turns the single user item into the avatar pill and, once the auth prompt
   appears, lays the user pill and password entry out horizontally; both states
   are anchored 80 px above the bottom edge;
4. relabels the login-options button to **Options** and puts the accessibility
   toggles and power actions into its existing popup menu.

Everything optional is guarded. If an internal actor disappears in a future
Shell version, the extension logs the problem and stock GDM login still works.

## Install

The script writes to `/usr/local/share`, `/etc/dconf` and runs `dconf update`,
so it needs sudo. Run it as your user, **not** with `sudo ./install.sh`, so it
can read `~/Downloads/wpp.jpg`, `~/.local/share/icons/WhiteSur-cursors`,
`~/.local/share/icons/WhiteSur` and
`~/.local/share/icons/WhiteSur-System-Status-Custom`:

```bash
cd ~/Documents/fedora-changes/gdm-login-parity
./install.sh
```

By default it reads `~/Downloads/wpp.jpg` and crops it to 1920×1080. Pass
another path as the first argument. The image treatment is configurable:

```bash
./install.sh ~/Pictures/login.jpg
BLUR=14 DIM=24 ./install.sh
```

`BLUR` controls the pre-blurred CSS fallback (ImageMagick sigma). `DIM` controls
its brightness. The live `Shell.BlurEffect` in `extension.js` uses the
`BLUR_RADIUS = 10` constant; the live scrim is always one full-screen 20%
black layer. The fallback image has the same 20% dim baked in.

The greeter dconf block is:

```ini
[org/gnome/shell]
enabled-extensions=['gdm-background@luis.local']

[org/gnome/desktop/interface]
clock-format='12h'
clock-show-weekday=true
cursor-theme='WhiteSur-cursors'
icon-theme='WhiteSur-GDM'
accent-color='slate'
color-scheme='prefer-dark'

[org/gnome/desktop/background]
picture-uri='file:///usr/local/share/backgrounds/luishowin/wpp.jpg'
picture-uri-dark='file:///usr/local/share/backgrounds/luishowin/wpp.jpg'
picture-options='zoom'
```

The existing `/etc/dconf/db/gdm.d/10-luis-login-screen` is left alone; it still
sets `[org/gnome/login-screen] logo=''`.

## Verify

```bash
./verify.sh
```

It checks the extension, both wallpaper copies, the cursor theme, the
generated `WhiteSur-GDM` icon theme, the 441 × 44 px / 80 px layout tokens in
the CSS/JS, and the greeter dconf values using a **system-only** dconf profile.

Log out and back in after installing. The greeter is started fresh at logout;
there is no need to restart GDM (which would kill the session).

Checklist after the logout:

- the woodshop wallpaper is visible and blurred, with the large clock;
- the avatar pill is centred horizontally near the bottom;
- clicking the avatar fades the clock and shows the password pill beside it;
  the row stays bottom-anchored through the transition;
- the password entry is focused;
- a wrong password shows the usual error below the row;
- clicking the avatar again returns to the user-list state and fades the clock
  back in;
- **Options** opens compact 12 px accessibility toggles, Switch User, Restart
  and Power Off;
- the top-right Wi-Fi, battery, power and keyboard icons use the WhiteSur
  artwork from `WhiteSur-GDM` (at GDM's default icon size);
- the top-right quick settings/power control still works.

**Misleading check:** do not verify with

```bash
DCONF_PROFILE=gdm dconf read /org/gnome/desktop/interface/clock-format
```

as your user. The gdm profile starts with `user-db:user`, so that command reads
your user database, not the greeter's. Use a system-only profile, as
`verify.sh` does.

## Revert

```bash
./revert.sh
```

`./uninstall.sh` is a thin alias for the same operation.

It removes the dconf keyfile, extension, images, system cursor copy and the
generated `WhiteSur-GDM` icon theme, then runs `dconf update`. The desktop and
lock-screen wallpaper are untouched. Log out and back in to return to the flat
GDM background.

## Top bar

`install.sh` generates `/usr/local/share/icons/WhiteSur-GDM` from the user's
WhiteSur symbolic `actions`, `categories`, `devices`, `places` and `status`
directories, then overlays `WhiteSur-System-Status-Custom/status/symbolic` so
the home bar's exact padded status artwork is used. The theme inherits Adwaita
for anything outside the top bar, and the gdm profile sets
`icon-theme='WhiteSur-GDM'`.

The home top bar uses a 23 px icon size via Just Perfection. This package
currently changes only the **icon theme** in GDM; GDM's default panel icon
size, height and spacing are unchanged. Because the custom status SVGs use a
22 × 22 canvas with a 16 px optical box, they render smaller in GDM than the
23 px home-bar icons. Adding the 23 px CSS rule is a separate refinement if
size parity is wanted.

## Known gaps

- **St cannot blur behind an individual actor.** The wallpaper is genuinely
  blurred, but the pills use a 30% black fill, a 1 px white border and the
  rounded geometry from the mockup; they are not true local backdrop-blur
  surfaces.
- **The single-user layout uses internal Shell actors.** `_authPrompt`,
  `_userWell`, `_inputWell`, `_authMenuButton`, `_onUserListActivated` and
  `_showUserList` are stable in Shell 51.1 but not a public extension API.
  `metadata.json` therefore declares only shell version `51`.
- **The login flow is still GDM's.** The avatar click uses GDM's normal
  `AuthPrompt`; the extension changes layout, not authentication. Passwords,
  fingerprint/other PAM methods, retries and cancellation are unchanged.
- **The real account is used.** The mockup's “Anna” is a placeholder; the
  pill reads the current AccountsService avatar and name.
- **The clock honours the gdm clock format without an AM/PM suffix.** It is
  currently 12h and renders a bare `8:31` (matching the mockup); 24h renders
  `20:31`. Change `clock-format` in the gdm dconf keyfile if you want the other
  form. The panel's centre clock is hidden so it does not duplicate the large
  clock.
- **The top bar is not completely invisible.** The reference mockup has no bar;
  this package keeps the transparent panel with the quick-settings/power
  control so the greeter is recoverable without a keyboard shortcut.
- **The source image is not in the repository.** The installed copies remain
  if `~/Downloads/wpp.jpg` is deleted; re-running the installer then needs the
  source again.
- **The cursor is a snapshot.** Changes to
  `~/.local/share/icons/WhiteSur-cursors` require re-running `install.sh`.
- **The GDM icon theme is generated from user assets.** `install.sh` needs
  `~/.local/share/icons/WhiteSur` and `WhiteSur-System-Status-Custom`; the
  generated theme is a snapshot and must be regenerated after WhiteSur changes.
- **Top-bar icon size is still GDM's.** Theme-only means the home artwork is
  used at GDM's default size, not the home bar's 23 px.
- **The wallpaper is world-readable.** `/usr/local/share` is readable by every
  local user. It is the woodshop wallpaper; if a personal image is used later,
  move it to a gdm-private location and update the stylesheet/installer.
- **`#lockDialogGroup` and the CSS classes are Shell-theme details.** A future
  GNOME version could rename them; `verify.sh` checks files, not pixels.
