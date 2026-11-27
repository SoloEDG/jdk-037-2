import type { Grid, Piece, Shape } from '../../../shared/board';
import type { ColumnSpec } from '../model/types';

/** 每列固定 8 行；合盘 8 列，片盘 4 列。 */
export const COLUMN_ROWS = 8;

/** 接缝位于合盘第 4 列与第 5 列之间（索引 x=3 与 x=4）。 */
export const SEAM_AT = 4;

interface FeedState {
  cursors: Map<number, number>;
  exhausted: Set<number>;
  trace: number[];
}

export interface ColumnFeed {
  shape: Shape;
  /** 第 x 列补入一颗来珠；null 表示该列来珠耗尽，空位保留。 */
  spawn(x: number): Piece | null;
  clone(): ColumnFeed;
  consumed(globalKey: number): number;
  exhausted(globalKey: number): boolean;
  /** 本次演算里补入过珠的全局列键序列。 */
  trace(): number[];
  /** 该列消耗本盘补入的来珠总颗数。 */
  usedTotal(): number;
  /** 所有到过不了的列（补珠时触顶）。 */
  exhaustedKeys(): number[];
}

export const initialPieceId = (key: number, y: number) => key * 100 + y;
export const queuePieceId = (key: number, cursor: number) => 1000 + key * 100 + cursor;

/**
 * 按列构建发珠器。start 为棋盘第 0 列对应的全局列键（片盘右半为 4）。
 * 合盘与片盘使用同一全局列键，因此同列同一来珠顺序获得同一 id 与来源。
 */
export function makeColumnFeed(columns: ColumnSpec[], start: number, width: number, shape: Shape, state?: FeedState): ColumnFeed {
  const current: FeedState = state ?? { cursors: new Map(), exhausted: new Set(), trace: [] };

  function spawn(x: number): Piece | null {
    if (x < 0 || x >= width) return null;
    const key = start + x;
    const queue = columns[key]?.queue ?? [];
    const cursor = current.cursors.get(key) ?? 0;
    if (cursor >= queue.length) {
      current.exhausted.add(key);
      return null;
    }
    current.cursors.set(key, cursor + 1);
    current.trace.push(key * 100 + cursor);
    return { id: queuePieceId(key, cursor), color: queue[cursor], origin: columns[key].origin, born: 'queue' };
  }

  return {
    shape,
    spawn,
    clone: () => makeColumnFeed(columns, start, width, shape, {
      cursors: new Map(current.cursors),
      exhausted: new Set(current.exhausted),
      trace: current.trace.slice(),
    }),
    consumed: key => current.cursors.get(key) ?? 0,
    exhausted: key => current.exhausted.has(key),
    trace: () => current.trace.slice(),
    usedTotal: () => [...current.cursors.values()].reduce((sum, value) => sum + value, 0),
    exhaustedKeys: () => [...current.exhausted],
  };
}

export function buildBoard(columns: ColumnSpec[], start: number, width: number, shape: Shape): { grid: Grid; feed: ColumnFeed } {
  const cells = width * COLUMN_ROWS;
  const pieces: (Piece | null)[] = Array.from({ length: cells }, () => null);
  const armor = Array<number>(cells).fill(0);
  for (let x = 0; x < width; x++) {
    const key = start + x;
    const spec = columns[key];
    if (!spec) continue;
    for (let y = 0; y < COLUMN_ROWS; y++) {
      const index = y * width + x;
      armor[index] = spec.armor[y] ?? 0;
      const cell = spec.cells[y];
      if (!cell) continue;
      pieces[index] = {
        id: initialPieceId(key, y), color: cell.color, special: cell.special,
        origin: spec.origin, born: 'board',
      };
    }
  }
  return { grid: { pieces, armor }, feed: makeColumnFeed(columns, start, width, shape) };
}
