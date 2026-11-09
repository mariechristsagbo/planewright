import type { Element, ElementId, OrderKey, TextElement } from '@planewright/engine';
import { expect, test } from 'vitest';

import { elementName } from '../../src/a11y/element-names.ts';

// I3, a measurement that is no budget (docs/architecture/engine/quality.md#what-eng-15-decided;
// the ENG-14 review's s4): naming the element list's 101 rendered options when each is a text of
// 100,000 characters, as every view change, a pan included, names them again. Each sample names
// all 101; the names are first checked to hold each text's first 40 characters.

const OPTIONS = 101;
const LENGTH = 100_000;

function longText(index: number): TextElement {
  const line = `${'lorem ipsum dolor sit amet '.repeat(4).slice(0, 99)}\n`;
  return {
    id: `T${String(index).padStart(21, '0')}` as ElementId,
    kind: 'text',
    order: 'V' as OrderKey,
    x: 60 * index,
    y: 0,
    rotation: 0,
    style: {
      stroke: { color: '#1e2430' as Element['style']['stroke']['color'], width: 2, dash: 'solid' },
      fill: null,
      opacity: 1,
      corners: 'sharp',
      sketch: 0,
    },
    locked: false,
    width: 49.5,
    height: 1_000,
    content: {
      text: line.repeat(LENGTH / line.length + 1).slice(0, LENGTH),
      font: { family: 'sans', size: 1, lineHeight: 1 },
      align: 'left',
    },
    rev: 1,
  };
}

test('I3 naming 101 listed options, each a text of 100,000 characters', async ({ bench, task }) => {
  const texts = Array.from({ length: OPTIONS }, (_, index) => longText(index));
  expect(texts.every(({ content }) => content.text.length === LENGTH)).toBe(true);
  expect(elementName(texts[0] ?? longText(0))).toBe(
    'Text “lorem ipsum dolor sit amet lorem ipsum d…”, 49.5 by 1000, at 0, 0',
  );

  const result = await bench('I3 name 101 texts of 100,000 characters', () => {
    for (const text of texts) elementName(text);
  }).run({
    iterations: 200,
    time: 0,
    warmupIterations: 40,
    warmupTime: 0,
    retainSamples: true,
    throws: true,
  });
  Object.assign(task.meta, {
    perf: {
      budget: 'I3',
      elements: OPTIONS,
      checked: 'a name holds the first 40 characters of its text',
      clock: result.timestampProviderName === 'custom' ? 'performance.now()' : 'tinybench',
      runtime: result.runtimeVersion,
    },
  });
});
