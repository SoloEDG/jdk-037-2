import { FULL_SHAPE, adjacent, at, type Grid, type Shape } from '../../../shared/board';
import type { Turn, Wave } from '../../../shared/turn';
import { replacePieces } from '../../board/model/generator';
import { hasColorSwap } from '../../board/lib/matching';
import { feedFromSource, type BoardFeed } from '../../board/lib/gravity';
import type { PieceSource } from '../../board/model/source';
import { canCombine, combine } from '../../specials/lib/combine';
import { resolveWave } from './wave';

function playable(grid: Grid, shape: Shape) {
  return hasColorSwap(grid, shape) || grid.pieces.some((piece, index) => {
    const { x, y } = at(index, shape);
    const right = x + 1 < shape.width ? index + 1 : -1;
    const down = y + 1 < shape.height ? index + shape.width : -1;
    return [right, down].some(next => next >= 0 && adjacent(index, next, shape) && canCombine(piece, grid.pieces[next] ?? null));
  });
}

function drive(grid: Grid, from: number, to: number, feed: BoardFeed, shape: Shape): Turn {
  const pieces = grid.pieces.slice();
  if (!adjacent(from, to, shape) || !pieces[from] || !pieces[to]) return { legal: false, swap: grid };
  [pieces[from], pieces[to]] = [pieces[to], pieces[from]];
  const swap = { pieces, armor: grid.armor };
  const combo = combine(swap, from, to, shape);
  const first = resolveWave(swap, 1, feed, [to, from], combo?.cells, shape);
  if (!first) return { legal: false, swap };

  const waves: Wave[] = [first];
  let final = first.board;
  for (let depth = 2; depth <= 64; depth++) {
    const wave = resolveWave(final, depth, feed, [], undefined, shape);
    if (!wave) break;
    waves.push(wave);
    final = wave.board;
  }
  return { legal: true, swap, waves, final, reshuffled: false, combo: combo?.label ?? null };
}

export function playTurn(grid: Grid, from: number, to: number, source: PieceSource): Turn {
  const turn = drive(grid, from, to, feedFromSource(source), FULL_SHAPE);
  if (!turn.legal) return turn;
  const dead = turn.waves.length === 64 || !playable(turn.final, FULL_SHAPE);
  return dead ? { ...turn, final: replacePieces(source, turn.final.armor), reshuffled: true } : turn;
}

/** 接缝卡专用：按给定形状与按列发珠接口演算；来珠耗尽或死局时不补珠、不洗牌。 */
export function playFeededTurn(grid: Grid, from: number, to: number, feed: BoardFeed, shape: Shape): Turn {
  return drive(grid, from, to, feed, shape);
}
