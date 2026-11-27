import type { Grid } from '../../../shared/board';
import type { ColumnFeed } from '../lib/columns';
import { buildBoard } from '../lib/columns';
import { applyTurn, runPlan, type BoardRun } from '../lib/simulate';
import type { ColumnSpec, Move, SeamCard, Witness } from '../model/types';
import { SEAM_COLUMN } from '../model/validate';
import { COMBINED_SHAPE } from '../model/validate';

export interface PlayState {
  grid: Grid;
  feed: ColumnFeed;
  moves: Move[];
  armor: number;
  waves: Witness['waves'];
  /** 首次达成的跨缝贡献。 */
  cross: Witness['cross'] | null;
  /** 本次试玩是否复现了卡上见证的签名。 */
  reproduced: boolean;
}

export function startPlay(columns: ColumnSpec[]): PlayState {
  const built = buildBoard(columns, 0, COMBINED_SHAPE.width, COMBINED_SHAPE);
  return { grid: built.grid, feed: built.feed, moves: [], armor: 0, waves: [], cross: null, reproduced: false };
}

export interface PlayResult {
  state: PlayState;
  legal: boolean;
  note: string;
}

/** 在试玩状态上执行一次交换；步数上限与卡预算一致。 */
export function playMove(state: PlayState, card: SeamCard, move: Move): PlayResult {
  if (state.moves.length >= card.budget) return { state, legal: false, note: '步数预算已用完' };
  const step = applyTurn(state.grid, state.feed, move, SEAM_COLUMN, COMBINED_SHAPE, state.moves.length);
  if (!step.legal) return { state, legal: false, note: '这一步不产生消除' };
  const cross = state.cross ?? step.cross;
  const reproduced = state.reproduced || (!!cross && !!card.witness && cross.signature === card.witness.signature);
  return {
    state: {
      grid: step.grid,
      feed: state.feed,
      moves: [...state.moves, move],
      armor: state.armor + step.armor,
      waves: [...state.waves, ...step.waves],
      cross,
      reproduced,
    },
    legal: true,
    note: summary(step.armor, step.cross, step.waves.length),
  };
}

function summary(armor: number, cross: Witness['cross'] | null, waves: number) {
  const parts = [`${waves} 次消除`, `清霜 ${armor}`];
  if (cross) parts.push(`跨缝贡献 ${cross.signature}`);
  return parts.join(' · ');
}

/** 按卡上见证从初盘重放，用于“带见证的试玩”提示。 */
export function replayWitness(card: SeamCard): BoardRun | null {
  if (!card.witness) return null;
  return runPlan({ columns: card.columns, start: 0, shape: COMBINED_SHAPE, moves: card.witness.moves, seam: SEAM_COLUMN });
}

/** 试玩结束后按卡目标判定。 */
export function judged(state: PlayState, card: SeamCard) {
  return { reached: state.armor >= card.target, armor: state.armor, target: card.target, cross: !!state.cross, reproduced: state.reproduced };
}
