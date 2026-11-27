import type { Grid, Shape } from '../../../shared/board';
import type { Move, Witness } from '../model/types';
import { buildBoard, type ColumnFeed } from './columns';
import { applyTurn, type BoardRun } from './simulate';
import { candidateMoves, orderMoves } from './moves';

export interface WitnessHit {
  status: 'found';
  run: BoardRun;
  nodes: number;
}

export interface WitnessMiss {
  status: 'none' | 'unknown';
  nodes: number;
  best: number;
}

export type WitnessSearch = WitnessHit | WitnessMiss;

export interface SliceVerdict {
  status: 'proven' | 'reachable' | 'unknown';
  max: number;
  nodes: number;
}

export interface Limits {
  maxNodes?: number;
  deadline?: number;
}

interface Frame {
  grid: Grid;
  feed: ColumnFeed;
  moves: Move[];
  armor: number;
  waves: Witness['waves'];
  cross: Witness['cross'] | null;
  consumed: number[];
}

/** 搜索过程中用于剪枝的累计值。 */
const full = (run: BoardRun, target: number, requireCross: boolean) =>
  run.armor >= target && (!requireCross || !!run.cross);

function walk(
  columns: Parameters<typeof buildBoard>[0], start: number, shape: Shape, seam: number | undefined,
  target: number, budget: number, limits: Limits, requireCross: boolean,
): WitnessSearch {
  const built = buildBoard(columns, start, shape.width, shape);
  const maxNodes = limits.maxNodes ?? 30000;
  const deadline = limits.deadline ?? Number.POSITIVE_INFINITY;
  let nodes = 0;
  let truncated = false;
  let best = 0;
  let found: BoardRun | null = null;

  const stack: Frame[] = [{ grid: built.grid, feed: built.feed, moves: [], armor: 0, waves: [], cross: null, consumed: [] }];
  while (stack.length) {
    const frame = stack.pop()!;
    if (frame.moves.length >= budget) continue;
    const candidates = orderMoves(candidateMoves(frame.grid, shape), frame.grid, shape, seam);
    for (let index = candidates.length - 1; index >= 0; index--) {
      if (nodes >= maxNodes || Date.now() > deadline) { truncated = true; break; }
      nodes++;
      const feed = frame.feed.clone();
      const step = applyTurn(frame.grid, feed, candidates[index], seam ?? shape.width / 2, shape, frame.moves.length);
      if (!step.legal) continue;
      const next: Frame = {
        grid: step.grid,
        feed,
        moves: [...frame.moves, candidates[index]],
        armor: frame.armor + step.armor,
        waves: [...frame.waves, ...step.waves],
        cross: frame.cross ?? step.cross,
        consumed: Array.from({ length: shape.width }, (_, x) => feed.consumed(start + x)),
      };
      best = Math.max(best, next.armor);
      const run = toRun(next, shape);
      if (full(run, target, requireCross)) {
        if (!found || run.armor > found.armor) found = run;
        if (run.armor >= target) return { status: 'found', run, nodes };
      }
      stack.push(next);
    }
    if (truncated) break;
  }

  if (found) return { status: 'found', run: found, nodes };
  return { status: truncated ? 'unknown' : 'none', nodes, best };
}

function toRun(frame: Frame, shape: Shape): BoardRun {
  let holes = 0;
  for (let index = 0; index < shape.width * shape.height; index++) if (!frame.grid.pieces[index]) holes++;
  return {
    legal: true, moves: frame.moves, armor: frame.armor, waves: frame.waves, cross: frame.cross,
    final: frame.grid, consumed: frame.consumed, holes, exhausted: [...frame.feed.exhaustedKeys()],
  };
}

/**
 * 合盘搜索：在至多 budget 步内寻找同时满足
 * 「累计清霜 ≥ target」与「一次跨缝消除里两片段各有一枚原珠」的见证。
 * 达到节点/时间上限仍未穷尽且毫无跨缝时返回 unknown —— 只可存草稿。
 */
export function searchWitness(
  columns: Parameters<typeof buildBoard>[0], shape: Shape, seam: number,
  target: number, budget: number, limits: Limits = {},
): WitnessSearch {
  // 目标高于全盘霜层：无论多少步都不可能达成，直接判定为无见证。
  const ceiling = columns.reduce((sum, column) => sum + (column?.armor ?? []).reduce((a, b) => a + b, 0), 0);
  if (target > ceiling) return { status: 'none', nodes: 0, best: ceiling };
  return walk(columns, 0, shape, seam, target, budget, limits, true);
}

/**
 * 单侧片盘：返回该侧在 budget 步内可达到的最大清霜。
 * proven 表示已穷尽且达不到 target；unknown 表示搜索被截断。
 */
export function searchSlice(
  columns: Parameters<typeof buildBoard>[0], start: number, shape: Shape,
  target: number, budget: number, limits: Limits = {},
): SliceVerdict {
  const ceiling = Array.from({ length: shape.width }, (_, x) => columns[start + x])
    .reduce((sum, column) => sum + (column?.armor ?? []).reduce((a, b) => a + b, 0), 0);
  if (target > ceiling) return { status: 'proven', max: ceiling, nodes: 0 };
  const result = walk(columns, start, shape, undefined, target, budget, limits, false);
  if (result.status === 'found') return { status: 'reachable', max: result.run.armor, nodes: result.nodes };
  if (result.status === 'unknown') return { status: 'unknown', max: result.best, nodes: result.nodes };
  return { status: result.best >= target ? 'reachable' : 'proven', max: result.best, nodes: result.nodes };
}
