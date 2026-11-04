# Cleanup follow-up — the kernel meta-package trap

**Live** as of 2026-11-04. The corrected removal was executed and both old kernel trees are gone.

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

Removing `kernel-core` also removed the matching `/boot/vmlinuz-*` and `/boot/initramfs-*`
files through the kernel scriptlets; no manual file deletion was needed.

## Final result

| item | before | after |
|---|---|---|
| F44 kernel payload packages | 8 packages | none |
| `/usr/lib/modules/7.2.1{3,4}-200.fc44` | 340 MB | removed |
| `/boot/initramfs-7.2.1{3,4}-200.fc44.img` | 148 MB | removed |
| `/boot` usage | 609 MB | 402 MB |
| `/var/cache/dnf5daemon-server/` | 207 MB | 0 |

Only `kernel-core-7.2.15-300.fc45.x86_64`, the official rescue initramfs and the fc45 initramfs
remain in `/boot`.

---

## Files

| | |
|---|---|
| `2026-11-04-fedora-45-upgrade.md` | first-pass commands and result table; marked revised |
| `README.md` | index status updated |
| `kernel-core-7.2.1{3,4}-200.fc44` + modules | removed; initramfs and GRUB entries followed |
| `/var/cache/dnf5daemon-server/` | 207 MB removed |

---

## Verification

```bash
rpm -qa 'kernel*' | grep fc44 || echo clean   # clean
rpm -q kernel-core                             # only kernel-core-7.2.15-300.fc45.x86_64
df -h /boot                                    # ~402 MB used
du -sh /var/cache/dnf5daemon-server            # 0
```

---

## Rollback

The old kernels are not needed once the F45 kernel has booted successfully. Reinstalling them
would require the F44 repository, which is no longer configured; treat this as one-way.

---

## Known gaps

- The 263 MB rescue initramfs is still deliberately kept.
- The `.fc44` libraries (`simdutf`, `zimg`, `jsoncpp`, etc.) are still required by F45 binaries;
  do not remove them.
