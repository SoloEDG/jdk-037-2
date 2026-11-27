import { Board, collapse } from 'miaoda-game-match3-core';
import { FULL_SHAPE, at, type Color, type Grid, type Piece, type Shape } from '../../../shared/board';

/**
 * 补珠接口。普通玩法整盘共用一个随机源；接缝卡按列给出有限来珠队列，
 * 队列耗尽时返回 null —— 重力会保留空位，不会凭空补珠。
 */
export interface BoardFeed {
  shape: Shape;
  /** 为第 x 列生成一颗补入晶石；返回 null 表示该列来珠已耗尽。 */
  spawn(x: number): Piece | null;
}

export function feedFromSource(source: { color(): Color; piece(color: Color): Piece }): BoardFeed {
  return {
    shape: FULL_SHAPE,
    spawn: () => source.piece(source.color()),
  };
}

/** 普通 8×8 与 4×8 片盘共用：重力下落 + 按列补珠。 */
export function settle(grid: Grid, feed: BoardFeed): Grid {
  const shape = feed.shape;
  const board = new Board({ width: shape.width, height: shape.height });
  const pieces = new Map<number, Piece>();
  grid.pieces.forEach((piece, index) => {
    const { x, y } = at(index, shape);
    if (piece) pieces.set(piece.id, piece);
    board.set(x, y, piece?.id ?? null);
  });
  collapse(board, x => {
    const piece = feed.spawn(x);
    if (!piece) return null;
    pieces.set(piece.id, piece);
    return piece.id;
  });
  return {
    pieces: grid.pieces.map((_, index) => {
      const { x, y } = at(index, shape);
      if (x >= shape.width || y >= shape.height) return null;
      const id = board.get(x, y);
      // 来珠耗尽时 collapse 会把格子留成 null；不能把 null 当成 id 0。
      if (id === null || id === undefined) return null;
      return pieces.get(Number(id)) ?? null;
    }),
    armor: grid.armor,
  };
}

/** 该索引是否落在片盘/整盘内。 */
export const within = (index: number, shape: Shape = FULL_SHAPE) => {
  const { x, y } = at(index, shape);
  return x < shape.width && y < shape.height;
};
