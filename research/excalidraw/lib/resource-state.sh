# shellcheck shell=bash
# Sourced by isolation-check.sh and selftest.sh. Reports whether a Docker container or network
# with exactly this name still exists, as PRESENT or ABSENT. When the listing itself fails (no
# daemon, no permission, no docker binary) nothing is known, so it prints UNKNOWN and the caller
# must count that as a failure, never as "removed".
resource_state() { # resource_state <container|network> <name>
  local names
  case "$1" in
    container) names="$(docker ps -a --format '{{.Names}}' 2>/dev/null)" || { echo UNKNOWN; return 0; } ;;
    network) names="$(docker network ls --format '{{.Name}}' 2>/dev/null)" || { echo UNKNOWN; return 0; } ;;
    *) echo UNKNOWN; return 0 ;;
  esac
  if grep -qxF -- "$2" <<<"$names"; then echo PRESENT; else echo ABSENT; fi
}
