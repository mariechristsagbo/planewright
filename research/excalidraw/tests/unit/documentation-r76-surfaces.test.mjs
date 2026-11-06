// Checks the R-76 comparisons of scenarios 14 and 15, the mobile chain, the storage
// inventories and the initial-page inspections (sessions s8–s11) against the committed evidence.
import { describe, expect, it } from 'vitest';

import {
  R76,
  RE,
  cells,
  differing,
  digests,
  doc,
  entry,
  evidence,
  field,
  flat,
  lines,
  probe,
  read,
  session,
  strip,
} from './r76-evidence.mjs';
import { NUMBERS } from './review-list.mjs';

describe('scenario 15 against s6', () => {
  it('cites the replay count and the drawn geometry once the scroll is subtracted', () => {
    const { shared, labels } = differing('s10-desktop-r76-15', 's6-desktop-fresh');
    expect(labels).toHaveLength(shared);
    const text = flat(read(`${RE}/behavior-analysis.md`));
    expect(text).toContain(`s10 shares ${String(shared)} labels with s6, and 0 of`);
    const [dx, dy] = probe('s6-desktop-fresh', '15-rect-selected').scroll;
    expect(probe('s10-desktop-r76-15', '15-rect-selected').scroll).toEqual([0, 0]);
    const scroll = `(${String(dx)},${String(dy)})`;
    expect(text).toContain(
      `s6 had scroll ${scroll} and s10 none, and s10's boxes minus ${scroll} equal s6's boxes`,
    );
    const drawn = probe('s10-desktop-r76-15', '15-text').elements;
    const earlier = probe('s6-desktop-fresh', '15-text').elements.slice(-drawn.length);
    drawn.forEach((element, i) => {
      const [x, y, width, height] = element.box;
      expect([x - dx, y - dy, width, height]).toEqual(earlier[i].box);
      const { box, style, ...rest } = element;
      expect({ ...earlier[i], box, style }).toEqual({ ...rest, box, style });
      expect(style).not.toEqual(earlier[i].style);
    });
    for (const label of ['15-rect-selected', '15-end']) {
      const pick = (p) => [p.selected, p.tool, p.zoom, p.theme];
      expect(pick(probe('s10-desktop-r76-15', label))).toEqual(
        pick(probe('s6-desktop-fresh', label)),
      );
    }
  });

  it('rates only the surfaces whose snapshots can be identical as high', () => {
    for (const file of ['dark-11-panel-text.yml', 'dark-12-preferences.yml']) {
      expect(lines('s10-desktop-r76-15', file), file).toBe(lines('s6-desktop-fresh', file));
    }
    // The Fill group (5 lines) is in s6's rectangle snapshots only.
    for (const file of ['07-element-context-menu', '08-panel-rect', '09-panel-rect-scrolled']) {
      const name = `dark-${file}.yml`;
      expect(lines('s6-desktop-fresh', name) - lines('s10-desktop-r76-15', name), name).toBe(5);
    }
    expect(field(entry('B-34'), 'Confidence')).toMatch(
      /^\[O\] medium\. The menu entries are identical in s6 and s10, but the snapshots are not/u,
    );
    expect(field(entry('B-03'), 'Confidence')).toContain('high for the text hint');
    const inventory = flat(read(`${RE}/feature-inventory.md`));
    expect(inventory).toContain('the text section [O, high], identical in s6 and s10');
    expect(inventory).toContain('[O, medium], dark in s6 and s10: the entries are identical');
  });
});

