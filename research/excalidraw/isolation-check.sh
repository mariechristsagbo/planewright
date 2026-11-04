#!/usr/bin/env bash
# Verifies DevTools isolation of browser.sh without contacting any website: the browser stays on
# about:blank. Starts a disposable browser, then checks that
#   1. Docker publishes DevTools on the host's 127.0.0.1 only,
#   2. the host can use DevTools through 127.0.0.1:<port>,
#   3. a probe container on the default bridge cannot reach the browser's DevTools forwarder,
#   4. a probe container attached to the run's own network cannot reach it either,
#   5. a probe container cannot reach the published port through the default bridge gateway,
#   6. (control) a probe sharing the browser's network namespace does reach DevTools, which shows
#      the probe can detect reachability, and the forwarder refuses it on the container interface
#      because its source is not the run network's gateway,
# and finally that stopping removes both the container and the run's network.
#
#   research/excalidraw/isolation-check.sh [host-port]   # default 9242
#
# Prints one PASS/FAIL line per check and exits non-zero if any check fails. A probe that could
# not run, or printed anything but one known outcome, is a FAIL (see lib/probe-outcome.sh).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/probe-outcome.sh
. "$HERE/lib/probe-outcome.sh"
# shellcheck source=lib/resource-state.sh
. "$HERE/lib/resource-state.sh"
PORT="${1:-9242}"
NAME="pw-isocheck"
NET="${NAME}-net"
IMAGE="$(grep -E '^IMAGE=' "$HERE/browser.sh" | cut -d'"' -f2)"
failures=0

result() { # result <PASS|FAIL> <message>
  echo "$1 $2"
  [[ "$1" == PASS ]] || failures=$((failures + 1))
}

# Runs a throwaway, capability-free probe container that tries an HTTP GET on host:port and
# prints REACHABLE, UNREACHABLE:<reason> or PROBE-ERROR:<reason>.
probe() { # probe <network> <host> <port>
  local output code=0
  output="$(docker run --rm --network "$1" --user pwuser --cap-drop ALL --security-opt no-new-privileges \
    --entrypoint node "$IMAGE" -e "
      const net = require('node:net');
      const socket = net.connect({ host: process.argv[1], port: Number(process.argv[2]) });
      const done = (text) => { console.log(text); socket.destroy(); process.exit(0); };
      socket.setTimeout(4000, () => done('UNREACHABLE:timeout'));
      socket.on('error', (e) => done('UNREACHABLE:' + e.code));
      const request = 'GET /json/version HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n';
      socket.on('connect', () => socket.write(request));
      let data = '';
      socket.on('data', (d) => {
        data += d;
        if (data.includes('Browser')) done('REACHABLE');
      });
      socket.on('close', () => done('UNREACHABLE:closed-without-response'));
    " "$2" "$3" 2>/dev/null)" || code=$?
  probe_outcome "$code" "$output"
}

cleanup() { "$HERE/browser.sh" stop "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

"$HERE/browser.sh" start "$NAME" "$PORT" >/dev/null
browser_ip="$(docker inspect "$NAME" --format "{{(index .NetworkSettings.Networks \"$NET\").IPAddress}}")"
bridge_gw="$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}')"
icc="$(docker network inspect "$NET" --format '{{index .Options "com.docker.network.bridge.enable_icc"}}')"
# An empty or malformed address would aim every probe at the wrong place; stop instead.
ipv4='^([0-9]{1,3}[.]){3}[0-9]{1,3}$'
if ! [[ "$browser_ip" =~ $ipv4 && "$bridge_gw" =~ $ipv4 ]]; then
  echo "FAIL could not read the browser or default-bridge gateway IPv4 address"
  exit 1
fi

bindings="$(docker port "$NAME" 9223/tcp | sort -u | tr '\n' ' ')"
if [[ "$bindings" == "127.0.0.1:${PORT} " ]]; then
  result PASS "published only on 127.0.0.1:${PORT}"
else
  result FAIL "unexpected published bindings: ${bindings}"
fi
[[ "$icc" == false ]] && result PASS "run network ${NET} has inter-container traffic disabled" ||
  result FAIL "run network ${NET} enable_icc=${icc}"

if curl -sf "http://127.0.0.1:${PORT}/json/version" | grep -q '"Browser"'; then
  result PASS "host reaches DevTools on 127.0.0.1:${PORT}"
else
  result FAIL "host cannot reach DevTools on 127.0.0.1:${PORT}"
fi

for spec in "bridge ${browser_ip} 9223 default-bridge-probe->browser-forwarder" \
  "${NET} ${browser_ip} 9223 same-network-probe->browser-forwarder" \
  "${NET} ${browser_ip} 9222 same-network-probe->browser-devtools-loopback-port" \
  "bridge ${bridge_gw} ${PORT} default-bridge-probe->bridge-gateway-published-port"; do
  read -r network host port label <<<"$spec"
  outcome="$(probe "$network" "$host" "$port")"
  [[ "$outcome" == UNREACHABLE:* ]] && result PASS "${label}: ${outcome}" ||
    result FAIL "${label}: ${outcome}"
done

control="$(probe "container:${NAME}" 127.0.0.1 9222)"
[[ "$control" == REACHABLE ]] && result PASS "control: shared-namespace probe reaches 127.0.0.1:9222" ||
  result FAIL "control: shared-namespace probe got ${control}"
filtered="$(probe "container:${NAME}" "$browser_ip" 9223)"
[[ "$filtered" == UNREACHABLE:* ]] && result PASS "forwarder peer filter: non-gateway source ${filtered}" ||
  result FAIL "forwarder peer filter: non-gateway source ${filtered}"

refused="$(docker logs "$NAME" 2>&1 | grep -c 'refused a connection from a non-gateway peer' || true)"
echo "INFO forwarder refusals logged: ${refused}"

cleanup
trap - EXIT
# A failed docker listing is UNKNOWN, which fails: it can never pass as "removed".
for spec in "container ${NAME}" "network ${NET}"; do
  read -r kind item <<<"$spec"
  state="$(resource_state "$kind" "$item")"
  [[ "$state" == ABSENT ]] && result PASS "${kind} ${item} removed" ||
    result FAIL "${kind} ${item} after stop: ${state}"
done

echo "failures: ${failures}"
exit $((failures > 0))
