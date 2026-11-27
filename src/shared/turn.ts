import type { Color, Grid, Special } from './board';

export interface Wave {
  depth: number;
  cleared: number[];
  colors: Color[];
  armorHits: number[];
  created: { index: number; special: Special }[];
  triggered: { index: number; special: Special }[];
  board: Grid;
  /** 本次消除中被清掉晶石的原 id 与来源（接缝卡见证用，普通回合可忽略）。 */
  provenance?: ClearTrace[];
}

/** 一枚被消除晶石的来源快照：来源片段、初盘/来珠、消除前格子。 */
export interface ClearTrace {
  id: number;
  origin: number;
  born: 'board' | 'queue';
  index: number;
  color: Color;
}

export type Turn =
  | { legal: false; swap: Grid }
  | { legal: true; swap: Grid; waves: Wave[]; final: Grid; reshuffled: boolean; combo: string | null };
