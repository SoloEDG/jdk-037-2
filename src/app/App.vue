<script setup lang="ts">
import { Gem, Layers3, RotateCcw } from 'lucide-vue-next';
import { ref } from 'vue';
import { BoardView } from '../features/board';
import { GoalPanel, ResultDialog } from '../features/objectives';
import { StageList } from '../features/progress';
import { SeamWorkshop, useSeam } from '../features/seam';
import { SpecialGuide } from '../features/specials';
import { TurnReadout } from '../features/swap';
import { useSession } from './session';

const { levels, level, stage, records, grid, moves, tally, result, showResult, busy, hits, note, depth, combo,
  selected, start, select } = useSession();

const mode = ref<'play' | 'seam'>('seam');
const {
  store: seamStore, card: seamCard, save: saveSeam, updateStore: updateSeamStore,
  startCard: openSeamCard, newCard: newSeamCard, cards: seamCards, remember: rememberSeam,
  record: recordSeam, initialNotice,
} = useSeam();
const seamNotice = ref(initialNotice);
function notice(message: string) { seamNotice.value = message; }
</script>

<template>
  <header class="masthead">
    <div class="mast-inner">
      <div class="brand"><span class="brand-mark"><Gem :size="23" aria-hidden="true" /></span><span>晶矿连锁 <small>CRYSTAL SHIFT</small></span></div>
      <nav class="modes" aria-label="模式">
        <button type="button" class="plain" :class="{ active: mode === 'play' }" @click="mode = 'play'">矿区对局</button>
        <button type="button" class="plain" :class="{ active: mode === 'seam' }" @click="mode = 'seam'"><Layers3 :size="15" aria-hidden="true" />接缝解题卡</button>
      </nav>
      <button v-if="mode === 'play'" type="button" class="plain restart" :disabled="busy" @click="start()"><RotateCcw :size="16" aria-hidden="true" />重开本关</button>
    </div>
  </header>

  <main v-if="mode === 'play'" class="workspace">
    <header class="stage-header">
      <h1><span>{{ String(stage).padStart(2, '0') }}</span>{{ level.name }}</h1>
      <dl class="stats"><div><dt>剩余步数</dt><dd data-testid="moves">{{ moves }}</dd></div><div><dt>得分</dt><dd data-testid="score">{{ tally.score.toLocaleString('zh-CN') }}</dd></div></dl>
    </header>
    <div class="play-layout">
      <section class="play-area">
        <BoardView :grid="grid" :selected="selected" :hits="hits" :busy="busy || !!result" @select="select" />
        <TurnReadout :note="note" :depth="depth" :combo="combo" />
      </section>
      <aside>
        <GoalPanel :level="level" :tally="tally" />
        <StageList :levels="levels" :records="records" :selected="stage" :busy="busy" @choose="start" />
        <SpecialGuide />
      </aside>
    </div>
  </main>

  <main v-else class="workspace">
    <p v-if="seamNotice" class="seam-notice" role="status">{{ seamNotice }}</p>
    <SeamWorkshop
      :store="seamStore" :card="seamCard" :cards="seamCards"
      @update:card="saveSeam($event)" @update:store="updateSeamStore($event)" @notice="notice"
      @open="openSeamCard($event); notice('已切换到该解题卡')" @new="newSeamCard(); notice('已按示例新建草稿')"
      @remember="rememberSeam($event)" @record="recordSeam($event)"
    />
  </main>

  <ResultDialog v-if="result && showResult" :result="result" :next="result.won && stage < levels.length"
    @restart="start()" @advance="start(stage + 1)" @close="showResult = false" />
</template>

<style scoped>
.modes { display: flex; gap: 6px; margin-left: auto; margin-right: 8px; }
.modes .active { border-color: #8e7950; background: #3a3428; color: #ffe3a3; }
.seam-notice { margin: 0 0 10px; font-size: 12px; color: #8ee2b2; }
</style>
