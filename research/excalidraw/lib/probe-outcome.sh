# shellcheck shell=bash
# Sourced by isolation-check.sh. Classifies one isolation probe run.
#
# A probe counts as evidence only when its container ran to completion (exit 0) and printed
# exactly one known outcome. Anything else, such as a docker or image error, a crash, extra output
# or a socket error that points at a bad probe target (ENOTFOUND, EINVAL, ...), is a probe error,
# which isolation-check.sh reports as FAIL and never as isolation.
probe_outcome() { # probe_outcome <probe container exit code> <probe output>
  if [[ "$1" != 0 ]]; then
    echo "PROBE-ERROR:exit-$1"
    return 0
  fi
  case "$2" in
    REACHABLE | UNREACHABLE:timeout | UNREACHABLE:ECONNREFUSED | UNREACHABLE:ECONNRESET | \
      UNREACHABLE:EHOSTUNREACH | UNREACHABLE:ENETUNREACH | UNREACHABLE:closed-without-response)
      echo "$2"
      ;;
    *) echo "PROBE-ERROR:unexpected-output" ;;
  esac
}
