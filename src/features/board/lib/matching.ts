import { Board, Matcher, classifyMatches } from 'miaoda-game-match3-core';
import { FULL_SHAPE, indexAt, type Grid, type Shape } from '../../../shared/board';

export const BOARD_SHAPE: Shape = FULL_SHAPE;

export function matcherOf(grid: Grid, shape: Shape = BOARD_SHAPE) {
  const symbols = new Board({ width: shape.width, height: shape.height });
  grid.pieces.forEach((piece, index) => {
    const x = index % shape.width;
    const y = Math.floor(index / shape.width);
    symbols.set(x, y, piece?.color ?? null);
  });
  return new Matcher(symbols);
}

export function matchingGroups(grid: Grid, preferred: number[] = [], shape: Shape = BOARD_SHAPE) {
  const runs = matcherOf(grid, shape).matchAll(3);
  return classifyMatches(runs).map(group => {
    const cells = group.tiles.map(cell => indexAt(cell.x, cell.y, shape));
    const pivot = preferred.find(index => cells.includes(index)) ?? indexAt(group.pivot.x, group.pivot.y, shape);
    return { cells, pivot, shape: group.shape, across: group.tiles.every(cell => cell.y === group.tiles[0].y) };
  });
}

export function hasColorSwap(grid: Grid, shape: Shape = BOARD_SHAPE) {
  return matcherOf(grid, shape).hasLegalSwap(3);
}
