import type { Grid, Shape } from '../../../shared/board';
import type { ClearTrace } from '../../../shared/turn';
import { playFeededTurn } from '../../swap/lib/resolve';
import type { Move, OriginCount, Witness } from '../model/types';
import { buildBoard, type ColumnFeed } from './columns';

export interface BoardRun {
  legal: boolean;
  moves: Move[];
  armor: number;
  waves: Witness['waves'];
  cross: Witness['cross'] | null;
  final: Grid;
  /** 每列已消耗的来珠数（按棋盘列序）。 */
  consumed: number[];
  holes: number;
  exhausted: number[];
}

interface RunOptions {
  columns: Parameters<typeof buildBoard>[0];
  start: number;
  shape: Shape;
  moves: Move[];
  seam?: number;
}

/** 一次消除是否同时落在接缝两侧。 */
export function spansSeam(cleared: number[], seam: number, shape: Shape) {
  let left = false;
  let right = false;
  for (const index of cleared) {
    if (index % shape.width < seam) left = true;
    else right = true;
  }
  return left && right;
}

export function countHoles(grid: Grid, shape: Shape) {
  let holes = 0;
  for (let index = 0; index < shape.width * shape.height; index++) if (!grid.pieces[index]) holes++;
  return holes;
}

export function fnv1a(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, '0');
}

export function signatureOf(step: number, wave: number, traces: Pick<ClearTrace, 'origin' | 'id' | 'index'>[], armor: number) {
  const payload = `${step}|${wave}|${armor}|${traces.map(trace => `${trace.origin}:${trace.id}:${trace.index}`).join(',')}`;
  return `S${fnv1a(payload)}`;
}

/** 按来源片段/出生方式统计一次消除里的晶石。 */
export function tallyTraces(traces: ClearTrace[]): OriginCount[] {
  const map = new Map<string, OriginCount>();
  for (const trace of traces) {
    const key = `${trace.origin}:${trace.born}`;
    const entry = map.get(key) ?? { origin: trace.origin, born: trace.born, count: 0 };
    entry.count++;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => a.origin - b.origin || a.born.localeCompare(b.born));
}

/** 构造跨缝见证：两片段各取一枚初盘原珠。缺任一即不算跨缝贡献。 */
export function crossFrom(step: number, waveIndex: number, traces: ClearTrace[], armor: number, shape?: Shape) {
  const originals = traces.filter(trace => trace.born === 'board');
  const samples = [0, 1]
    .map(origin => originals.find(trace => trace.origin === origin))
    .filter((trace): trace is ClearTrace => !!trace)
    .map(trace => ({ origin: trace.origin, id: trace.id, index: trace.index, color: trace.color, side: shape ? (trace.index % shape.width) < shape.width / 2 ? 0 : 1 : trace.origin }));
  if (samples.length !== 2) return null;
  return { wave: waveIndex, armor, samples, signature: signatureOf(step, waveIndex, samples, armor) };
}

export interface AppliedTurn {
  legal: boolean;
  grid: Grid;
  feed: ColumnFeed;
  waves: Witness['waves'];
  armor: number;
  cross: Witness['cross'] | null;
}

/** 在给定盘面上执行一次交换；用于试玩与搜索。 */
export function applyTurn(grid: Grid, feed: ColumnFeed, move: Move, seam: number, shape: Shape, step: number): AppliedTurn {
  const turn = playFeededTurn(grid, move.from, move.to, feed, shape);
  if (!turn.legal) return { legal: false, grid, feed, waves: [], armor: 0, cross: null };
  const waves: Witness['waves'] = [];
  let cross: Witness['cross'] | null = null;
  let armor = 0;
  for (let index = 0; index < turn.waves.length; index++) {
    const wave = turn.waves[index];
    const traces = wave.provenance ?? [];
    const isCross = spansSeam(wave.cleared, seam, shape);
    waves.push({ depth: wave.depth, armor: wave.armorHits.length, cleared: wave.cleared.length, origins: tallyTraces(traces), cross: isCross });
    armor += wave.armorHits.length;
    if (isCross && !cross) cross = crossFrom(step, index, traces, wave.armorHits.length, shape);
  }
  return { legal: true, grid: turn.final, feed, waves, armor, cross };
}

/** 从首次盘开始，按给定走法回放；不会写回任何输入。 */
export function runPlan({ columns, start, shape, moves, seam }: RunOptions): BoardRun {
  const built = buildBoard(columns, start, shape.width, shape);
  let grid = built.grid;
  const feed: ColumnFeed = built.feed;
  const waves: Witness['waves'] = [];
  const applied: Move[] = [];
  let armor = 0;
  let cross: Witness['cross'] | null = null;

  for (let step = 0; step < moves.length; step++) {
    const result = applyTurn(grid, feed, moves[step], seam ?? shape.width / 2, shape, step);
    if (!result.legal) break;
    applied.push(moves[step]);
    waves.push(...result.waves);
    armor += result.armor;
    if (!cross && result.cross) cross = result.cross;
    grid = result.grid;
  }

  return {
    legal: applied.length === moves.length,
    moves: applied,
    armor,
    waves,
    cross,
    final: grid,
    consumed: Array.from({ length: shape.width }, (_, x) => feed.consumed(start + x)),
    holes: countHoles(grid, shape),
    exhausted: feed.exhaustedKeys(),
  };
}
