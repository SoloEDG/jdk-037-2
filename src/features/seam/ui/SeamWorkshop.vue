<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { CheckCircle2, ClipboardCheck, FilePen, Play, RotateCcw, Share2, Sparkles } from 'lucide-vue-next';
import type { Color } from '../../../shared/board';
import type { Move, SeamCard, SeamValidation, Witness } from '../model/types';
import { validateCard, COMBINED_SHAPE, SEAM_COLUMN } from '../model/validate';
import { saveDraft, savePublished, toShare } from '../model/store';
import type { SeamStore } from '../model/store';
import { startPlay, playMove, replayWitness, judged, type PlayState } from '../lib/play';
import { buildBoard } from '../lib/columns';
import SeamBoard from './SeamBoard.vue';
import QueueEditor from './QueueEditor.vue';
import CheckList from './CheckList.vue';
import { COLOR_NAME, captureList, cloneCard, moveName, reframe } from './editing';

const props = defineProps<{ store: SeamStore; card: SeamCard; cards?: SeamCard[] }>();
const emit = defineEmits<{
  'update:card': [card: SeamCard];
  'update:store': [store: SeamStore];
  'notice': [message: string];
  'open': [id: string];
  'new': [];
  'remember': [card: SeamCard];
  'record': [summary: { id: string; cleared: number; cross: boolean; signature: string | null }];
}>();

const working = ref<SeamCard>(cloneCard(props.card));
watch(() => props.card, next => { working.value = cloneCard(next); runValidation(); }, { deep: true });

const validation = ref<SeamValidation | null>(null);
const validating = ref(false);
const selected = ref<number | null>(null);
const play = ref<PlayState | null>(null);
const playHits = ref<number[]>([]);
const playNote = ref('按卡上见证试玩，或自行走子');
const hint = ref<Witness | null>(null);
const copied = ref(false);

const captures = computed(() => captureList(working.value));
const built = computed(() => buildBoard(working.value.columns, 0, COMBINED_SHAPE.width, COMBINED_SHAPE));
const viewGrid = computed(() => play.value?.grid ?? built.value.grid);
const playActive = computed(() => !!play.value);

function update(next: SeamCard) {
  working.value = next;
  emit('update:card', next);
}

onMounted(runValidation);

function runValidation() {
  validating.value = true;
  const next = validateCard(working.value);
  validation.value = next;
  validating.value = false;
}

function chooseCapture(side: 0 | 1, event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  update(reframe(working.value, side, working.value.frames[side].offset, id));
  resetPlay();
  runValidation();
}

function chooseOffset(side: 0 | 1, event: Event) {
  update(reframe(working.value, side, Number((event.target as HTMLSelectElement).value)));
  resetPlay();
  runValidation();
}

function changeTarget(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isSafeInteger(value) || value < 1) return;
  update({ ...working.value, target: value });
  resetPlay();
  runValidation();
}

function changeQueue(column: number, queue: Color[]) {
  update({ ...working.value, columns: working.value.columns.map((spec, index) => (index === column ? { ...spec, queue } : spec)) });
  runValidation();
}

function clickCell(index: number) {
  const current = selected.value;
  if (current === null) { selected.value = index; return; }
  if (current === index) { selected.value = null; return; }
  const dx = Math.abs((current % 8) - (index % 8));
  const dy = Math.abs(Math.floor(current / 8) - Math.floor(index / 8));
  selected.value = null;
  if (dx + dy !== 1) { selected.value = index; return; }
  attempt({ from: current, to: index });
}

function attempt(move: Move) {
  if (!play.value) {
    play.value = startPlay(working.value.columns);
    hint.value = null;
  }
  const result = playMove(play.value, working.value, move);
  playNote.value = result.note;
  if (!result.legal) return;
  play.value = result.state;
  playHits.value = moveTargets(result.state);
  window.setTimeout(() => { playHits.value = []; }, 220);
  const state = result.state;
  const done = state.armor >= working.value.target || state.moves.length >= working.value.budget;
  if (done) emit('record', { id: working.value.id, cleared: state.armor, cross: !!state.cross, signature: state.cross?.signature ?? null });
}

function moveTargets(state: PlayState) {
  const last = state.moves[state.moves.length - 1];
  return last ? [last.from, last.to] : [];
}

function resetPlay() {
  play.value = null;
  selected.value = null;
  playHits.value = [];
  playNote.value = '按卡上见证试玩，或自行走子';
}

function runHint() {
  const witness = working.value.witness ?? validation.value?.witness.value ?? null;
  const outcome = witness ? replayWitness({ ...working.value, witness }) : null;
  resetPlay();
  if (!outcome) { playNote.value = '尚无见证可重放'; return; }
  play.value = startPlay(working.value.columns);
  for (const move of outcome.moves) {
    const result = playMove(play.value, working.value, move);
    if (result.legal) play.value = result.state;
  }
  playHits.value = outcome.cross?.samples.map(sample => sample.index) ?? [];
  hint.value = witness;
  playNote.value = outcome.cross
    ? `见证复现跨缝贡献 ${outcome.cross.signature}，清霜 ${outcome.armor}`
    : '见证未能复现跨缝贡献';
}

