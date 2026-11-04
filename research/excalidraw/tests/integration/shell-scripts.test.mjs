// Runs browser.sh, isolation-check.sh, lib/probe-outcome.sh and check-masks.mjs against stub
// `docker`, `curl` and `sleep` commands placed first on PATH. No container or browser is started
// and no website is contacted; the stubs only print canned answers and log their arguments.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { encodePng, paintBoxes } from '../../lib/png.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = mkdtempSync(join(tmpdir(), 'pw-shell-test-'));
const bin = join(dir, 'bin');
const log = join(dir, 'docker.log');
const NET_ID = 'a'.repeat(64);
const CID = 'c'.repeat(64);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const DOCKER = `#!/usr/bin/env bash
echo "$1 $2 $3" >>"$FAKE_LOG"
case "$1 $2" in
  "network create") [[ "\${FAKE_NET_CREATE:-ok}" == ok ]] || exit 1; echo "$FAKE_NET_ID" ;;
  "network inspect")
    case "$*" in
      *" bridge "*) echo 172.17.0.1 ;;
      *Gateway*) echo 172.30.0.1 ;;
      *enable_icc*) echo false ;;
      *) [[ -n "\${FAKE_NET_LABEL:-}" ]] || exit 1; echo "$FAKE_NET_LABEL" ;;
    esac ;;
  "container inspect") [[ -n "\${FAKE_CONTAINER_LABEL:-}" ]] || exit 1; echo "$FAKE_CONTAINER_LABEL" ;;
  "run -d") [[ "\${FAKE_RUN:-ok}" == ok ]] || exit 125; echo "$FAKE_CONTAINER_ID" ;;
  "run --rm") printf '%s' "\${FAKE_PROBE_OUT:-}"; exit "\${FAKE_PROBE_EXIT:-0}" ;;
  "ps -a" | "network ls") [[ "\${FAKE_LIST:-ok}" == ok ]] || exit 1; printf '%s\\n' \${FAKE_NAMES:-} ;;
  inspect\\ *) echo "\${FAKE_BROWSER_IP-172.30.0.2}" ;;
  port\\ *) echo "127.0.0.1:9242" ;;
esac
exit 0
`;
mkdirSync(bin);
writeFileSync(join(bin, 'docker'), DOCKER, { mode: 0o755 });
const curl =
  '#!/usr/bin/env bash\n[[ "${FAKE_CURL:-ok}" == ok ]] || exit 7\necho \'{"Browser": "Stub/1"}\'\n';
