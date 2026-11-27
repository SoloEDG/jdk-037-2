import type { Frame, SeamCard } from './types';
import { COLORS, type Color } from '../../../shared/board';
import { captureFromLevel } from './captures';
import { framedColumns } from './validate';

const colorOf = (index: number): Color => COLORS[index % COLORS.length];

/**
 * 示例解题卡：两次真实对局的稳定盘上各框四列。
 * 左侧来自关卡 2 的第 1–4 列（含横向脉冲），右侧来自关卡 3 的第 5–8 列（含震荡核心），
 * 两个特消正隔接缝相邻；单独任一侧都凑不出同一次跨缝消除。
 */
export function demoCard(now = new Date().toISOString()): SeamCard {
  const left = captureFromLevel(2);
  const right = captureFromLevel(3);
  if (!left || !right) throw new RangeError('示例解题卡依赖第 2、3 关的稳定盘捕获');
  const frames: [Frame, Frame] = [
    { captureId: left.id, offset: 0 },
    { captureId: right.id, offset: 4 },
  ];
  const columns = [...framedColumns(left, frames[0], 0), ...framedColumns(right, frames[1], 1)];
  // 作者为每列排定的有限来珠：同列顺序在片盘与合盘上完全一致。
  const queues: Color[][] = [
    [colorOf(1), colorOf(2), colorOf(3)],
    [colorOf(0), colorOf(4), colorOf(1)],
    [colorOf(2), colorOf(0), colorOf(4)],
    [colorOf(3), colorOf(1), colorOf(0)],
    [colorOf(4), colorOf(2), colorOf(1)],
    [colorOf(1), colorOf(3), colorOf(4)],
    [colorOf(0), colorOf(2), colorOf(3)],
    [colorOf(2), colorOf(4), colorOf(0)],
  ];
  columns.forEach((column, index) => { column.queue = queues[index].slice(); });
  return {
    version: 1,
    id: 'seam-demo-01',
    title: '接缝解题卡 · 双脉合流',
    frames,
    columns,
    target: 6,
    budget: 4,
    status: 'draft',
    witness: null,
    createdAt: now,
    updatedAt: now,
  };
}
