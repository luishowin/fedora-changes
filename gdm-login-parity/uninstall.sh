#!/usr/bin/env bash
# Remove the GDM login-screen parity package.  This is a thin alias for
# revert.sh; there is no installed copy to archive beyond the system files it
# removes.
set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
"$script_dir/revert.sh"