const verdict = computed(() => (play.value ? judged(play.value, working.value) : null));

function saveDraftCard() {
  const next = saveDraft(props.store, working.value);
  emit('update:store', next);
  emit('remember', next.cards[working.value.id]);
  emit('notice', '已保存草稿（不含见证）');
}

function publish() {
  const result = validateCard(working.value);
  validation.value = result;
  if (!result.publishable || !result.witness.value) {
    emit('notice', '校验未通过或搜索未完成：只能保存草稿');
    return;
  }
  const next = savePublished(props.store, working.value, result.witness.value);
  update({ ...working.value, status: 'published', witness: result.witness.value });
  emit('update:store', next);
  emit('remember', next.cards[working.value.id]);
  emit('notice', `已发布，见证 ${result.witness.value.signature}`);
}

async function share() {
  const payload = toShare({ ...working.value, witness: working.value.witness ?? validation.value?.witness.value ?? null });
  if (!payload.witness) { emit('notice', '没有见证可分享，请先发布'); return; }
  const text = `晶矿连锁 · 接缝解题卡 ${working.value.title}\n${location.origin}${location.pathname}#seam=${encodeURIComponent(JSON.stringify(payload))}`;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    emit('notice', '分享链接已复制，重新打开可复现跨缝贡献');
    window.setTimeout(() => { copied.value = false; }, 1800);
  } catch {
    emit('notice', '剪贴板不可用，已把分享载荷写入地址栏');
    location.hash = `seam=${encodeURIComponent(JSON.stringify(payload))}`;
  }
}

</script>

<template>
  <section class="workshop">
    <header class="workshop-head">
      <div>
        <h2>{{ working.title }} <small>{{ working.status === 'published' ? '已发布' : '草稿' }} · 目标清霜 {{ working.target }} · {{ working.budget }} 步</small></h2>
        <p>两帧各框四列；片盘与合盘共享同一列的同一来珠顺序，合盘需在同一预算内给出跨缝见证。</p>
      </div>
      <div class="head-actions">
        <select v-if="cards && cards.length" class="card-pick" :value="working.id" aria-label="切换解题卡" @change="$emit('open', ($event.target as HTMLSelectElement).value)">
          <option v-for="entry in cards" :key="entry.id" :value="entry.id">{{ entry.title }} · {{ entry.status === 'published' ? '已发布' : '草稿' }}</option>
        </select>
        <button type="button" class="plain" @click="$emit('new')">按示例新建</button>
        <button type="button" class="plain" @click="runValidation"><ClipboardCheck :size="15" />重新校验</button>
        <button type="button" class="plain" @click="saveDraftCard"><FilePen :size="15" />保存草稿</button>
        <button type="button" class="primary" :disabled="!validation?.publishable" @click="publish"><CheckCircle2 :size="15" />发布</button>
      </div>
    </header>

    <div class="frames">
      <div v-for="side in [0, 1] as const" :key="side" class="frame">
        <label>
          <span>片段 {{ side === 0 ? 'A' : 'B' }}</span>
          <select :value="working.frames[side].captureId" @change="chooseCapture(side, $event)" :aria-label="`片段 ${side === 0 ? 'A' : 'B'} 捕获`">
            <option v-for="capture in captures" :key="capture?.id" :value="capture?.id">{{ capture?.label ?? '未知捕获' }}</option>
          </select>
        </label>
        <label>
          <span>起始列</span>
          <select :value="working.frames[side].offset" @change="chooseOffset(side, $event)" :aria-label="`片段 ${side === 0 ? 'A' : 'B'} 起始列`">
            <option v-for="offset in [0, 1, 2, 3, 4]" :key="offset" :value="offset">{{ offset + 1 }}–{{ offset + 4 }}</option>
          </select>
        </label>
        <ul class="col-strip">
          <li v-for="local in 4" :key="local" :class="working.columns[side * 4 + local - 1].origin === 0 ? 'a' : 'b'">{{ String.fromCharCode(65 + side * 4 + local - 1) }}</li>
        </ul>
      </div>
    </div>

    <div class="play-layout">
      <div class="play-area">
        <SeamBoard
          :grid="viewGrid" :selected="selected" :hits="playHits" :disabled="false"
          :columns="[0, 1, 2, 3, 4, 5, 6, 7]" :seam-at="SEAM_COLUMN" @select="clickCell"
        />
        <label class="target-field">
          <span>目标清霜</span>
          <input type="number" min="1" max="64" :value="working.target" aria-label="目标清霜" @change="changeTarget" />
        </label>
        <div class="play-bar" aria-live="polite">
          <span>{{ playNote }}</span>
          <span v-if="play">清霜 {{ play.armor }} / {{ working.target }} · 已走 {{ play.moves.length }} 步</span>
          <span v-if="verdict?.cross" class="good">跨缝 {{ verdict.reproduced ? '复现见证' : '已发生' }}</span>
        </div>
        <div class="play-actions">
          <button type="button" class="plain" @click="runHint"><Sparkles :size="15" />按见证试玩</button>
          <button type="button" class="plain" @click="resetPlay"><RotateCcw :size="15" />重置</button>
          <button type="button" class="plain" @click="share"><Share2 :size="15" />{{ copied ? '已复制' : '分享' }}</button>
        </div>
        <p class="hint">先点一格再点相邻格交换。跨缝贡献只认同一消除里两侧各有一枚初盘原珠；来珠不会改变来源。</p>
      </div>
      <aside>
        <CheckList v-if="validation" :validation="validation" />
        <p v-else class="hint">尚未校验。</p>
      </aside>
    </div>

    <QueueEditor :card="working" @change="changeQueue" />

    <details class="evidence" v-if="validation">
      <summary>片盘与合盘判定</summary>
      <dl>
        <div><dt>单独成盘（A / B）</dt><dd>{{ validation.slices[0].status }} · {{ validation.slices[0].max }} / {{ validation.slices[1].status }} · {{ validation.slices[1].max }}</dd></div>
        <div><dt>霜层（A / B / 合）</dt><dd>{{ validation.armor.left }} / {{ validation.armor.right }} / {{ validation.armor.combined }}</dd></div>
        <div><dt>合盘见证</dt><dd>{{ validation.witness.value ? `${validation.witness.value.armor} 霜 · ${validation.witness.value.signature}` : validation.witness.status }}</dd></div>
      </dl>
      <ol class="moves" v-if="validation.witness.value">
        <li v-for="(move, index) in validation.witness.value.moves" :key="index">第 {{ index + 1 }} 步：{{ moveName(move.from) }} ↔ {{ moveName(move.to) }}</li>
      </ol>
      <ol class="samples" v-if="validation.witness.value">
        <li v-for="sample in validation.witness.value.cross.samples" :key="sample.id">
          片段 {{ sample.origin === 0 ? 'A' : 'B' }} 原珠 #{{ sample.id }} · {{ COLOR_NAME[sample.color] }} @ {{ moveName(sample.index) }}{{ sample.side !== sample.origin ? '（越界落子）' : '' }}
        </li>
      </ol>
    </details>

    <p class="foot">
      草稿与发布分开保存：搜索未完成（unknown）或初盘三连时不会写入发布见证。{{ validating ? '校验中……' : '' }}
    </p>
  </section>
