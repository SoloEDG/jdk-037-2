import { Board, Matcher, fillMatchFree } from 'miaoda-game-match3-core';
import { FULL_SHAPE, at, cellCountOf, type Grid, type Shape } from '../../../shared/board';
import type { Level } from '../../../shared/levels';
import type { PieceSource } from './source';

/**
 * 生成无三连且有合法交换的初盘。
 *
 * @param shape 4×8 片盘传入 { width: 4, height: 8 }；整盘默认 8×8。
 * @param origin 若给出，则所有初盘晶石标记为该来源片段，并记录为 born='board'。
 */
export function replacePieces(source: PieceSource, armor: number[], shape: Shape = FULL_SHAPE, origin?: number): Grid {
  const board = new Board({ width: shape.width, height: shape.height });
  fillMatchFree(board, new Matcher(board), () => source.color(), { requireLegalSwap: true, maxAttempts: 5000 });
  const pieces = Array.from({ length: cellCountOf(shape) }, (_, index) => {
    const { x, y } = at(index, shape);
    const piece = source.piece(board.get(x, y) as ReturnType<PieceSource['color']>);
    return origin === undefined ? piece : { ...piece, origin, born: 'board' as const };
  });
  return { pieces, armor: armor.slice() };
}

export function openBoard(level: Level, source: PieceSource): Grid {
  const armor = Array<number>(cellCountOf(FULL_SHAPE)).fill(0);
  for (const [index, layers] of level.armor) armor[index] = layers;
  const board = replacePieces(source, armor);
  for (const [index, special] of level.starters ?? []) {
    const piece = board.pieces[index];
    if (piece) board.pieces[index] = { ...piece, special };
  }
  return board;
}
