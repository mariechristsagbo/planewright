#!/usr/bin/env bash
# Disposable, container-isolated Chromium for behavioural research.
#
#   research/excalidraw/browser.sh start [name] [host-port]   # default: pw-research 9222
#   research/excalidraw/browser.sh stop  [name]
#
# Isolation: non-root user, every Linux capability dropped, no-new-privileges, no host mounts,
# the profile lives in a tmpfs that disappears with the container, and the DevTools port is
# published on the host loopback interface only. Chromium's own sandbox cannot run under the
# container's seccomp profile, so the container is the isolation boundary.
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v1.64.1-noble"
CHROME="/ms-playwright/chromium-1248/chrome-linux64/chrome"
ACTION="${1:-}"
NAME="${2:-pw-research}"
PORT="${3:-9222}"

start() {
  docker run -d --rm --name "$NAME" \
    --user pwuser --cap-drop ALL --security-opt no-new-privileges \
    --shm-size 1g --tmpfs /tmp:rw,size=1g,mode=1777 \
    -p "127.0.0.1:${PORT}:9223" \
    -e HOME=/tmp/home \
    --entrypoint node "$IMAGE" -e "
      const { spawn } = require('node:child_process');
      const net = require('node:net');
      // Chromium binds DevTools to the container loopback; forward it to the published port.
      spawn('$CHROME', [
        '--headless=new', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
        '--password-store=basic', '--disable-sync', '--disable-component-update',
        '--disable-background-networking', '--remote-debugging-address=127.0.0.1',
        '--remote-debugging-port=9222', '--user-data-dir=/tmp/profile',
        '--window-size=1280,720', '--lang=en-US', 'about:blank',
      ], { stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 1));
      net.createServer((client) => {
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

case "$ACTION" in
  start) start ;;
  stop) docker stop "$NAME" >/dev/null && echo "stopped $NAME" ;;
  *) echo "usage: $0 start|stop [name] [host-port]" >&2; exit 2 ;;
esac
