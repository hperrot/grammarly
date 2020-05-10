/// <reference types="jest" />

import { Change, diff } from './snapshot';

/**
 * Changes are sorted by [index].
 */
function apply(source: string, changes: Change[]) {
  let offset = 0;
  changes.forEach((change) => {
    if (change.type === 'del') {
      source =
        source.substring(0, change.index + offset) + source.substring(change.index + offset + change.text.length);
      offset -= change.text.length;
    } else {
      source = source.substring(0, change.index + offset) + change.text + source.substring(change.index + offset);
      offset += change.text.length;
    }
  });

  return source;
}

describe('diff', () => {
  test(`insert`, () => {
    const previous = 'On Monday morning';
    const current = 'On Monday morning, I woke up late.';

    const changes = diff(previous, current);

    expect(changes).toHaveLength(1);
    expect(changes[0].text).toBe(', I woke up late.');
    expect(apply(previous, changes)).toBe(current);
  });

  test(`delete`, () => {
    const previous = 'On Monday morning';
    const current = 'On Monday';

    const changes = diff(previous, current);

    expect(changes).toHaveLength(1);
    expect(changes[0].text).toBe(' morning');
    expect(apply(previous, changes)).toBe(current);
  });

  test(`replace`, () => {
    const previous = 'On Monday morning';
    const current = 'On Monday evening';

    const changes = diff(previous, current);

    expect(changes).toHaveLength(2);
    expect(changes[0].text).toBe('eve');
    expect(changes[1].text).toBe('mor');
    expect(apply(previous, changes)).toBe(current);
  });
});

describe('snapshot', () => {});
