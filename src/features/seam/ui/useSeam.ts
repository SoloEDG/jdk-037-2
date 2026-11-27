import { computed, ref, shallowRef } from 'vue';
import type { SeamCard, SeamStore, SharePayload } from '..';
import { demoCard, fromShare, readStore, recordPlay, saveDraft, writeStore } from '..';
import { cloneCard } from './editing';
import { runPlan, COMBINED_SHAPE, SEAM_COLUMN } from '..';

export function useSeam() {
  const store = shallowRef<SeamStore>(readStore());
  const notice = ref('');

  /** 地址栏带分享载荷时，优先用它重建（重新打开即可复现跨缝贡献）。 */
  function fromHash(): SeamCard | null {
    const match = /(?:^#|[#&])seam=([^&]+)/.exec(location.hash);
    if (!match) return null;
    try {
      const payload = JSON.parse(decodeURIComponent(match[1])) as SharePayload;
      return fromShare(payload);
    } catch {
      return null;
    }
  }

  const shared = fromHash();
  const card = ref<SeamCard>(shared ?? store.value.cards['seam-demo-01'] ?? demoCard());
  if (shared) {
    store.value = { ...store.value, cards: { ...store.value.cards, [shared.id]: shared } };
    writeStore(store.value);
    notice.value = '已从分享载荷重建解题卡，可重放见证复现跨缝贡献';
  }

  function save(next: SeamCard) {
    card.value = next;
  }

  function updateStore(next: SeamStore) {
    store.value = next;
    if (!writeStore(next)) notice.value = '浏览器存储不可用，本次改动未落盘';
  }

  /** 工作室里可切换的解题卡：草稿与已发布都列出。 */
  const all = computed(() => Object.values(store.value.cards)
    .filter((entry): entry is SeamCard => !!entry)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)));

  function startCard(id: string) {
    const found = store.value.cards[id];
    if (found) card.value = cloneCard(found);
  }

  /** 完成一次带见证试玩后记录成绩（草稿不记录发布结论）。 */
  function record(summary: { id: string; cleared: number; cross: boolean; signature: string | null }) {
    updateStore(recordPlay(store.value, summary.id, {
      cleared: summary.cleared, cross: summary.cross, witnessSignature: summary.signature,
    }));
  }

  function replay(id: string) {
    const found = store.value.cards[id];
    if (!found?.witness) return null;
    return runPlan({ columns: found.columns, start: 0, shape: COMBINED_SHAPE, moves: found.witness.moves, seam: SEAM_COLUMN });
  }

  function newCard() {
    const fresh = demoCard();
    card.value = fresh;
    updateStore(saveDraft(store.value, fresh));
  }

  function remember(next: SeamCard) {
    updateStore({ ...store.value, cards: { ...store.value.cards, [next.id]: next } });
  }

  return {
    store, card, notice, cards: all, save, updateStore, startCard, record, replay, newCard, remember,
    initialNotice: notice.value,
  };
}