writeFileSync(join(bin, 'curl'), curl, { mode: 0o755 });
writeFileSync(join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
beforeEach(() => writeFileSync(log, ''));

function sh(script, args, env = {}) {
  const base = { PATH: `${bin}:${process.env.PATH}`, FAKE_LOG: log, FAKE_NET_ID: NET_ID };
  const run = spawnSync('bash', [join(HERE, script), ...args], {
    encoding: 'utf8',
    env: { ...base, FAKE_CONTAINER_ID: CID, ...env },
  });
  const removals = readFileSync(log, 'utf8')
    .split('\n')
    .filter((line) => /^(?:rm |network rm )/u.test(line));
  return { status: run.status, stdout: run.stdout, removals };
}

describe('browser.sh owned cleanup', () => {
  it('removes only the network it created when the container fails to start', () => {
    const { status, removals } = sh('browser.sh', ['start', 'pw-t'], { FAKE_RUN: 'fail' });
    expect(status).not.toBe(0);
    expect(removals).toEqual([`network rm ${NET_ID}`]);
  });

  it('removes its own container and network, by ID, when DevTools never comes up', () => {
    const { status, removals } = sh('browser.sh', ['start', 'pw-t'], { FAKE_CURL: 'fail' });
    expect(status).not.toBe(0);
    expect(removals).toEqual([`rm -f ${CID}`, `network rm ${NET_ID}`]);
  });

  it('removes nothing when the network name is already taken', () => {
    const { status, removals } = sh('browser.sh', ['start', 'pw-t'], { FAKE_NET_CREATE: 'no' });
    expect(status).not.toBe(0);
    expect(removals).toEqual([]);
  });

  it('keeps everything after a successful start', () => {
    const { status, stdout, removals } = sh('browser.sh', ['start', 'pw-t']);
    expect(status).toBe(0);
    expect(stdout).toContain('"Browser"');
    expect(removals).toEqual([]);
  });

  it('stops only resources with the research label', () => {
    const env = { FAKE_CONTAINER_LABEL: `${CID} <no value>`, FAKE_NET_LABEL: `${NET_ID} 1` };
    const { status, removals } = sh('browser.sh', ['stop', 'pw-t'], env);
    expect(status).toBe(0);
    expect(removals).toEqual([`network rm ${NET_ID}`]);
  });
});

describe('isolation-check.sh probe failures', () => {
  const labelled = { FAKE_CONTAINER_LABEL: `${CID} 1`, FAKE_NET_LABEL: `${NET_ID} 1` };

  it.each([
    ['the probe container cannot run', { FAKE_PROBE_EXIT: '125' }, 'PROBE-ERROR:exit-125'],
    ['the probe target is bad', { FAKE_PROBE_OUT: 'UNREACHABLE:ENOTFOUND' }, 'PROBE-ERROR:'],
  ])('reports FAIL, never isolation, when %s', (_label, env, marker) => {
    const { status, stdout } = sh('isolation-check.sh', ['9242'], { ...labelled, ...env });
    expect(status).not.toBe(0);
    const probeLines = stdout.split('\n').filter((line) => line.includes('probe->'));
    expect(probeLines).toHaveLength(4);
    for (const line of probeLines) expect(line).toMatch(new RegExp(`^FAIL .*${marker}`, 'u'));
  });

  it.each([
    ['the docker listing fails', { FAKE_LIST: 'fail' }, 'UNKNOWN'],
    ['the resources are still listed', { FAKE_NAMES: 'pw-isocheck pw-isocheck-net' }, 'PRESENT'],
  ])('fails the removal checks when %s', (_label, env, state) => {
    const { status, stdout } = sh('isolation-check.sh', ['9242'], { ...labelled, ...env });
    expect(status).not.toBe(0);
    expect(stdout).toContain(`FAIL container pw-isocheck after stop: ${state}`);
    expect(stdout).toContain(`FAIL network pw-isocheck-net after stop: ${state}`);
    expect(stdout).not.toMatch(/PASS .* removed/u);
  });

  it('passes the removal checks only when a successful listing omits both names', () => {
    const { stdout } = sh('isolation-check.sh', ['9242'], {
      ...labelled,
      FAKE_NAMES: 'pw-isocheck-other unrelated-net',
    });
    expect(stdout).toContain('PASS container pw-isocheck removed');
    expect(stdout).toContain('PASS network pw-isocheck-net removed');
  });

  it('stops before probing when the browser address cannot be read', () => {
    const { status, stdout } = sh('isolation-check.sh', ['9242'], {
      ...labelled,
      FAKE_BROWSER_IP: '',
    });
    expect(status).not.toBe(0);
    expect(stdout).toMatch(/FAIL could not read/u);
    expect(stdout).not.toMatch(/probe->/u);
  });
});

describe('probe_outcome', () => {
  const classify = (code, output) =>
    spawnSync(
      'bash',
      [
        '-c',
        `. "${join(HERE, 'lib/probe-outcome.sh')}"; probe_outcome "$1" "$2"`,
        '_',
        code,
        output,
      ],
      { encoding: 'utf8' },
    ).stdout.trim();

  it.each([
    ['0', 'REACHABLE', 'REACHABLE'],
    ['0', 'UNREACHABLE:ECONNREFUSED', 'UNREACHABLE:ECONNREFUSED'],
    ['0', 'UNREACHABLE:timeout', 'UNREACHABLE:timeout'],
    ['0', 'UNREACHABLE:EAI_AGAIN', 'PROBE-ERROR:unexpected-output'],
    ['0', 'UNREACHABLE:undefined', 'PROBE-ERROR:unexpected-output'],
    ['0', '', 'PROBE-ERROR:unexpected-output'],
    ['0', 'REACHABLE\nUNREACHABLE:timeout', 'PROBE-ERROR:unexpected-output'],
    ['1', 'UNREACHABLE:timeout', 'PROBE-ERROR:exit-1'],
  ])('classifies exit %s with output %j as %s', (code, output, expected) => {
    expect(classify(code, output)).toBe(expected);
  });
});

describe('resource_state', () => {
  const state = (kind, name, env = {}) =>
    spawnSync(
      'bash',
      [
        '-c',
        `. "${join(HERE, 'lib/resource-state.sh')}"; resource_state "$1" "$2"`,
        '_',
        kind,
        name,
      ],
      { encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, FAKE_LOG: log, ...env } },
    ).stdout.trim();

  it.each([
    ['container', 'pw-x', { FAKE_NAMES: 'pw-x' }, 'PRESENT'],
    ['network', 'pw-x-net', { FAKE_NAMES: 'pw-x pw-x-net' }, 'PRESENT'],
    ['container', 'pw-x', { FAKE_NAMES: 'pw-x-net pw-xy' }, 'ABSENT'],
    ['network', 'pw-x-net', {}, 'ABSENT'],
    ['container', 'pw-x', { FAKE_LIST: 'fail' }, 'UNKNOWN'],
    ['network', 'pw-x-net', { FAKE_LIST: 'fail' }, 'UNKNOWN'],
    ['volume', 'pw-x', {}, 'UNKNOWN'],
  ])('reports a %s named %s as %s', (kind, name, env, expected) => {
    expect(state(kind, name, env)).toBe(expected);
  });

  it('reports UNKNOWN when there is no docker command at all', () => {
    const empty = mkdtempSync(join(dir, 'no-docker-'));
    const run = spawnSync(
      '/bin/bash',
      ['-c', `. "${join(HERE, 'lib/resource-state.sh')}"; resource_state container pw-x`],
      { encoding: 'utf8', env: { PATH: empty } },
    );
    expect(run.stdout.trim()).toBe('UNKNOWN');
  });

  it('is what selftest.sh uses for its removal checks', () => {
    const selftest = readFileSync(join(HERE, 'selftest.sh'), 'utf8');
    expect(selftest).toContain('test "$(resource_state container "$NAME")" = ABSENT');
    expect(selftest).toContain('test "$(resource_state network "$NAME-net")" = ABSENT');
    expect(selftest).not.toMatch(/! docker/u);
  });
});

describe('check-masks.mjs', () => {
  it('fails a masked capture that recorded no mask box', () => {
    const session = join(dir, 'masks');
    mkdirSync(join(session, 'screenshots'), { recursive: true });
    const rows = Array.from({ length: 20 }, () => Buffer.alloc(60, 9));
    const png = { width: 20, height: 20, bpp: 3, rows };
    const box = { x: 2, y: 2, width: 10, height: 10 };
    writeFileSync(join(session, 'screenshots', 'none.png'), encodePng(png));
    writeFileSync(join(session, 'screenshots', 'good.png'), encodePng(paintBoxes(png, [box])));
    const row = (file, maskBoxes) =>
      JSON.stringify({
        step: { do: 'screenshot' },
        result: { file, masks: 1, maskBoxes, scale: 1 },
      });
    writeFileSync(
      join(session, 'timeline.jsonl'),
      `${row('none.png', [])}\n${row('good.png', [box])}\n`,
    );
    const run = spawnSync(process.execPath, [join(HERE, 'check-masks.mjs'), session], {
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/^FAIL none\.png/mu);
    expect(run.stdout).toMatch(/^PASS good\.png/mu);
  });
});
