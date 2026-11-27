import { FULL_SHAPE, SIZE, at, indexAt, type Grid, type Piece, type Shape } from '../../../shared/board';
import { cellsWhere, square } from './area';

export function canCombine(a: Piece | null, b: Piece | null) {
  return !!a && !!b && (a.special === 'prism' || b.special === 'prism' || (!!a.special && !!b.special));
}

export function combine(grid: Grid, from: number, to: number, shape: Shape = FULL_SHAPE) {
  const a = grid.pieces[from];
  const b = grid.pieces[to];
  if (!a || !b || !canCombine(a, b)) return null;

  const { x, y } = at(to, shape);
  if (a.special === 'prism' && b.special === 'prism') {
    return { label: '双棱镜', cells: cellsWhere(() => true, shape) };
  }
  if (a.special === 'prism' || b.special === 'prism') {
    const peer = a.special === 'prism' ? b : a;
    const cells = cellsWhere((x, y) => grid.pieces[indexAt(x, y, shape)]?.color === peer.color, shape);
    if (peer.special === 'burst') cells.push(...cells.flatMap(index => square(index, 1, shape)));
    if (peer.special === 'row' || peer.special === 'column') {
      const axis = new Set(cells.map(index => at(index, shape)[peer.special === 'row' ? 'y' : 'x']));
      cells.push(...cellsWhere((x, y) => axis.has(peer.special === 'row' ? y : x), shape));
    }
    return { label: peer.special ? '棱镜共振' : '棱镜扫色', cells: [...cells, from, to] };
  }
  if (a.special === 'burst' && b.special === 'burst') return { label: '双核心震荡', cells: square(to, 2, shape) };
  if (a.special === 'burst' || b.special === 'burst') {
    return { label: '宽幅震荡', cells: cellsWhere((cx, cy) => Math.abs(cx - x) <= 1 || Math.abs(cy - y) <= 1, shape) };
  }
  return { label: '十字脉冲', cells: cellsWhere((cx, cy) => cx === x || cy === y, shape) };
}

export { SIZE };
