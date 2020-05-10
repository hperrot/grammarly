// based on http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.4.6927

function getIndex(key: string | number | symbol) {
  if (typeof key === 'string') return parseInt(key, 10);
  if (typeof key === 'symbol') return Number.NaN;
  return key;
}

function wrapArray<T>(array: T[]) {
  return new Proxy(array, {
    get(target, key: keyof T[]) {
      const index = getIndex(key);

      if (Number.isNaN(index)) return target[key];
      else return target[(target.length + index) % target.length];
    },
    set(target, key, value) {
      const index = getIndex(key);

      if (Number.isNaN(index)) {
        return false;
      } else {
        target[(target.length + index) % target.length] = value;
      }

      return true;
    },
  });
}

function createCircularArray<T>(size: number) {
  return wrapArray(new Array<T>(size));
}

function getShortestEditTrace(a: string, b: string) {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const v = createCircularArray<number>(2 * max + 1);
  const trace: number[][] = [];

  v[1] = 0;
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[k - 1] < v[k + 1]) ? v[k + 1] : v[k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a.charAt(x) === b.charAt(y)) x++, y++;
      v[k] = x;

      if (x >= n && y >= m) return trace;
    }
  }

  return trace;
}

function backtrack(oldString: string, newString: string) {
  let x = oldString.length;
  let y = newString.length;
  const n = 2 * (x + y) + 1;
  const trace = getShortestEditTrace(oldString, newString);
  const steps: Array<[number, number, number, number]> = [];
  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    const prev_k = k === -d || (k !== d && v[k - 1] < v[k + 1]) ? k + 1 : k - 1;
    const prev_x = v[(n + prev_k) % n];
    const prev_y = prev_x - prev_k;

    while (x > prev_x && y > prev_y) {
      steps.push([x - 1, y - 1, x, y]);
      --x;
      --y;
    }

    if (d > 0) steps.push([prev_x, prev_y, x, y]);

    x = prev_x;
    y = prev_y;
  }

  return steps;
}

export interface Change {
  type: 'del' | 'ins';
  text: string;
  index: number;
}

function collapse(changes: Change[]): Change[] {
  const size = changes.length;
  const collapsed: Change[] = [];
  for (let i = 0; i < size; ++i) {
    const change = changes[i];

    while (i + 1 < size && changes[i].index + 1 === changes[i + 1].index && change.type === changes[i + 1].type) {
      ++i;
      change.text += changes[i].text;
    }

    collapsed.push(change);
  }

  return collapsed;
}

export function diff(oldString: string, newString: string) {
  const changes: Change[] = [];

  backtrack(oldString, newString).forEach(([prev_x, prev_y, x, y]) => {
    if (prev_x === x) {
      changes.unshift({ type: 'ins', text: newString.charAt(prev_y), index: prev_y });
    } else if (prev_y === y) {
      changes.unshift({ type: 'del', text: oldString.charAt(prev_x), index: prev_x });
    } else if (newString.charAt(prev_y) !== oldString.charAt(prev_x)) {
      changes.unshift({ type: 'del', text: oldString.charAt(prev_x), index: prev_x });
      changes.unshift({ type: 'ins', text: newString.charAt(prev_y), index: prev_y });
    }
  });

  return collapse(changes);
}

import { RawSourceMap, SourceMapConsumer } from 'source-map';

export class Snapshot {
  private map?: SourceMapConsumer;
  private orignal?: Snapshot;

  constructor(public readonly version: number, public readonly content: string, map?: RawSourceMap) {
    if (map) {
      if (map.sourcesContent?.length !== 1) throw new Error('SourceMap is missing sources content.');

      this.map = new SourceMapConsumer(map);
      this.orignal = new Snapshot(version, map.sourcesContent[0]);
    }
  }

  positionAt(offset: number) {
    offset = Math.max(Math.min(offset, this.content.length), 0);

    const lineOffsets = this.getLineOffsets();
    let low = 0;
    let high = lineOffsets.length;

    if (high === 0) {
      return { line: 0, column: offset };
    }

    while (low < high) {
      let mid = Math.floor((low + high) / 2);
      if (lineOffsets[mid] > offset) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    // low is the least x for which the line offset is larger than the current offset
    // or array.length if no line offset is larger than the current offset
    const line = low - 1;

    return { line, column: offset - lineOffsets[line] };
  }

  offsetAt(position: { line: number; column: number }) {
    const lineOffsets = this.getLineOffsets();
    if (position.line >= lineOffsets.length) {
      return this.content.length;
    } else if (position.line < 0) {
      return 0;
    }
    const lineOffset = lineOffsets[position.line];
    const nextLineOffset =
      position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : this.content.length;

    return Math.max(Math.min(lineOffset + position.column, nextLineOffset), lineOffset);
  }

  getSourceOffset(offset: number) {
    return this.map ? this.orignal!.offsetAt(this.map.originalPositionFor(this.positionAt(offset))) : offset;
  }

  private offsets?: number[];
  private getLineOffsets() {
    if (!this.offsets) this.offsets = computeLineOffset(this.content, true);

    return this.offsets;
  }
}

const enum CharCode {
  /**
   * The `\n` character.
   */
  LineFeed = 10,
  /**
   * The `\r` character.
   */
  CarriageReturn = 13,
}

function computeLineOffset(text: string, isAtLineStart: boolean, textOffset = 0) {
  const offsets: number[] = isAtLineStart ? [textOffset] : [];

  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (ch === CharCode.CarriageReturn || ch === CharCode.LineFeed) {
      if (ch === CharCode.CarriageReturn && i + 1 < text.length && text.charCodeAt(i + 1) === CharCode.LineFeed) {
        i++;
      }

      offsets.push(textOffset + i + 1);
    }
  }

  return offsets;
}
