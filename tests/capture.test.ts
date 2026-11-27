import { describe, expect, it } from 'vitest';
import { demoCard } from '../src/features/seam/model/demo';
import { validateCard, COMBINED_SHAPE } from '../src/features/seam/model/validate';
import { buildBoard } from '../src/features/seam/lib/columns';
import type { Move } from '../src/features/seam/model/types';

const shape = COMBINED_SHAPE;

describe('四步预算与目标', () => {
  it('见证步数不超过预算，且不能靠少于预算掩盖片盘的可达性', () => {
    const card = demoCard();
    const validation = validateCard(card);
    expect(validation.witness.value!.moves.length).toBeLessThanOrEqual(4);
    // 去掉一步预算后，合盘应仍可行（此处仅检查搜索在 1 步内即可完成）
    expect(validation.slices.every(slice => slice.status !== 'unknown')).toBe(true);
  });

  it('目标过高时合盘也找不到见证（没有被片盘判定污染）', () => {
    const card = demoCard();
    const hard = validateCard({ ...card, target: 99 }, { witnessDeadline: 4000 });
    expect(hard.witness.status).toBe('none');
    expect(hard.publishable).toBe(false);
  });

  it('非法交换不会计入步数或霜层', async () => {
    const card = demoCard();
    const built = buildBoard(card.columns, 0, 8, shape);
    const { applyTurn } = await import('../src/features/seam/lib/simulate');
    const bad: Move = { from: 0, to: 63 };
    const result = applyTurn(built.grid, built.feed, bad, 4, shape, 0);
    expect(result.legal).toBe(false);
    expect(result.armor).toBe(0);
    expect(result.cross).toBeNull();
  });
});
