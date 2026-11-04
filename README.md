# Fedora changes — `aero-fedora`, Fedora 45 / GNOME Shell 51.1

A running log of every deliberate change made to this system: what changed, why it had to be
done that way, how to verify it, and how to undo it.

Started 2026-09-12.

---

## How this works

One file per change, named `YYYY-MM-DD-short-slug.md`. Start one by copying `_template.md`.

Entries are **append-only**. When a change is later revised, add a new dated entry and link back
rather than rewriting history — the index below is the only part that gets edited.

The rule that makes this worth keeping: **record the constraint, not just the fix.** Anything
that cost real investigation — a protocol GNOME deliberately doesn't implement, a function that
isn't introspectable, a GTK4 app that still reads a GTK3 path — belongs in the entry. That is
the part you cannot re-derive from a diff six months later.

---

## Index

| date | change | status |
|---|---|---|
| 2026-09-12 | [Nautilus "Copy Path" — in-process clipboard + GPaste](2026-09-12-nautilus-clipboard.md) | retired — GPaste and nautilus-python removed on F45 |
| 2026-09-12 | [Top bar clock — the weekday, and what the macOS reference already matched](2026-09-12-top-bar-clock-weekday.md) | live — the `clock-show-weekday` setting survives |
| 2026-09-12 | [Clock — macOS date/time spacing, and greeter parity](2026-09-12-clock-gap-and-greeter.md) | retired — `topbar-clock` removed on F45; greeter half superseded by the 2026-11-05 GDM entry |
| 2026-11-04 | [Fedora 45 upgrade — dead extensions, caches and stale state](2026-11-04-fedora-45-upgrade.md) | live — cleanup complete |
| 2026-11-04 | [Cleanup follow-up — the kernel meta-package trap](2026-11-04-cleanup-followup.md) | live — corrected removal executed |
| 2026-11-04 | [Top bar and Control Center — weight, icon size, blur, corners](2026-11-04-panel-and-control-center.md) | live — blur half revised by the entry below |
| 2026-11-04 | [Control Center live blur — show the app, not the wallpaper](2026-11-04-control-center-live-blur.md) | live |
| 2026-11-04 | [Power profile icon — leaf, bolt, and a 23 px panel](2026-11-04-power-profile-icons.md) | live |
| 2026-11-05 | [GDM login screen — wallpaper, clock and cursor parity](2026-11-05-gdm-login-parity.md) | live |
| 2026-11-04 | [Terminal prompt — `luishowin >`](2026-11-04-terminal-prompt.md) | live |
| 2026-11-04 | [Public repo — `luishowin/fedora-changes`](2026-11-04-public-repo.md) | live |

---

## Not yet written up

Already on this machine from earlier sessions, verified present on disk. Listed so the log knows
what it is missing; backfill as each one next gets touched.

| what | lives in | last touched |
|---|---|---|
| **WhiteSur-Dark** GTK3 theme — the shell-theme half did not survive the F45 upgrade | `~/.themes/WhiteSur-Dark/` | 2026-10-07 |
| libadwaita variable overrides, matching the same neutral-grey design system | `~/.config/gtk-4.0/gtk.css` | 2026-10-08 |
| WhiteSur icons, cursors, and the custom system-status icon theme | `~/.local/share/icons/` | 2026-10-20 |
| 8 Shell extensions — 7 maintained plus `panel-tweaks@luis.local` | `org.gnome.shell enabled-extensions` | 2026-11-04 |

---

## Where things live

The customisation surface of this machine, in one table.

| | |
|---|---|
| `~/.local/share/gnome-shell/extensions/` | user extensions: `panel-tweaks@luis.local`, and the user copy of Blur My Shell that shadows the incomplete Fedora RPM |
| `/usr/local/share/gnome-shell/extensions/gdm-background@luis.local/` | GDM-only extension that puts the wallpaper behind the login dialog |
| `/usr/local/share/backgrounds/luishowin/` | clear and pre-blurred `wpp.jpg` used by the GDM greeter |
| `/usr/local/share/icons/WhiteSur-cursors/` | system copy of the cursor theme, for the GDM greeter |
| `~/.themes/WhiteSur-Dark/` | GTK3 theme. There is no shell theme on F45 — the User Themes extension is not installed |
| `~/.config/gtk-4.0/gtk.css` | libadwaita overrides, guarded by `@media (prefers-color-scheme: dark)` |
| `~/.config/gtk-3.0/bookmarks` | Nautilus sidebar rows — GTK4 Nautilus still reads the **gtk-3.0** path |
| `~/.local/share/icons/` | WhiteSur icons, cursors, and `WhiteSur-System-Status-Custom` |
| `dconf` / `gsettings` | everything not file-backed; `dconf dump /` for a full snapshot |

---

## Things that bite repeatedly

Collected across entries, because each one has cost time more than once.

- **Wayland has no Shell restart.** `Alt+F2` → `r` does not exist. A newly installed extension
  cannot load until the next login, and `gnome-extensions enable` fails for a UUID the running
  Shell has never enumerated — write it into `org.gnome.shell enabled-extensions` via `gsettings`
  instead, as a standalone command.
