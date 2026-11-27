import type { Result, Tally } from '../../../shared/levels';
import type { Capture, ColumnSpec, Frame, SeamCard, Witness } from '../model/types';

const STORE_KEY = 'crystal-shift:seam:1';

export interface SeamStore {
  cards: Record<string, SeamCard>;
  play: Record<string, { cleared: number; cross: boolean; witnessSignature: string | null }>;
}

const empty = (): SeamStore => ({ cards: {}, play: {} });

function validCard(value: unknown): value is SeamCard {
  if (!value || typeof value !== 'object') return false;
  const card = value as SeamCard;
  return card.version === 1 && typeof card.id === 'string' && Array.isArray(card.frames) && Array.isArray(card.columns)
    && (card.status === 'draft' || card.status === 'published');
}

export function readStore(): SeamStore {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object') return empty();
    const cards = (parsed as SeamStore).cards ?? {};
    return {
      cards: Object.fromEntries(Object.entries(cards).filter(([, card]) => validCard(card))),
      play: (parsed as SeamStore).play ?? {},
    };
  } catch {
    return empty();
  }
}

export function writeStore(store: SeamStore): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/** 未完成校验或搜索被截断时，只落草稿；草稿不会写见证，避免把未证结果当发布。 */
export function saveDraft(store: SeamStore, card: SeamCard): SeamStore {
  const draft: SeamCard = { ...card, status: 'draft', witness: null, updatedAt: new Date().toISOString() };
  return { ...store, cards: { ...store.cards, [card.id]: draft } };
}

/** 发布必须有完整校验通过（publishable）与可复现见证。 */
export function savePublished(store: SeamStore, card: SeamCard, witness: Witness): SeamStore {
  const published: SeamCard = {
    ...card, status: 'published', witness, updatedAt: new Date().toISOString(),
  };
  return { ...store, cards: { ...store.cards, [card.id]: published } };
}

export function removeCard(store: SeamStore, id: string): SeamStore {
  const cards = { ...store.cards };
  delete cards[id];
  return { ...store, cards };
}

export function recordPlay(store: SeamStore, id: string, summary: SeamStore['play'][string]): SeamStore {
  return { ...store, play: { ...store.play, [id]: summary } };
}

export interface SharePayload {
  v: 1;
  id: string;
  title: string;
  target: number;
  frames: [Frame, Frame];
  captures: [CaptureSeed, CaptureSeed];
  columns: { q: string; a: number[]; c: (null | [string, string?])[] }[];
  witness: Witness;
}

export type CaptureSeed = { level: number; seed: number };

/** 从捕获 id `L<level>-<seed>` 提取重建种子。 */
export function captureSeeds(card: SeamCard): [CaptureSeed, CaptureSeed] {
  const one = (id: string): CaptureSeed => {
    const match = /^L(\d+)-(\d+)$/.exec(id);
    return match ? { level: Number(match[1]), seed: Number(match[2]) } : { level: 1, seed: 0 };
  };
  return [one(card.frames[0].captureId), one(card.frames[1].captureId)];
}

/** 分享载荷只携带重建所需的种子、列内容与见证，不含“已通过”的结论。 */
export function toShare(card: SeamCard): SharePayload {
  return {
    v: 1,
    id: card.id,
    title: card.title,
    target: card.target,
    frames: card.frames,
    captures: captureSeeds(card),
    columns: card.columns.map(column => ({
      q: column.queue.map(color => color[0]).join(''),
      a: column.armor.slice(),
      c: column.cells.map(cell => (cell ? [cell.color, cell.special] : null)),
    })),
    witness: card.witness!,
  };
}

const decodeColor = (letter: string): ColumnSpec['queue'][number] | null => {
  const names = { r: 'ruby', a: 'amber', e: 'emerald', s: 'sapphire', v: 'violet' } as const;
  return (names as Record<string, ColumnSpec['queue'][number]>)[letter] ?? null;
};

export function fromShare(payload: SharePayload): SeamCard | null {
  if (payload?.v !== 1 || payload.columns?.length !== 8) return null;
  const columns: ColumnSpec[] = payload.columns.map((column, index) => {
    const queue = [...column.q].map(decodeColor);
    if (queue.some(color => !color)) return null as unknown as ColumnSpec;
    return {
      cells: column.c.map(cell => (cell ? { color: cell[0] as ColumnSpec['queue'][number], ...(cell[1] ? { special: cell[1] as never } : {}) } : null)),
      armor: column.a.slice(),
      queue: queue as ColumnSpec['queue'],
      origin: index < 4 ? 0 : 1,
    };
  });
  if (columns.some(column => !column)) return null;
  const now = new Date().toISOString();
  return {
    version: 1,
    id: payload.id,
    title: payload.title,
    frames: payload.frames,
    columns,
    target: payload.target,
    budget: 4,
    status: 'published',
    witness: payload.witness,
    createdAt: now,
    updatedAt: now,
  };
}

export { STORE_KEY };
export type { Result, Tally };