</template>

<style scoped>
.workshop { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 14px; display: grid; gap: 12px; }
.workshop-head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: start; }
.workshop-head h2 { margin: 0; font-size: 17px; }
.workshop-head h2 small { font: 11px var(--mono); color: var(--muted); margin-left: 8px; }
.workshop-head p { margin: 4px 0 0; font-size: 12px; color: var(--muted); max-width: 560px; line-height: 1.6; }
.head-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.card-pick { max-width: 190px; }
.frames { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.frame { background: #182025; border: 1px solid var(--line); border-radius: 6px; padding: 8px; display: grid; gap: 6px; }
.frame label { display: grid; grid-template-columns: 54px 1fr; align-items: center; font-size: 12px; color: var(--muted); gap: 6px; }
select { background: #202b2f; color: var(--ink); border: 1px solid var(--line); border-radius: 4px; padding: 4px 5px; font-size: 12px; }
.col-strip { list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; padding: 0; margin: 0; }
.col-strip li { font: 10px var(--mono); text-align: center; padding: 2px; border-radius: 3px; background: #2b363b; color: var(--muted); }
.col-strip li.a { background: #3d3428; color: #f3ca80; }
.col-strip li.b { background: #26343a; color: #a5d7e6; }
.play-area { display: grid; gap: 8px; }
.target-field { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.target-field input { width: 64px; background: #202b2f; color: var(--ink); border: 1px solid var(--line); border-radius: 4px; padding: 4px 6px; font: 12px var(--mono); }
.play-bar { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--muted); min-height: 18px; }
.play-bar .good { color: #8ee2b2; }
.play-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.hint { font-size: 11px; color: var(--muted); line-height: 1.6; margin: 0; }
.evidence { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
.evidence summary { cursor: pointer; color: var(--amber); }
.evidence dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin: 8px 0; }
.evidence dt { color: var(--muted); font-size: 11px; }
.evidence dd { margin: 2px 0 0; font: 12px var(--mono); }
.moves, .samples { margin: 4px 0 0; padding-left: 16px; font: 12px var(--mono); }
.samples { color: #a5d7e6; }
.foot { font-size: 11px; color: var(--muted); margin: 0; }
@media(max-width: 690px) { .frames { grid-template-columns: 1fr; } }
</style>
