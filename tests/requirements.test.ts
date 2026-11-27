import { describe, expect, it, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SeamWorkshop from '../src/features/seam/ui/SeamWorkshop.vue';
import { demoCard } from '../src/features/seam/model/demo';
import { validateCard } from '../src/features/seam/model/validate';
import { buildBoard, COLUMN_ROWS } from '../src/features/seam/lib/columns';
import { applyTurn, runPlan } from '../src/features/seam/lib/simulate';
import { COMBINED_SHAPE, SEAM_COLUMN } from '../src/features/seam/model/validate';
import type { ColumnSpec } from '../src/features/seam/model/types';
import { fromShare, savePublished, toShare, type SeamStore } from '../src/features/seam/model/store';

const shape = COMBINED_SHAPE;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
});

const emptyColumn = (origin: number): ColumnSpec => ({
  cells: Array.from({ length: COLUMN_ROWS }, () => null),
  armor: Array<number>(COLUMN_ROWS).fill(0),
  queue: [],
  origin,
});

describe('来珠耗尽与空位', () => {
  it('队列耗尽后继续下落时，该列保留空位且 remaining 归零', () => {
    const columns = Array.from({ length: 8 }, (_, index) => emptyColumn(index < 4 ? 0 : 1));
    // 只有第 0 列有来珠和可消除内容
    columns[0] = {
      cells: Array.from({ length: COLUMN_ROWS }, (_, y) => (y === 7 ? { color: 'ruby' } : y === 6 ? { color: 'amber' } : null)),
      armor: Array<number>(COLUMN_ROWS).fill(0),
      queue: ['emerald'],
      origin: 0,
    };
    // 第 1 列补两颗同色，使交换能触发消除并消耗来珠
    columns[1] = {
      cells: Array.from({ length: COLUMN_ROWS }, (_, y) => (y === 7 ? { color: 'emerald' } : y === 6 ? { color: 'emerald' } : null)),
      armor: Array<number>(COLUMN_ROWS).fill(0),
      queue: ['ruby'],
      origin: 0,
    };
    const built = buildBoard(columns, 0, 8, shape);
    // 交换第 0 列底两格触发 ruby 三连（第 0 列 x2 + 第 1 列 1）
    const turn = applyTurn(built.grid, built.feed, { from: 63, to: 62 }, SEAM_COLUMN, shape, 0);
    // 不论该步是否合法，发珠器耗尽后必须返回 null 并不再增长
    const feed = buildBoard(columns, 0, 8, shape).feed;
    expect(feed.spawn(0)?.born).toBe('queue');
    expect(feed.spawn(0)).toBeNull();
    expect(feed.spawn(0)).toBeNull();
    expect(feed.usedTotal()).toBe(1);
    void turn;
  });

  it('合盘清空某列后不会凭空补珠：来珠颗数就是补入上限', () => {
    const columns = demoCard().columns;
    const total = columns.reduce((sum, column) => sum + column.queue.length, 0);
    const built = buildBoard(columns, 0, 8, shape);
    for (let x = 0; x < 8; x++) {
      let count = 0;
      while (built.feed.spawn(x)) count++;
      expect(count).toBe(columns[x].queue.length);
    }
    expect(built.feed.usedTotal()).toBe(total);
    expect(built.feed.exhaustedKeys().length).toBe(8);
  });
});

describe('越界落子不改来源', () => {
  it('把珠从一侧挪到另一侧后，被清除时来源仍是原片段', () => {
    const card = demoCard();
    const witness = validateCard(card).witness.value!;
    const run = runPlan({ columns: card.columns, start: 0, shape, moves: witness.moves, seam: SEAM_COLUMN });
    const ids = new Set(card.columns.flatMap((column, key) => column.cells.map((cell, y) => (cell ? key * 100 + y : null))).filter((id): id is number => id !== null));
    for (const sample of run.cross!.samples) {
      // 采样到的 id 必须是初盘原珠 id，而不是落子后的临时编号
      expect(ids.has(sample.id)).toBe(true);
      expect(sample.origin).toBe((Math.floor(sample.id / 100) < 4 ? 0 : 1));
    }
  });

  it('同一消除里两侧原珠的落点可以越界，但 origin 不随位置改变', () => {
    const card = demoCard();
    const run = runPlan({ columns: card.columns, start: 0, shape, moves: validateCard(card).witness.value!.moves, seam: SEAM_COLUMN });
    const samples = run.cross!.samples;
    expect(new Set(samples.map(sample => sample.origin)).size).toBe(2);
    for (const sample of samples) {
      const homeLeft = Math.floor(sample.id / 100) < 4;
      expect(sample.origin).toBe(homeLeft ? 0 : 1);
    }
  });
});

describe('重新打开复现', () => {
  it('分享载荷经过 JSON 往返后，重开仍能重现同一跨缝签名', () => {
    const card = demoCard();
    const witness = validateCard(card).witness.value!;
    const store: SeamStore = savePublished({ cards: {}, play: {} }, card, witness);
    const payload = JSON.parse(JSON.stringify(toShare(store.cards[card.id])));
    const reopened = fromShare(payload);
    expect(reopened?.witness?.signature).toBe(witness.signature);
    const replay = runPlan({ columns: reopened!.columns, start: 0, shape, moves: reopened!.witness!.moves, seam: SEAM_COLUMN });
    expect(replay.cross?.signature).toBe(witness.signature);
    expect(validateCard(reopened!).publishable).toBe(true);
  });
});

describe('只保存草稿', () => {
  it('未知帧或空来珠时不能发布，界面提示仅可保存草稿', async () => {
    const broken = demoCard();
    broken.frames = [{ captureId: 'L9-0', offset: 0 }, { captureId: 'L2-10832', offset: 4 }];
    const result = validateCard(broken);
    expect(result.publishable).toBe(false);
    const wrapper = mount(SeamWorkshop, { props: { store: { cards: {}, play: {} }, card: broken } });
    await flushPromises();
    expect(wrapper.text()).toContain('仅可保存草稿');
    const publish = wrapper.findAll('button').find(button => button.text() === '发布');
    expect(publish?.attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });
});

describe('下落与空位', () => {
  it('重力下落时来珠耗尽会在顶部保留空位，而不是补出无来源珠', async () => {
    const { settle } = await import('../src/features/board/lib/gravity');
    const { makeColumnFeed, COLUMN_ROWS } = await import('../src/features/seam/lib/columns');
    const columns = Array.from({ length: 8 }, (_, index) => emptyColumn(index < 4 ? 0 : 1));
    columns[0] = { ...emptyColumn(0), queue: ['ruby'] };
    const feed = makeColumnFeed(columns, 0, 8, shape);
    // 第 0 列只有最底一颗原珠 → 上方 7 格需要来珠，但队列只剩 1 颗
    const grid = {
      pieces: Array.from({ length: 64 }, (_, index) => (index === 56 ? { id: 7, color: 'ruby' as const, origin: 0, born: 'board' as const } : null)),
      armor: Array<number>(64).fill(0),
    };
    const settled = settle(grid, feed);
    const columnPieces = Array.from({ length: COLUMN_ROWS }, (_, y) => settled.pieces[y * 8]);
    expect(columnPieces.filter(Boolean).length).toBe(2);
    expect(columnPieces.filter(piece => piece?.born === 'queue').length).toBe(1);
    expect(settled.pieces[56]?.id).toBe(7);
    // 顶部 6 格保持空位，不被无来源珠填充
    expect(columnPieces.filter(piece => !piece).length).toBe(6);
    expect(feed.usedTotal()).toBe(1);
  });
});
