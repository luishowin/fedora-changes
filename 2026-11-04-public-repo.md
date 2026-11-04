# Public repo — `luishowin/fedora-changes`

**Live** as of 2026-11-04.

The change log had been a local folder since 2026-09-12. It is now a public GitHub repository:

<https://github.com/luishowin/fedora-changes>

---

## What was published

- All dated entries, `_template.md` and the `README.md` index.
- The extension packages: `whitesur-system-status-custom/`, `topbar-status-sizing@luis.local/`
  (marked superseded) and `panel-tweaks@luis.local/`.
- `output/pdf/product-entry-form-solution.md`, a Markdown conversion of the unrelated PDF that
  was sitting in `output/`.

The PDF itself stays on disk but is excluded from git. `tmp/` was empty (`tmp/pdfs/` had no
files), so there was nothing to convert; the whole directory is ignored.

## Exclusions

`.gitignore`:

```gitignore
# Local artifacts; the markdown conversion is tracked instead.
output/pdf/*.pdf

# Scratch space
tmp/

# Editor / Python cruft
__pycache__/
*.pyc
.venv/
.DS_Store
```

No credentials or private keys were found in the tree before publishing. The only sensitive
string the scan flagged was the word “password” inside the Nautilus clipboard entry.

## Git identity

`gh auth` is only used to create the repository and push. Git records a separate **author
email** in every commit, and the global config points at a personal Gmail address. The repo uses
a local override instead, so the Gmail is not exposed in public commit metadata:

```bash
git config user.name "Luis Howin"
git config user.email "62960965+luishowin@users.noreply.github.com"
```

The numeric prefix is the GitHub account ID, which is what makes GitHub attribute the commit to
the account without publishing the real address.

## Commands used

```bash
cd ~/Documents/fedora-changes
git init -b main
git add -A
git commit -m "Log Fedora 45 / GNOME 51 desktop changes"

gh repo create luishowin/fedora-changes --public \
  --description "Deliberate Fedora 45 / GNOME 51 desktop changes, with root causes and rollback"

git remote add origin git@github.com:luishowin/fedora-changes.git
git push -u origin main
```

---

## Files

| | |
|---|---|
| `.gitignore` | PDF, `tmp/`, Python/editor artefacts |
| `output/pdf/product-entry-form-solution.md` | converted from the PDF |
| `.git/` | new repository, branch `main` |
| `https://github.com/luishowin/fedora-changes` | public remote |

---

## Verification

```bash
git remote -v
git log --oneline --decorate -1
gh repo view luishowin/fedora-changes --json url,visibility,defaultBranchRef
```

Expected visibility: `PUBLIC`. Expected default branch: `main`.

**Misleading check:** a successful `git push` does not prove the files are public; check the
visibility field and open the URL without being signed in.

---

## Rollback

Make the repository private:

```bash
gh repo edit luishowin/fedora-changes --visibility private --accept-visibility-change-consequences
```

Or delete it with `gh repo delete luishowin/fedora-changes` — that removes the remote and the
issues/settings, but not the local `.git` directory.

---

## Known gaps

- No licence file was added. Without one, the default is all rights reserved; add an explicit
  licence if the scripts are meant to be reusable.
- The repository contains no build/CI setup. The extension packages are installed by their own
  `install.sh` scripts, not by the repo.
- The PDF conversion is a hand-built Markdown version of the two-page PDF, not a byte-for-byte
  extraction; the form mock-up is represented as a text sketch rather than an image.
