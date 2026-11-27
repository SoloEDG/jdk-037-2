import type { Capture, CellSpec } from './types';
import { openBoard } from '../../board/model/generator';
import { makeSource } from '../../board/model/source';
import { levels } from '../../objectives/model/levels';

/** 把真实对局的稳定盘拍成一次捕获记录（确定性，可由关卡与种子复现）。 */
export function captureFromLevel(levelId: number): Capture | null {
  const level = levels[levelId - 1] as (typeof levels)[number] | undefined;
  if (!level) return null;
  const grid = openBoard(level, makeSource(level.seed));
  const cells: (CellSpec | null)[] = grid.pieces.map(piece => (piece ? { color: piece.color, special: piece.special } : null));
  return {
    id: `L${levelId}-${level.seed}`,
    label: `${level.name} · 稳定盘`,
    level: levelId,
    seed: level.seed,
    moves: level.moves,
    cells,
    armor: grid.armor.slice(),
  };
}

export function captures(): Capture[] {
  return levels
    .filter(level => level.id <= 3)
    .map(level => captureFromLevel(level.id))
    .filter((capture): capture is Capture => !!capture);
}
