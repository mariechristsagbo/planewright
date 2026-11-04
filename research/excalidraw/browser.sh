#!/usr/bin/env bash
# Disposable, container-isolated Chromium for behavioural research.
#
#   research/excalidraw/browser.sh start [name] [host-port]   # default: pw-research 9222
#   research/excalidraw/browser.sh stop  [name]
#
# Isolation: non-root user, every Linux capability dropped, no-new-privileges, no host mounts,
# and the profile lives in a tmpfs that disappears with the container. Chromium's own sandbox
# cannot run under the container's seccomp profile, so the container is the isolation boundary.
#
# DevTools exposure: Chromium binds DevTools to the container loopback. A small forwarder makes
# it reachable on the container interface, which Docker publishes on the host's 127.0.0.1 only.
# The container joins a network created for this run alone, with inter-container traffic
# disabled, and the forwarder accepts connections only from that network's gateway (the host
# side). Other containers, on this or any other Docker network, cannot reach DevTools.
# research/excalidraw/isolation-check.sh verifies this.
set -euo pipefail

# Pinned by digest: the tag v1.64.1-noble resolved to this image when the baseline was recorded.
IMAGE="mcr.microsoft.com/playwright:v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f"
CHROME="/ms-playwright/chromium-1248/chrome-linux64/chrome"
ACTION="${1:-}"
NAME="${2:-pw-research}"
PORT="${3:-9222}"
NET="${NAME}-net"

[[ "$NAME" =~ ^pw-[a-z0-9-]{1,40}$ ]] || { echo "name must match pw-[a-z0-9-]+" >&2; exit 2; }
[[ "$PORT" =~ ^[0-9]+$ ]] && ((PORT >= 1024 && PORT <= 65535)) ||
  { echo "host port must be 1024-65535" >&2; exit 2; }

start() {
  docker network create --driver bridge --label planewright.research=1 \
    --opt com.docker.network.bridge.enable_icc=false "$NET" >/dev/null
  local gateway
  gateway="$(docker network inspect "$NET" --format '{{(index .IPAM.Config 0).Gateway}}')"
  [[ "$gateway" =~ ^[0-9.]+$ ]] || { echo "no IPv4 gateway for $NET" >&2; docker network rm "$NET" >/dev/null; return 1; }
  docker run -d --rm --name "$NAME" --network "$NET" --label planewright.research=1 \
    --user pwuser --cap-drop ALL --security-opt no-new-privileges \
    --shm-size 1g --tmpfs /tmp:rw,size=1g,mode=1777 \
    -p "127.0.0.1:${PORT}:9223" \
    -e HOME=/tmp/home -e ALLOWED_PEER="$gateway" \
    --entrypoint node "$IMAGE" -e "
      const { spawn } = require('node:child_process');
      const net = require('node:net');
      spawn('$CHROME', [
        '--headless=new', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
        '--password-store=basic', '--disable-sync', '--disable-component-update',
        '--disable-background-networking', '--remote-debugging-address=127.0.0.1',
        '--remote-debugging-port=9222', '--user-data-dir=/tmp/profile',
        '--window-size=1280,720', '--lang=en-US', 'about:blank',
      ], { stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 1));
      const allowed = process.env.ALLOWED_PEER;
      net.createServer((client) => {
        // Only the host side of this run's network (Docker's published-port path) may connect.
        const peer = String(client.remoteAddress).replace(/^::ffff:/, '');
        if (peer !== allowed) {
          console.error('forwarder: refused a connection from a non-gateway peer');
          client.destroy();
          return;
        }
        const upstream = net.connect(9222, '127.0.0.1');
        client.pipe(upstream).pipe(client);
        upstream.on('error', () => client.destroy());
        client.on('error', () => upstream.destroy());
      }).listen(9223, '0.0.0.0');
    " >/dev/null
  for _ in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:${PORT}/json/version" >/dev/null; then
      curl -s "http://127.0.0.1:${PORT}/json/version" | grep -E '"Browser"'
      return 0
    fi
    sleep 0.5
  done
  echo "DevTools endpoint did not come up on 127.0.0.1:${PORT}" >&2
  return 1
}

stop() {
  docker stop "$NAME" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  echo "stopped $NAME and removed $NET"
}

case "$ACTION" in
  start) start ;;
  stop) stop ;;
  *) echo "usage: $0 start|stop [name] [host-port]" >&2; exit 2 ;;
esac
