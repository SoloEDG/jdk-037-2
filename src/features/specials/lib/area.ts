import { FULL_SHAPE, at, cellCountOf, indexAt, type Shape } from '../../../shared/board';

export function cellsWhere(predicate: (x: number, y: number) => boolean, shape: Shape = FULL_SHAPE) {
  return Array.from({ length: cellCountOf(shape) }, (_, index) => index).filter(index => {
    const { x, y } = at(index, shape);
    return predicate(x, y);
  });
}

export function square(index: number, radius: number, shape: Shape = FULL_SHAPE) {
  const center = at(index, shape);
  return cellsWhere((x, y) => Math.abs(x - center.x) <= radius && Math.abs(y - center.y) <= radius, shape);
}

export { indexAt };
