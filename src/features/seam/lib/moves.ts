import { Board, Matcher } from 'miaoda-game-match3-core';
import { at, type Grid, type Shape } from '../../../shared/board';
import { canCombine } from '../../specials/lib/combine';
import type { Move } from '../model/types';

/** 交换后全盘是否出现三连；盘面在交换前稳定时，这等价于“该交换合法”。 */
function createsMatch(grid: Grid, from: number, to: number, shape: Shape) {
  const colors = grid.pieces.map(piece => piece?.color ?? null);
  [colors[from], colors[to]] = [colors[to], colors[from]];
  const board = new Board({ width: shape.width, height: shape.height });
  colors.forEach((color, index) => {
    const { x, y } = at(index, shape);
    board.set(x, y, color);
  });
  return new Matcher(board).anyMatch(3);
}

/**
 * 枚举当前稳定盘上所有会产生后续演算的相邻交换。
 * 同色交换无效果；特消与特消/棱镜相邻可直接合成。
 */
export function candidateMoves(grid: Grid, shape: Shape): Move[] {
  const moves: Move[] = [];
  const cells = shape.width * shape.height;
  for (let index = 0; index < cells; index++) {
    const { x, y } = at(index, shape);
    const right = x + 1 < shape.width ? index + 1 : -1;
    const down = y + 1 < shape.height ? index + shape.width : -1;
    for (const other of [right, down]) {
      if (other < 0) continue;
      const a = grid.pieces[index];
      const b = grid.pieces[other];
      if (!a || !b) continue;
      if (canCombine(a, b) || (a.color !== b.color && createsMatch(grid, index, other, shape))) {
        moves.push({ from: index, to: other });
      }
    }
  }
  return moves;
}

/** 越靠近接缝越优先、特消优先，用于搜索时的走法排序。 */
export function orderMoves(moves: Move[], grid: Grid, shape: Shape, seam?: number) {
  const score = (move: Move) => {
    const a = grid.pieces[move.from];
    const b = grid.pieces[move.to];
    let value = 0;
    if (a && b && canCombine(a, b)) value += 100;
    if (a?.special) value += 12;
    if (b?.special) value += 12;
    if (seam !== undefined) {
      const x = Math.min(at(move.from, shape).x, at(move.to, shape).x);
      value += Math.max(0, 12 - Math.abs(x - seam + 0.5) * 3);
    }
    return value;
  };
  return moves.slice().sort((left, right) => score(right) - score(left));
}
