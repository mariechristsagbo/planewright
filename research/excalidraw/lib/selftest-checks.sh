# shellcheck shell=bash
# Sourced by selftest.sh, and by its tests with stub `curl` and `docker` commands. Each check
# returns 0 only on positive proof; a tool that cannot run proves nothing, so it fails.
# shellcheck source=resource-state.sh
. "$(dirname "${BASH_SOURCE[0]}")/resource-state.sh"

# The driver has stopped when a connection to its port is refused: curl exit 7. Any other
# result, including an answer, a timeout or a missing curl, fails.
driver_stopped() { # driver_stopped <port>
  local code=0
  curl -s -o /dev/null --max-time 5 "http://127.0.0.1:$1/" || code=$?
  [[ "$code" -eq 7 ]]
}

# The ARIA file exists, is not empty, and holds the redaction placeholder.
aria_redacted() { # aria_redacted <file>
  [[ -s "$1" ]] && grep -q 'room=<redacted>' "$1"
}

# The ARIA file exists, is not empty, and holds no room-shaped value. A missing or empty file
# fails, because grep finding nothing in it would prove nothing.
aria_without_room_value() { # aria_without_room_value <file>
  [[ -s "$1" ]] && ! grep -Eq 'room=[A-Za-z0-9_-]{20},' "$1"
}

# A container or network is removed only when a successful listing omits its name.
resource_removed() { # resource_removed <container|network> <name>
  [[ "$(resource_state "$1" "$2")" == ABSENT ]]
}
