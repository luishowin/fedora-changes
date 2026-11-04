# Cleanup follow-up — the kernel meta-package trap

**Partial** as of 2026-11-04. The first sudo pass ran, but the two old kernels are still on disk
because only the `kernel` meta-packages were named.

The first cleanup block completed without errors:

```text
No packages to remove for argument: kernel-7.2.13-200.fc44.x86_64
No packages to remove for argument: kernel-7.2.14-200.fc44.x86_64
Nothing unused to uninstall
Removed 0 files, 0 directories (total of 0 B). 0 errors occurred.
Vacuuming done, freed 0B ...
```

Yet the system still had:

```bash
rpm -qa 'kernel*' | grep fc44
# kernel-core-7.2.13-200.fc44.x86_64
# kernel-modules-7.2.13-200.fc44.x86_64
# kernel-modules-core-7.2.13-200.fc44.x86_64
# kernel-modules-extra-7.2.13-200.fc44.x86_64
# ... the same four for 7.2.14 ...
```

and 170 MB per old `modules` tree plus 74 MB per old initramfs under `/boot`.

---

## Root cause

Fedora splits a kernel into `kernel-core`, `kernel-modules`, `kernel-modules-core` and
`kernel-modules-extra`. The `kernel` package is only a meta-package that ties them together.
Removing `kernel-7.2.13-200.fc44` therefore removes nothing if the meta-package is already absent;
the four real packages remain installed and still own `/usr/lib/modules/<ver>` and the
`/boot/initramfs-<ver>.img` files.

Verify ownership before removing:

```bash
rpm -qf /boot/initramfs-7.2.13-200.fc44.x86_64.img
# kernel-core-7.2.13-200.fc44.x86_64
```

`dnf clean all` also left 207 MB in `/var/cache/dnf5daemon-server/`. That cache belongs to the
`dnf5daemon-server` service, not to the CLI cache in `/var/cache/libdnf5` (which did go to 4 KB).

## Verified first-pass results

| item | before | after |
|---|---|---|
| journal | 168.5 MB | 98.3 MB |
| `/var/cache/libdnf5` | 187 MB | 4 KB |
| `/var/cache/swcatalog` | 58 MB | 0 |
| `/var/cache/fwupd` | 32 MB | 0 |
| Flatpak unused runtimes | — | nothing unused |
| old kernel modules | 340 MB | still present |
| old initramfs | 148 MB | still present |
| `/var/cache/dnf5daemon-server` | 207 MB | still present |

## Corrected command

```bash
# Confirm the running kernel is still 7.2.15-300.fc45.x86_64 first.
uname -r

sudo dnf remove \
  kernel-core-7.2.13-200.fc44.x86_64 \
  kernel-modules-7.2.13-200.fc44.x86_64 \
  kernel-modules-core-7.2.13-200.fc44.x86_64 \
  kernel-modules-extra-7.2.13-200.fc44.x86_64 \
  kernel-core-7.2.14-200.fc44.x86_64 \
  kernel-modules-7.2.14-200.fc44.x86_64 \
  kernel-modules-core-7.2.14-200.fc44.x86_64 \
  kernel-modules-extra-7.2.14-200.fc44.x86_64

# The daemon cache is not touched by `dnf clean all`.
sudo rm -rf /var/cache/dnf5daemon-server/*

df -h /boot
rpm -qa 'kernel*' | grep fc44 || echo "no fc44 kernels left"
```

Removing `kernel-core` should also remove the matching `/boot/vmlinuz-*` and
`/boot/initramfs-*` files; check `/boot` after the command rather than deleting them by hand.

---

## Files

| | |
|---|---|
| `2026-11-04-fedora-45-upgrade.md` | first-pass commands and result table; marked revised |
| `README.md` | index status updated |
| `/var/cache/dnf5daemon-server/` | still to be cleared manually |

---

## Verification

```bash
rpm -qa 'kernel*' | grep fc44 || echo clean
du -sh /usr/lib/modules/7.2.13-200.fc44.x86_64 2>/dev/null || true
df -h /boot
du -sh /var/cache/dnf5daemon-server
```

---

## Rollback

The old kernels are not needed once the F45 kernel has booted successfully. Reinstalling them
would require the F44 repository, which is no longer configured; treat this as one-way.

---

## Known gaps

- The corrected `dnf remove` has not been run yet. The entry is partial until it is.
- The 263 MB rescue initramfs is still deliberately kept.
- The `.fc44` libraries (`simdutf`, `zimg`, `jsoncpp`, etc.) are still required by F45 binaries;
  do not remove them.
