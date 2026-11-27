import { FULL_SHAPE, type Color, type Grid, type Shape } from '../../../shared/board';
import type { ClearTrace, Wave } from '../../../shared/turn';
import { matchingGroups } from '../../board/lib/matching';
import { settle, type BoardFeed } from '../../board/lib/gravity';
import { propagate } from '../../specials/lib/propagate';
import { specialFor } from '../../specials/model/catalog';

/** 记录被清除晶石的来源；仅当晶石带 origin 时写入。 */
function tracesOf(grid: Grid, hits: number[]): ClearTrace[] {
  const out: ClearTrace[] = [];
  for (const index of hits) {
    const piece = grid.pieces[index];
    if (!piece || piece.origin === undefined || !piece.born) continue;
    out.push({ id: piece.id, origin: piece.origin, born: piece.born, index, color: piece.color });
  }
  return out;
}

export function resolveWave(
  grid: Grid,
  depth: number,
  feed: BoardFeed,
  preferred: number[],
  comboCells?: number[],
  shape: Shape = feed.shape ?? FULL_SHAPE,
): Wave | null {
  const groups = matchingGroups(grid, preferred, shape);
  if (!groups.length && !comboCells) return null;
  const seeds = new Set(groups.flatMap(group => group.cells));
  comboCells?.forEach(index => seeds.add(index));
  const created: Wave['created'] = [];
  if (!comboCells) for (const group of groups) {
    if (group.cells.some(index => grid.pieces[index]?.special)) continue;
    const special = specialFor(group.shape, group.across);
    if (special) created.push({ index: group.pivot, special });
  }

  const protectedCells = new Set(created.map(item => item.index));
  const { hits, triggered } = propagate(grid, seeds, comboCells ? preferred : [], protectedCells, shape);
  const pieces = grid.pieces.slice();
  const armor = grid.armor.slice();
  const armorHits: number[] = [];
  const colors: Color[] = [];
  const provenance = tracesOf(grid, hits);
  for (const index of hits) {
    const piece = pieces[index];
    if (piece) colors.push(piece.color);
    pieces[index] = null;
    if (armor[index] > 0) {
      armor[index] -= 1;
      armorHits.push(index);
    }
  }
  for (const { index, special } of created) {
    const piece = pieces[index];
    if (piece) pieces[index] = { ...piece, special };
    if (armor[index] > 0) {
      armor[index] -= 1;
      armorHits.push(index);
    }
  }

  return {
    depth, cleared: hits, colors, armorHits, created, triggered,
    board: settle({ pieces, armor }, feed),
    provenance,
  };
}
