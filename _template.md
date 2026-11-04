# <change title>

**Live** as of <YYYY-MM-DD>.   <!-- or: Partial / Reverted / Superseded by <entry> -->

<One paragraph: the symptom or the goal, in the terms you'd use describing it out loud.>

---

## Root cause
<!-- For a fix. Delete for a pure feature/config entry.
     The important half: WHY the obvious approach failed. Include the command that
     proves it, so the claim can be re-checked rather than taken on faith. -->

---

## What changed

<!-- The diff in prose, plus the reasoning that is not visible in the diff. -->

---

## Files

| | |
|---|---|
| `path` | what it is |

---

## Verification

```bash
# commands that prove it works, and what the expected output is
```

<!-- Note any verification method that LOOKS right but is misleading. -->

---

## Rollback

```bash
```

---

## Known gaps
<!-- Deliberately not fixed, so they are not rediscovered as bugs later. -->