describe('the mobile chain against s7 and s3', () => {
  const scrollX = (name, label) => probe(name, label).scroll[0];
  const withoutX = (p) => strip({ ...p, scroll: [null, p.scroll?.[1]] });

  it('cites the replay counts and a difference in scrollX only', () => {
    const vs7 = differing('s11-mobile-r76-14', 's7-mobile-fresh');
    for (const label of vs7.labels) {
      expect(withoutX(probe('s11-mobile-r76-14', label)), label).toBe(
        withoutX(probe('s7-mobile-fresh', label)),
      );
    }
    const [x11, x7] = [
      scrollX('s11-mobile-r76-14', '14-end'),
      scrollX('s7-mobile-fresh', '14-end'),
    ];
    const same = vs7.shared - vs7.labels.length;
    const text = flat(read(`${RE}/behavior-analysis.md`));
    expect(text).toContain(
      `s11 shares ${String(vs7.shared)} labels with s7, and ${String(same)} of ` +
        `${String(vs7.shared)} are identical; the other ${String(vs7.labels.length)} differ only ` +
        `in scrollX (${String(x11).replace('-', '−')} in s11, ${String(x7).replace('-', '−')} in s7)`,
    );
    const vs3 = differing('s11-mobile-r76-14', 's3-mobile');
    expect(vs3.labels).toEqual([]);
    expect(text).toContain(`shares ${String(vs3.shared)} labels with s3, and 6 of 6 are identical`);
  });

  it('rates the mobile dialogs high from equal snapshots and byte-identical captures', () => {
    const later = session('s11-mobile-r76-14').aria_snapshots;
    for (const { name, lines: count } of later) {
      expect(count, name).toBe(lines('s7-mobile-fresh', name));
    }
    const earlier = digests('s7-mobile-fresh');
    const same = [...digests('s11-mobile-r76-14')].filter(([n, d]) => earlier.get(n) === d);
    const names = same.map(([name]) => name);
    for (const shot of ['m11-dark-help', 'm13-dark-command-palette', 'm15-dark-reset-confirm']) {
      expect(names).toContain(`${shot}.png`);
    }
    expect(field(entry('B-35'), 'Confidence')).toMatch(/^\[O\] high: s7 and s11 give identical/u);
    const inventory = flat(read(`${RE}/feature-inventory.md`));
    expect(inventory).toContain(`all ${String(later.length)} s11 snapshots match s7's`);
    expect(inventory).toContain(
      'Help, Command palette and Clear canvas captures are byte-identical',
    );
  });

  it('names the sessions whose initial desktop capture is byte-identical', () => {
    const shared = digests('s6-desktop-fresh').get('d01-initial-light.png');
    const same = evidence('sessions.json')
      .sessions.filter((s) => digests(s.session).get('d01-initial-light.png') === shared)
      .map((s) => s.session.split('-')[0]);
    expect(same).toEqual(['s1', 's5', 's6', 's8', 's9', 's10']);
    expect(flat(read(`${RE}/feature-inventory.md`))).toContain(
      'd01-initial-light is byte-identical in s1, s5, s6 and s8–s10',
    );
  });
});

// The REA window armed before a session's observed scenario.
const during = (run) =>
  evidence('rea-windows.json').windows.find(
    (w) => w.session === run.name && w.file === `r03-inspect-during-${run.observed}.json`,
  );

describe('the R-76 storage inventories and initial-page inspections', () => {
  const initial = (name) =>
    evidence(
      name === 's1-desktop'
        ? 'rea-inspect-initial.summary.json'
        : `rea-inspect-initial-${name}.summary.json`,
    );
  const sessions = ['s1-desktop', ...R76.map((run) => run.name)];

  it('commit five identical first-load inventories, the mobile one included', () => {
    const [first, ...later] = sessions.map((name) => initial(name).storage);
    expect(first.values_redacted).toBe(true);
    for (const storage of later) expect(storage).toEqual(first);
    expect(field(entry('B-31'), 'Immediate result')).toContain(
      `the first load in s1 and in each of s8–s11, identical in all ${NUMBERS[sessions.length - 1]}`,
    );
    expect(field(entry('B-31'), 'Confidence')).toMatch(/^\[O\] high for the first-load inventory/u);
    const [, , , , columns, status] = cells('R-61');
    expect(columns).toBe('✅/🟡/✅');
    expect(status).toBe('🟡');
  });

  it('cite the cache counts kept by the R-76 windows', () => {
    const caches = R76.map((run) => during(run).cache_names);
    expect(caches).toEqual([1, 1, 1, 3]);
    expect(field(entry('B-31'), 'Immediate result')).toContain(
      "3 at the end of s11's window during scenario 14, while the desktop R-76 windows kept 1",
    );
  });

  it('cite what the desktop and mobile inspections repeat of s1', () => {
    const s1 = initial('s1-desktop');
    const main = (summary) => summary.scripts.filter((s) => !/\/index-[^/]+\.js$/u.test(s.url));
    for (const run of R76.slice(0, 3)) {
      const summary = initial(run.name);
      expect(summary.controls, run.name).toEqual(s1.controls);
      expect(summary.accessibility_total).toBe(s1.accessibility_total);
      expect(main(summary)).toEqual(main(s1));
      expect(summary.scripts).toHaveLength(s1.scripts.length);
      expect(summary.dom_total).toBe(s1.dom_total + 1);
    }
    const mobile = initial('s11-mobile-r76-14');
    const text = doc('rea-findings.md');
    expect(text).toContain(
      `the ${String(s1.controls.length)} controls with their names, descriptions and states, the ` +
        `${String(s1.accessibility_total)} accessibility nodes, the ${String(s1.scripts.length)} scripts`,
    );
    expect(text).toContain(
      `On mobile (s11) it lists ${String(mobile.controls.length)} controls, ` +
        `${String(mobile.accessibility_total)} accessibility nodes and ${String(mobile.dom_total)} DOM nodes`,
    );
    expect(cells('R-58')[4]).toBe('🟡/❌/🟡');
  });
});
