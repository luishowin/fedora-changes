# GDM Login

Rebuilds the Fedora 45 / GDM 51 logout screen around the **minimal single-user
layout** in `~/Downloads/log in.svg`, with the large clock treatment from
`~/Downloads/slate desktop.svg`.

The greeter shows:

- the supplied `wpp.jpg` wallpaper with a live 10 px blur and a 20% black scrim;
- a large time and date at the top;
- one centred avatar/name pill;
- after clicking the avatar, the avatar pill plus a password pill side by side;
- the password pill keeps the submit chevron but drops the stock peek/eye icon,
  so the full “Password” hint fits;
- one **Options** menu at the bottom right;
- a transparent top bar with the quick-settings/power control still available.

The clock fades out when authentication begins and fades back in when the user
returns to the avatar state.

The prompt row is fixed at **555 px** for the current `luishowin` account:
224 px user pill + 15 px gap + 316 px password pill. The avatar has a 15 px
inset on all sides, and the password entry keeps only the submit chevron; its
stock peek/eye icon is disabled. The live background uses one full-screen 20%
black scrim, so there is no mid-screen overlay boundary.

The package is intentionally scoped to GDM. It does **not** change the desktop
wallpaper, the Super+L lock screen, the GTK theme or the icon theme.

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
   appears, lays the user pill and password entry out horizontally;
4. relabels the login-options button to **Options** and puts the accessibility
   toggles and power actions into its existing popup menu.

Everything optional is guarded. If an internal actor disappears in a future
Shell version, the extension logs the problem and stock GDM login still works.

## Install

The script writes to `/usr/local/share`, `/etc/dconf` and runs `dconf update`,
so it needs sudo. Run it as your user, **not** with `sudo ./install.sh`, so it
can read `~/Downloads/wpp.jpg` and `~/.local/share/icons/WhiteSur-cursors`:

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

It checks the extension, both wallpaper copies, the cursor theme, the design
tokens in the CSS/JS, and the greeter dconf values using a **system-only**
dconf profile.

Log out and back in after installing. The greeter is started fresh at logout;
there is no need to restart GDM (which would kill the session).

Checklist after the logout:

- the woodshop wallpaper is visible and blurred, with the large clock;
- the avatar pill is centred;
- clicking the avatar fades the clock and shows the password pill beside it;
- the password entry is focused;
- a wrong password shows the usual error below the row;
- clicking the avatar again returns to the user-list state and fades the clock
  back in;
- **Options** opens accessibility toggles, Switch User, Restart and Power Off;
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

It removes the dconf keyfile, extension, images and system cursor copy, then
runs `dconf update`. The desktop and lock-screen wallpaper are untouched. Log
out and back in to return to the flat GDM background.

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
- **The wallpaper is world-readable.** `/usr/local/share` is readable by every
  local user. It is the woodshop wallpaper; if a personal image is used later,
  move it to a gdm-private location and update the stylesheet/installer.
- **`#lockDialogGroup` and the CSS classes are Shell-theme details.** A future
  GNOME version could rename them; `verify.sh` checks files, not pixels.
