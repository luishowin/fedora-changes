# Terminal prompt — `luishowin >`

**Live** as of 2026-11-04.

The default bash prompt showed `luishowin@probook:~$`. The hostname and working directory are
noise in a single-user laptop session; the request was the shorter `luishowin >`, with the
username in bold green.

---

## Root cause / mechanism

Fedora's `/etc/bashrc` sets the default prompt only when `PS1` is still bash's built-in default:

```bash
[ "$PS1" = "\\s-\\v\\\$ " ] && PS1="[\u@\h \W]\\$ "
```

`~/.bashrc` sources `/etc/bashrc`, then runs `mise activate bash`, pnpm and PATH setup. A `PS1`
assigned at the **end** of `~/.bashrc` wins over the earlier global value. No `/etc` change is
needed, and `mise` does not overwrite `PS1`.

---

## What changed

Appended to `~/.bashrc`:

```bash
# Prompt: bold green user, then a plain " > ". Overrides /etc/bashrc's
# [user@host dir]$ default, so no hostname or working directory is shown.
PS1='\[\e[1;32m\]\u\[\e[0m\] > '
```

The escape sequence breaks down as:

| part | effect |
|---|---|
| `\[` / `\]` | tell readline these bytes are non-printing, so line editing does not miscount |
| `\e[1;32m` | bold green |
| `\u` | username |
| `\e[0m` | reset colour |
| ` > ` | literal space, `>`, space |

Only the interactive user shell changes. Root's prompt, scripts, and non-bash shells are
untouched.

---

## Files

| | |
|---|---|
| `~/.bashrc` | four-line block appended after the Flutter PATH line |

---

## Verification

```bash
bash -ic 'printf "PS1=%s\n" "$PS1"' | tail -1
# PS1=\[\e[1;32m\]\u\[\e[0m\] > 
```

Or simply open a new terminal and confirm the prompt reads `luishowin >` with the username in
bold green. An already-open terminal keeps the old prompt until `source ~/.bashrc`.

**Misleading check:** running `echo $PS1` in the agent's non-interactive shell shows nothing,
because `~/.bashrc` is only sourced for interactive bash. Use `bash -ic` or a real terminal.

---

## Rollback

Delete the block from `~/.bashrc` and open a new terminal. The next login falls back to
`/etc/bashrc`'s `[user@host dir]$`.

---

## Known gaps

- The prompt no longer shows the working directory. `pwd` or a future `\w` addition is the way
  back if that becomes useful.
- The colour is hard-coded green; it does not follow the terminal theme's accent.
- This is bash-specific. A future switch to zsh/fish would need the equivalent `PROMPT`.
