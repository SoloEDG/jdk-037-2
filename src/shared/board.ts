export const SIZE = 8;
export const CELL_COUNT = SIZE * SIZE;
export const COLORS = ['ruby', 'amber', 'emerald', 'sapphire', 'violet'] as const;
export type Color = typeof COLORS[number];
export type Special = 'row' | 'column' | 'burst' | 'prism';

export interface Piece {
  id: number;
  color: Color;
  special?: Special;
  /** 0 | 1 — 接缝卡中的来源片段；普通关卡不设置。 */
  origin?: number;
  /** 接缝卡中该晶石是初盘原珠还是来珠补入。 */
  born?: 'board' | 'queue';
}

export interface Grid {
  pieces: (Piece | null)[];
  armor: number[];
}

export interface Shape {
  width: number;
  height: number;
}

/** 普通 8×8 对局与合盘使用整盘形状；4 列片盘用 4×8。 */
export const FULL_SHAPE: Shape = { width: SIZE, height: SIZE };

export const cellCountOf = (shape: Shape = FULL_SHAPE) => shape.width * shape.height;
export const at = (index: number, shape: Shape = FULL_SHAPE) => ({ x: index % shape.width, y: Math.floor(index / shape.width) });
export const indexAt = (x: number, y: number, shape: Shape = FULL_SHAPE) => y * shape.width + x;

export const cellIndex = (x: number, y: number) => y * SIZE + x;
export const position = (index: number) => at(index, FULL_SHAPE);
export const adjacent = (a: number, b: number, shape: Shape = FULL_SHAPE) => {
  const left = at(a, shape);
  const right = at(b, shape);
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;
};
