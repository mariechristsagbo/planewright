#!/usr/bin/env bash
# End-to-end self-test of the research driver in a disposable browser, without contacting any
# website: it loads only about:blank and the self-authored fixtures/selftest.html. It checks
# the metric assertions (pass and fail-fast), the navigation allowlist, ARIA redaction,
# screenshot masking (including a pixel check of the written PNG) and refusal, failure logging,
# token permissions and authenticated shutdown.
#
#   research/excalidraw/selftest.sh [cdp-port] [driver-port]   # default 9252 9353
#
# Prints PASS/FAIL lines and exits non-zero if any check fails. Needs docker, node and jq.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/resource-state.sh
. "$HERE/lib/resource-state.sh"
CDP_PORT="${1:-9252}"
DRIVER_PORT="${2:-9353}"
NAME="pw-selftest"
WORK="$(mktemp -d)"
OUT="$WORK/session"
failures=0

result() { echo "$1 $2"; [[ "$1" == PASS ]] || failures=$((failures + 1)); }
check() { # check <message> <command...>
  local message="$1"
  shift
  if "$@"; then result PASS "$message"; else result FAIL "$message"; fi
}
cleanup() {
  "$HERE/browser.sh" stop "$NAME" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$WORK/fixtures" "$OUT"
cp "$HERE/fixtures/selftest.html" "$WORK/fixtures/"
"$HERE/browser.sh" start "$NAME" "$CDP_PORT" >/dev/null
node "$HERE/driver.mjs" --cdp "http://127.0.0.1:${CDP_PORT}" --port "$DRIVER_PORT" --out "$OUT" \
  >"$WORK/driver.log" 2>&1 &
for _ in $(seq 1 40); do [[ -s "$OUT/driver.token" ]] && break; sleep 0.25; done
sleep 0.5
run() { node "$HERE/run.mjs" --port "$DRIVER_PORT" --out "$OUT" "$@"; }

check "token file has mode 600" test "$(stat -c '%a' "$OUT/driver.token")" = 600

desktop="$(run '{"steps":[{"do":"emulate","width":1280,"height":720}]}')"
check "desktop emulation passes its read-back assertion" \
  test "$(jq -r '.[0].result.screenWidth' <<<"$desktop")" = 1280

mobile="$(run '{"continueOnError":true,"steps":[
  {"do":"emulate","width":390,"height":844,"deviceScaleFactor":3,"mobile":true,"hasTouch":true},
  {"do":"fixture","name":"selftest.html"},
  {"do":"wait","ms":300},
  {"do":"assertMetrics","expect":{"innerWidth":390,"innerHeight":844,"devicePixelRatio":3,
    "screenWidth":390,"maxTouchPoints":5,"coarsePointer":true,"canvasBacking":true}},
  {"do":"goto","url":"https://example.com/"},
  {"do":"goto","url":"file:///etc/passwd"},
  {"do":"aria","save":"selftest-dialog"},
  {"do":"screenshot","name":"selftest-masked","mask":["[role=dialog] input","[role=dialog] img"]},
  {"do":"assertMetrics","expect":{"innerWidth":390,"devicePixelRatio":3,"screenWidth":390,
    "screenHeight":844,"canvasBacking":true}},
  {"do":"screenshot","name":"selftest-unmasked","mask":["#does-not-exist"]},
  {"do":"emulate","width":390,"height":844,"deviceScaleFactor":3,"mobile":true,"hasTouch":true,
    "expect":{"devicePixelRatio":2}},
  {"do":"metrics"}
]}')"
check "mobile fixture reads 390x844 at DPR 3 with a matching canvas backing store" \
  test "$(jq -r '.[3].result.canvases[0].width' <<<"$mobile")" = 1170
check "navigation outside the reference origin is refused" \
  test "$(jq -r '[.[4].error, .[5].error] | map(startswith("Navigation refused")) | all' <<<"$mobile")" = true
check "ARIA snapshot is redacted before it is written" \
  grep -q 'room=<redacted>' "$OUT/aria/selftest-dialog.yml"
check "no room-shaped value reaches the ARIA file" \
  bash -c "test -s '$OUT/aria/selftest-dialog.yml' && ! grep -Eq 'room=[A-Za-z0-9_-]{20},' '$OUT/aria/selftest-dialog.yml'"
check "masked screenshot is written with 2 masks at device-pixel size (1170 px wide)" \
  test "$(jq -r '[.[7].result.masks, .[7].result.width] | join(",")' <<<"$mobile")" = "2,1170"
check "a capture leaves DPR 3 and the emulated screen intact" \
  test "$(jq -r '.[8].error' <<<"$mobile")" = null
check "a mask that matches nothing writes no file" \
  test ! -e "$OUT/screenshots/selftest-unmasked.png"
check "a metrics mismatch is fatal and stops the batch" \
  test "$(jq -r '(.[10].fatal == true) and (length == 11)' <<<"$mobile")" = true
check "masked regions are fully painted in the written PNG (pixel check)" \
  node "$HERE/check-masks.mjs" "$OUT"
refused="$(run '{"steps":[{"do":"screenshot","name":"selftest-refused","refuseIf":["[role=dialog]"]}]}' || true)"
check "a screenshot is refused while a refuseIf element is present" \
  test "$(jq -r '.[0].error' <<<"$refused")" = "Screenshot refused: a refuseIf selector is present."
check "a refused screenshot writes no file" test ! -e "$OUT/screenshots/selftest-refused.png"
check "every step, including failures, is in the timeline" \
  test "$(wc -l <"$OUT/timeline.jsonl")" -ge 11
check "failed rows carry a sanitised error" \
  test "$(jq -s '[.[] | select(.error)] | length' "$OUT/timeline.jsonl")" -ge 4

quit="$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:${DRIVER_PORT}/quit")"
check "unauthenticated POST /quit is refused (401)" test "$quit" = 401
run --quit >/dev/null
sleep 1
# curl exit 7 means the connection was refused; any other failure (such as no curl) proves nothing.
check "authenticated quit stops the driver" \
  bash -c "curl -s -o /dev/null 'http://127.0.0.1:${DRIVER_PORT}/'; test \$? -eq 7"

cleanup
trap - EXIT
# A failed docker listing is UNKNOWN, which fails: it can never pass as "removed".
check "browser container removed" test "$(resource_state container "$NAME")" = ABSENT
check "browser network removed" test "$(resource_state network "$NAME-net")" = ABSENT
echo "failures: ${failures}"
exit $((failures > 0))