- **There is no User Themes extension.** `org.gnome.shell.extensions.user-theme` does not exist
  on this Fedora 45 install, and `~/.local/share/themes/` is inert without it. Panel styling is
  done by a small extension's `stylesheet.css` (`panel-tweaks@luis.local`). Disabling and
  re-enabling an already-loaded extension reloads its stylesheet; a new extension still costs a
  login.
- **A clean journal proves nothing.** `gnome-extensions info <uuid>` reports `State: ACTIVE`
  independently of whether the CSS matched anything. A stylesheet that was never loaded logs
  exactly the same silence as one that loaded fine.
- **Removing an old Fedora kernel by its `kernel-<version>` name can be a no-op.** Once the
  `kernel` meta-package is gone, the payload is `kernel-core`, `kernel-modules`,
  `kernel-modules-core` and `kernel-modules-extra`. `rpm -q kernel` then looks clean while
  `/usr/lib/modules` and `/boot` are still full. Remove the payload packages by their full
  version.
- **`dnf clean all` does not clear `/var/cache/dnf5daemon-server/`.** That cache belongs to the
  dnf5 daemon and can still hold hundreds of megabytes after the dnf caches report zero.
- **St implements a small CSS subset** — no `display`, no `visibility`. Hiding a Shell element
  requires an extension.
- **The Fedora 45 Blur My Shell RPM is incomplete.** It ships `stylesheet.css` but not the
  `styles/` directory that file `@import`s. The Clutter effects still run, but popup backgrounds
  stay opaque and every panel style class is inert. Install the upstream zip into the **user**
  extensions directory (v77 as of this writing) and log out; do not edit `/usr`.
- **Static popup blur shows the wallpaper, not the application behind it.** BMS's static path
  samples `Meta.BackgroundGroup`; the dynamic path uses `BackdropCaptureEffect` and sees the
  composited windows. BMS 77 rounds dynamic surfaces in its own `RoundedPipeline`, so
  `gnome-rounded-blur` is no longer required (it was for 75/76, where
  `rounded-blur-found=false` meant a square dynamic surface). Keep
  `popup static-blur=false` for a live material.
- **Blur My Shell sets `panel.override-background = true`**, so any `#panel { background-color }`
  rule is inert. The panel style comes from BMS's `.transparent-panel` / `.dark-panel` classes.
- **`#panel` CSS is weaker than it looks.** `color` on a bare `#panel` (1,0,0) never reaches a
  button — stock already sets `#ffffff` on `.panel-button` (1,1,0) and `.clock-display` (1,2,0).
  The clock is also stock `font-weight: bold` on those same high-specificity rules, so a weight
  change needs a matching selector and `!important`. And `padding` moves nothing:
  `Panel.vfunc_allocate` allocates `_rightBox` off the raw allocation and never calls
  `get_content_box()`, just as `ButtonBox` ignores it for buttons. The only lever on panel spacing
  is `-natural-hpadding`.
- **A symbolic SVG's canvas is part of its optical size.** GNOME renders a 22×22 SVG at the same
  St `icon-size` as a 16×16 one, so a full-bleed 16×16 icon looks roughly a third larger than a
  22×22 icon whose art occupies a 16×16 box. Mixing icon sources requires matching the optical
  box, not just the `panel-icon-size` value. The power-profile and padded-panel work on
  2026-11-04 exists because WhiteSur's power-profile SVGs were 16×16 while the custom status
  overrides were 22×22.
- **The logout screen is not the lock screen.** Super+L locks the running user session;
  logging out starts a separate `gnome-shell --mode=gdm` process as the `gdm` user with its own
  dconf profile. `layout.js` skips desktop background actors for greeters and `LoginDialog` does
  not add one, so the login screen is the shell theme's flat
  `#lockDialogGroup { background-color: #222226 }`. The user's wallpaper/themes are also
  unreachable because `/home/luishowin` is mode `700`. A GDM-only extension with
  `"session-modes": ["gdm"]` is the clean place to add a login background.
- **`DCONF_PROFILE=gdm dconf read` as the user is misleading.** `/usr/share/dconf/profile/gdm`
  starts with `user-db:user`, so that command reads your user database first and appears to show
  the user's background/themes. To see what the greeter actually sees, use a temporary profile
  containing only `system-db:gdm`, `system-db:local`, `system-db:site`, `system-db:distro` and
  `file-db:/usr/share/gdm/greeter-dconf-defaults`.
- **The clock format is not a setting.** The four `clock-*` keys only select one of nine C
  strings inside `libgnome-desktop-4`; `_` in them renders as U+2002 and `%l`'s pad as U+2007.
  `en_GB` gets the untranslated American order only because Fedora ships no `gnome-desktop-4.0`
  catalogue — the reordered `gnome-desktop-3.0` string is already on disk, unused.
- **Flatpak apps need** `flatpak override --user --filesystem=xdg-config/gtk-4.0:ro` to see
  `gtk.css` (already granted).
