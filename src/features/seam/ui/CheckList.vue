<script setup lang="ts">
import { Check, CircleDashed, TriangleAlert } from 'lucide-vue-next';
import type { SeamValidation } from '../model/types';

defineProps<{ validation: SeamValidation }>();
</script>

<template>
  <section class="work-panel checks" aria-labelledby="checks-title">
    <h2 id="checks-title">发布校验</h2>
    <ul>
      <li v-for="check in validation.checks" :key="check.id" :class="{ ok: check.ok && !check.pending, bad: !check.ok && !check.pending, pending: check.pending }" :data-check="check.id">
        <Check v-if="check.ok && !check.pending" :size="14" aria-hidden="true" />
        <TriangleAlert v-else-if="!check.pending" :size="14" aria-hidden="true" />
        <CircleDashed v-else :size="14" aria-hidden="true" />
        <span>{{ check.detail }}</span>
      </li>
    </ul>
    <p class="verdict" :class="{ good: validation.publishable }">
      {{ validation.publishable ? '全部校验通过，可发布' : '仅可保存草稿' }}
    </p>
  </section>
</template>

<style scoped>
ul { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 5px; }
li { display: grid; grid-template-columns: 16px 1fr; gap: 6px; font-size: 12px; color: var(--muted); line-height: 1.5; }
li.ok svg { color: #8ee2b2; }
li.bad svg { color: #f48d89; }
li.pending svg { color: var(--amber); }
.verdict { font-size: 12px; margin: 9px 0 0; color: #f4b3ad; }
.verdict.good { color: #8ee2b2; }
</style>
