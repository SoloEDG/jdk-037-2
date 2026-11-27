import type { Color } from '../../../shared/board';
import type { ColumnSpec, Capture, SeamCard } from '../model/types';
import { framedColumns } from '../model/validate';
import { captureFromLevel } from '../model/captures';
import { COMBINED_SHAPE } from '../model/validate';

/**
 * 卡片的深拷贝。不能用 structuredClone：工作室的卡片是 Vue 响应式代理，
 * 直接克隆会抛 DataCloneError。
 */
export function cloneCard<T>(card: T): T {
  return JSON.parse(JSON.stringify(card)) as T;
}

export const PALETTE: Color[] = ['ruby', 'amber', 'emerald', 'sapphire', 'violet'];
export const COLOR_NAME: Record<Color, string> = {
  ruby: '红', amber: '黄', emerald: '绿', sapphire: '蓝', violet: '紫',
};

export function captureList(card: SeamCard): (Capture | null)[] {
  return card.frames.map(frame => {
    const match = /^L(\d+)-(\d+)$/.exec(frame.captureId);
    if (!match) return null;
    const capture = captureFromLevel(Number(match[1]));
    return capture && capture.seed === Number(match[2]) ? capture : null;
  });
}

/** 重设某帧的起始列，并保持其余帧与来珠不变。 */
export function reframe(card: SeamCard, side: 0 | 1, offset: number, captureId?: string): SeamCard {
  const frames = card.frames.slice() as SeamCard['frames'];
  const previous = frames[side];
  frames[side] = { captureId: captureId ?? previous.captureId, offset: Math.max(0, Math.min(4, offset)) };
  const captures = captureList({ ...card, frames });
  const next = frames.map((frame, index) => {
    const capture = captures[index];
    if (!capture) return card.columns.slice(index * 4, index * 4 + 4);
    const fresh = framedColumns(capture, frame, index);
    // 框内容来自捕获，逐列保留作者已排的来珠。
    return fresh.map((column, local) => ({ ...column, queue: card.columns[index * 4 + local]?.queue.slice() ?? [] }));
  });
  return { ...card, frames, columns: [...next[0], ...next[1]] };
}

export function setQueue(card: SeamCard, column: number, queue: Color[]): SeamCard {
  const columns = card.columns.map((spec, index) => (index === column ? { ...spec, queue: queue.slice() } : spec)) as ColumnSpec[];
  return { ...card, columns };
}

export function pushColor(card: SeamCard, column: number, color: Color, limit = 6): SeamCard {
  const current = card.columns[column].queue;
  if (current.length >= limit) return card;
  return setQueue(card, column, [...current, color]);
}

export function popColor(card: SeamCard, column: number): SeamCard {
  const current = card.columns[column].queue;
  return current.length ? setQueue(card, column, current.slice(0, -1)) : card;
}

/** 合盘中某列在八列布局里的列号（0–7）。 */
export const globalColumn = (side: 0 | 1, local: number) => side * 4 + local;

export function moveName(index: number) {
  const x = index % COMBINED_SHAPE.width;
  const y = Math.floor(index / COMBINED_SHAPE.width);
  return `${String.fromCharCode(65 + x)}${y + 1}`;
}
