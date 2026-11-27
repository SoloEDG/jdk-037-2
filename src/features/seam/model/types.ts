import type { Color, Special } from '../../../shared/board';

export const SEAM_BUDGET = 4;
export const FRAME_WIDTH = 4;
export const SLICE_SHAPE = { width: 4, height: 8 } as const;

export interface CellSpec {
  color: Color;
  special?: Special;
}

/** 一次真实对局的稳定盘快照（8 列 × 8 行）。 */
export interface Capture {
  id: string;
  label: string;
  level: number;
  seed: number;
  moves: number;
  cells: (CellSpec | null)[];
  armor: number[];
}

/** 从一次对局里框出的连续四列。 */
export interface Frame {
  captureId: string;
  offset: number;
}

/** 合盘中的一列：初盘晶石、霜层，以及作者排定的有限来珠顺序。 */
export interface ColumnSpec {
  cells: (CellSpec | null)[];
  armor: number[];
  queue: Color[];
  /** 该列属于哪个片段（0 = 左片，1 = 右片）。 */
  origin: number;
}

export interface Move {
  from: number;
  to: number;
}

export interface OriginCount {
  origin: number;
  born: 'board' | 'queue';
  count: number;
}

export interface WaveEvidence {
  depth: number;
  armor: number;
  cleared: number;
  origins: OriginCount[];
  cross: boolean;
}

export interface CrossSample {
  origin: number;
  id: number;
  index: number;
  color: Color;
  /** 该原珠被消除时所在的半区（0 左 / 1 右），仅用于展示；来源仍以 origin 为准。 */
  side: number;
}

export interface CrossEvidence {
  wave: number;
  armor: number;
  samples: CrossSample[];
  signature: string;
}

export interface Witness {
  moves: Move[];
  budget: number;
  armor: number;
  waves: WaveEvidence[];
  cross: CrossEvidence;
  signature: string;
}

export type SeamStatus = 'draft' | 'published';

export interface SeamCard {
  version: 1;
  id: string;
  title: string;
  frames: [Frame, Frame];
  columns: ColumnSpec[];
  target: number;
  budget: number;
  status: SeamStatus;
  witness: Witness | null;
  createdAt: string;
  updatedAt: string;
}

export interface SliceVerdict {
  /** proven = 已穷尽且达不到目标；reachable = 单盘即可达标；unknown = 搜索未完成。 */
  status: 'proven' | 'reachable' | 'unknown';
  max: number;
  nodes: number;
}

export interface SeamCheck {
  id: string;
  ok: boolean;
  pending?: boolean;
  detail: string;
}

export interface SeamValidation {
  stable: boolean;
  stableRuns: number[][];
  target: number;
  armor: { left: number; right: number; combined: number };
  slices: [SliceVerdict, SliceVerdict];
  witness: { status: 'found' | 'none' | 'unknown'; value: Witness | null };
  checks: SeamCheck[];
  publishable: boolean;
  draftOnly: boolean;
  notes: string[];
}
