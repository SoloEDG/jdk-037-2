<script setup lang="ts">
import { computed } from 'vue';
import { SIZE, type Color, type Grid } from '../../../shared/board';
import GemTile from '../../board/ui/GemTile.vue';

const props = defineProps<{
  grid: Grid;
  selected: number | null;
  hits: number[];
  disabled: boolean;
  /** 只有这些列可交互（片盘为连续四列，合盘为八列）。 */
  columns: number[];
  /** 高亮接缝右侧首列（合盘）。 */
  seamAt?: number;
  armor?: number[];
  width?: number;
}>();

const emit = defineEmits<{ select: [index: number] }>();
const names: Record<Color, string> = { ruby: '红', amber: '黄', emerald: '绿', sapphire: '蓝', violet: '紫' };
const width = computed(() => props.width ?? SIZE);
const hidden = computed(() => {
  const set = new Set(props.columns);
  return (index: number) => !set.has(index % SIZE);
});

function label(index: number) {
  const piece = props.grid.pieces[index];
  const armor = props.grid.armor[index];
  const x = index % SIZE;
  const y = Math.floor(index / SIZE);
  return `第 ${y + 1} 行第 ${x + 1} 列，${piece ? names[piece.color] + (piece.special ? '色特殊晶石' : '晶石') : '空格'}${armor ? '，' + armor + ' 层霜' : ''}`;
}

const seamEdge = (index: number) => props.seamAt !== undefined && index % SIZE === props.seamAt;
</script>

<template>
  <div class="seam-board" :style="{ '--cols': width }" data-testid="seam-board">
    <div
      v-for="(piece, index) in grid.pieces"
      :key="index" class="cell"
      :class="{ void: hidden(index), seam: seamEdge(index), hit: hits.includes(index), selected: selected === index }"
      :data-cell="index" :data-color="piece?.color" :data-armor="grid.armor[index]" :data-origin="piece?.origin"
      :data-born="piece?.born"
    >
      <button
        v-if="!hidden(index)" type="button" class="hitbox"
        :aria-label="label(index)" :aria-pressed="selected === index" :aria-disabled="disabled"
        :disabled="disabled" @click="emit('select', index)"
      >
        <GemTile v-if="piece" :key="piece.id" :piece="piece" />
        <span v-if="grid.armor[index]" class="armor" aria-hidden="true">{{ grid.armor[index] }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.seam-board { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: clamp(2px, .34vw, 4px); background: #141b1e; }
.cell { aspect-ratio: 1; position: relative; border-radius: 4px; }
.cell.void { background: transparent; border: 1px dashed #2a3438; opacity: .35; }
.hitbox { width: 100%; height: 100%; display: grid; place-items: center; border: 1px solid #354248; border-radius: 4px; background: #222e34; padding: 0; position: relative; }
.hitbox:disabled { cursor: default; }
.cell:nth-child(2n) .hitbox { background: #20292e; }
.cell.seam { box-shadow: inset 3px 0 0 #d7a45c; }
.cell.selected .hitbox { border-color: #f0c578; background: #454034; }
.cell.hit .hitbox { background: #f3cf74; border-color: #fff1bb; }
.cell.hit :deep(.gem) { opacity: .38; }
.armor { position: absolute; right: 1px; bottom: 1px; font: 10px var(--mono); color: #f2feff; line-height: 1; }
</style>
