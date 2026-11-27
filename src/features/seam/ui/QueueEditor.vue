<script setup lang="ts">
import { computed } from 'vue';
import { COLOR_NAME, PALETTE } from './editing';
import type { SeamCard } from '../model/types';

const props = defineProps<{ card: SeamCard }>();
const emit = defineEmits<{ change: [column: number, queue: import('../../../shared/board').Color[]] }>();

const sides = [
  { side: 0, label: '片段 A（左四列）', columns: [0, 1, 2, 3] },
  { side: 1, label: '片段 B（右四列）', columns: [4, 5, 6, 7] },
] as const;

const total = computed(() => props.card.columns.reduce((sum, column) => sum + column.queue.length, 0));

function add(column: number, color: import('../../../shared/board').Color) {
  const queue = props.card.columns[column].queue;
  if (queue.length >= 6) return;
  emit('change', column, [...queue, color]);
}

function remove(column: number, index: number) {
  const queue = props.card.columns[column].queue;
  emit('change', column, queue.filter((_, cursor) => cursor !== index));
}
</script>

<template>
  <section class="work-panel queue-panel" aria-labelledby="queue-title">
    <h2 id="queue-title">有限来珠 <small>共 {{ total }} 颗，逐列成序</small></h2>
    <p class="hint">每列来珠按序补入；片盘与合盘读取同一顺序。某列耗尽后该列留空，不再补珠。</p>
    <div v-for="group in sides" :key="group.side" class="side">
      <h3>{{ group.label }}</h3>
      <div class="queue-grid">
        <div v-for="column in group.columns" :key="column" class="queue" :data-column="column">
          <span class="col-tag">{{ String.fromCharCode(65 + column) }}</span>
          <ol class="chips">
            <li v-for="(color, index) in card.columns[column].queue" :key="index">
              <button type="button" class="chip" :class="color" :aria-label="`移除 ${COLOR_NAME[color]} 来珠`" @click="remove(column, index)">{{ COLOR_NAME[color] }}</button>
            </li>
            <li v-if="!card.columns[column].queue.length" class="empty">空</li>
          </ol>
          <div class="palette">
            <button
              v-for="color in PALETTE" :key="color" type="button" class="dot" :class="color"
              :aria-label="`为 ${String.fromCharCode(65 + column)} 列添加 ${COLOR_NAME[color]} 来珠`"
              :disabled="card.columns[column].queue.length >= 6" @click="add(column, color)"
            >
              <span>{{ COLOR_NAME[color] }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
h2 small { font: 11px var(--mono); color: var(--muted); margin-left: 6px; }
.hint { font-size: 11px; color: var(--muted); margin: 0 0 8px; line-height: 1.6; }
.side + .side { margin-top: 12px; }
h3 { font-size: 12px; margin: 8px 0 6px; color: var(--amber); font-weight: 600; }
.queue-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.queue { background: #1a2327; border: 1px solid var(--line); border-radius: 5px; padding: 6px; }
.col-tag { font: 10px var(--mono); color: var(--muted); }
.chips { list-style: none; display: flex; flex-wrap: wrap; gap: 3px; margin: 4px 0; padding: 0; min-height: 20px; }
.chip { font: 11px var(--mono); border-radius: 3px; border: 1px solid #00000033; padding: 1px 5px; color: #10161b; }
.empty { font-size: 11px; color: var(--muted); }
.palette { display: flex; gap: 3px; }
.dot { width: 17px; height: 17px; border-radius: 50%; border: 1px solid #00000044; padding: 0; }
.dot span { display: none; }
.dot:disabled { opacity: .3; }
.ruby { background: #ef716c; } .amber { background: #f6b957; } .emerald { background: #70d79d; } .sapphire { background: #56bce2; } .violet { background: #ca98e8; }
@media(max-width: 690px) { .queue-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
