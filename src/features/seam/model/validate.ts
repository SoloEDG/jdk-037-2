import { COLORS, type Color, type Shape } from '../../../shared/board';
import { COLUMN_ROWS } from '../lib/columns';
import { buildBoard } from '../lib/columns';
import { matchingGroups } from '../../board/lib/matching';
import { runPlan } from '../lib/simulate';
import { searchSlice, searchWitness, type SliceVerdict } from '../lib/search';
import type { Capture, ColumnSpec, Frame, SeamCard, SeamCheck, SeamValidation } from './types';
import { captureFromLevel } from './captures';
import { SLICE_SHAPE } from './types';

export const COMBINED_SHAPE: Shape = { width: 8, height: 8 };
export const SEAM_COLUMN = 4;

export interface ValidateLimits {
  witnessNodes?: number;
  witnessDeadline?: number;
  sliceNodes?: number;
  sliceDeadline?: number;
}

const defaults: Required<ValidateLimits> = {
  witnessNodes: 200000,
  witnessDeadline: 8000,
  sliceNodes: 150000,
  sliceDeadline: 6000,
};

/** 从关卡编号重建一次“真实对局”的稳定盘捕获。 */
export function captureFor(id: string): Capture | null {
  const match = /^L(\d+)-(\d+)$/.exec(id);
  if (!match) return null;
  const level = Number(match[1]);
  const seed = Number(match[2]);
  const capture = captureFromLevel(level);
  return capture && capture.seed === seed ? capture : null;
}

/** 捕获中连续四列对应的列规格（来珠由作者另行排定）。origin 表示该帧属于片段 A(0) 还是 B(1)。 */
export function framedColumns(capture: Capture, frame: Frame, origin: number): ColumnSpec[] {
  return Array.from({ length: 4 }, (_, local) => {
    const x = frame.offset + local;
    const cells = Array.from({ length: COLUMN_ROWS }, (_, y) => {
      const cell = capture.cells[y * 8 + x];
      return cell ? { ...cell } : null;
    });
    return {
      cells,
      armor: Array.from({ length: COLUMN_ROWS }, (_, y) => capture.armor[y * 8 + x] ?? 0),
      queue: [],
      origin,
    };
  });
}

const colorSet = new Set<string>(COLORS);
export const isColor = (value: unknown): value is Color => typeof value === 'string' && colorSet.has(value);

/**
 * 同列同序：片盘按全局列键读取的来珠序列，必须与合盘同列逐颗一致
 * （颜色与 id 都相同）。这保证两盘使用“同一列的同一来珠顺序”。
 */
export function sharedQueueOrder(columns: ColumnSpec[]) {
  if (columns.length !== 8) return { ok: false, detail: '合盘必须由八列组成' };
  for (const [side, width] of [[0, 4], [1, 4]] as const) {
    const start = side * SEAM_COLUMN;
    const slice = buildBoard(columns, start, width, SLICE_SHAPE).feed;
    const combined = buildBoard(columns, 0, COMBINED_SHAPE.width, COMBINED_SHAPE).feed;
    for (let x = 0; x < width; x++) {
      const key = start + x;
      const queue = columns[key].queue;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const fromSlice = slice.spawn(x);
        const fromCombined = combined.spawn(key);
        if (!fromSlice || !fromCombined) return { ok: false, detail: `第 ${key + 1} 列来珠不足` };
        if (fromSlice.id !== fromCombined.id || fromSlice.color !== fromCombined.color) {
          return { ok: false, detail: `第 ${key + 1} 列来珠顺序在两盘间不一致` };
        }
      }
      for (const piece of [slice.spawn(x), combined.spawn(key)]) {
        if (piece) return { ok: false, detail: `第 ${key + 1} 列超出排定来珠` };
      }
    }
  }
  return { ok: columns.every(column => column.queue.length > 0), detail: '两片盘与合盘按全局列键读取同一有限来珠顺序' };
}

function sameCells(left: ColumnSpec['cells'], right: ColumnSpec['cells']) {
  return left.length === right.length && left.every((cell, index) => {
    const other = right[index];
    if (!cell || !other) return !cell && !other;
    return cell.color === other.color && cell.special === other.special;
  });
}

export function validateCard(card: SeamCard, limits: ValidateLimits = {}): SeamValidation {
  const guard = { ...defaults, ...limits };
  const notes: string[] = [];
  const checks: SeamCheck[] = [];
  const push = (id: string, ok: boolean, detail: string, pending = false) => checks.push({ id, ok, detail, pending });

  // 1. 双帧：来自两次真实对局，各取连续四列，且两帧互不相同。
  const frames = card.frames ?? [];
  const captureA = frames[0] ? captureFor(frames[0].captureId) : null;
  const captureB = frames[1] ? captureFor(frames[1].captureId) : null;
  const frameShapeOk = frames.length === 2 && frames.every(frame => Number.isSafeInteger(frame.offset) && frame.offset >= 0 && frame.offset <= 4);
  const distinct = frames.length === 2 && (frames[0].captureId !== frames[1].captureId || frames[0].offset !== frames[1].offset);
  push('frames', !!captureA && !!captureB && frameShapeOk && distinct,
    !captureA || !captureB ? '两帧必须指向真实对局的稳定盘'
      : !frameShapeOk ? '每帧需框出四列（起始列 0–4）'
      : !distinct ? '两帧不能是同一片区域'
      : `${captureA.label} 第 ${frames[0].offset + 1}–${frames[0].offset + 4} 列 · ${captureB.label} 第 ${frames[1].offset + 1}–${frames[1].offset + 4} 列`);

  // 2. 列内容必须与捕获一致（霜层、特消、晶石均取稳定盘）。
  const expected = captureA && captureB && frameShapeOk
    ? [...framedColumns(captureA, frames[0], 0), ...framedColumns(captureB, frames[1], 1)]
    : [];
  const columns = card.columns;
  const columnsMatch = expected.length === 8 && columns.length === 8 && expected.every((column, index) => sameCells(column.cells, columns[index].cells) && column.armor.join() === columns[index].armor.join());
  push('capture-match', columnsMatch, columnsMatch ? '八列晶石、特消与霜层均取自两盘稳定捕获' : '列内容与所选捕获不一致，需重新框取');

  const mappingOk = columns.length === 8 && columns.every((column, index) => column.origin === (index < SEAM_COLUMN ? 0 : 1));
  push('mapping', mappingOk, mappingOk ? '左四列来自片段 A，右四列来自片段 B' : '列的片段归属有误');

  // 3. 每列必须排定有限来珠。
  const queueOk = columns.length === 8 && columns.every(column => Array.isArray(column.queue) && column.queue.every(isColor));
  const finite = queueOk && columns.every(column => column.queue.length >= 1);
  push('queues', finite, !queueOk ? '来珠顺序含非法颜色' : !finite ? '每列至少排定一颗来珠' : `有限来珠 ${columns.reduce((sum, column) => sum + column.queue.length, 0)} 颗，八列各自成序`);

  // 4. 同列同序：真正从片盘与合盘两处各建一个发珠器，逐颗比对外流的晶石 id 与颜色。
  const orderCheck = sharedQueueOrder(columns);
  push('shared-order', orderCheck.ok, orderCheck.detail);

  // 5. 片盘与合盘的初盘稳定性（初盘已三连 → 拦截发布）。
  const combinedBuilt = buildBoard(columns, 0, COMBINED_SHAPE.width, COMBINED_SHAPE);
  const combinedRuns = matchingGroups(combinedBuilt.grid, [], COMBINED_SHAPE).map(group => group.cells);
  push('combined-stable', combinedRuns.length === 0, combinedRuns.length ? `合盘初盘已有 ${combinedRuns.length} 处三连` : '合盘初盘无三连');

  const slices: [SliceVerdict, SliceVerdict] = [
    { status: 'unknown', max: 0, nodes: 0 },
    { status: 'unknown', max: 0, nodes: 0 },
  ];
  let slicesStable = true;
  for (const side of [0, 1] as const) {
    const start = side * SEAM_COLUMN;
    const built = buildBoard(columns, start, SLICE_SHAPE.width, SLICE_SHAPE);
    if (matchingGroups(built.grid, [], SLICE_SHAPE).length) slicesStable = false;
    slices[side] = searchSlice(columns, start, SLICE_SHAPE, card.target, card.budget, {
      maxNodes: guard.sliceNodes,
      deadline: Date.now() + guard.sliceDeadline,
    });
  }
  push('slices-stable', slicesStable, slicesStable ? '两片盘分别落盘后均无三连' : '存在初盘三连的片盘');

  const reachable = slices.map(slice => slice.status === 'reachable');
  const unknown = slices.some(slice => slice.status === 'unknown');
  push('slices-below-target',
    !reachable[0] && !reachable[1] && !unknown,
    reachable.some(Boolean)
      ? `片段 ${reachable[0] ? 'A' : 'B'} 单独已能在 ${card.budget} 步内达到目标`
      : unknown ? '片盘搜索尚未完成'
      : `单独成盘时四步内最多清霜 ${slices[0].max} / ${slices[1].max}，均低于目标 ${card.target}`,
    unknown);

  // 6. 合盘见证：同预算内、达到目标、且同一消除跨缝并各含一枚不同片段的原珠。
  const witnessStart = Date.now();
  const found = searchWitness(columns, COMBINED_SHAPE, SEAM_COLUMN, card.target, card.budget, {
    maxNodes: guard.witnessNodes,
    deadline: witnessStart + guard.witnessDeadline,
  });
  const witness = found.status === 'found' ? found.run : null;
  const witnessOk = !!witness && witness.armor >= card.target && !!witness.cross
    && witness.moves.length <= card.budget;
  push('witness', witnessOk,
    found.status === 'found'
      ? witnessOk
        ? `${witness.moves.length} 步内清霜 ${witness.armor}，跨缝见证 ${witness.cross?.signature ?? ''}`
        : '见证未同时满足目标与跨缝来源'
      : found.status === 'unknown' ? '合盘搜索尚未完成'
      : '未找到满足目标的跨缝见证',
    found.status === 'unknown');

  // 7. 见证可复现（若卡上已存见证，重放并要求签名一致）。
  let reproduced = true;
  let reproduceDetail = '尚未存盘见证，发布时写入';
  if (card.witness) {
    const replay = runPlan({ columns, start: 0, shape: COMBINED_SHAPE, moves: card.witness.moves, seam: SEAM_COLUMN });
    reproduced = !!replay.cross && replay.cross.signature === card.witness.signature && replay.armor >= card.target;
    reproduceDetail = reproduced
      ? `按见证重放复现跨缝贡献 ${replay.cross!.signature}`
      : '见证重放无法复现原跨缝贡献';
  }
  push('reproducible', reproduced, reproduceDetail);

  const stable = combinedRuns.length === 0;
  const publishable = checks.every(check => check.ok && !check.pending);
  if (!publishable) notes.push('存在未通过或未完成的校验：只能保存草稿');
  if (!stable) notes.push('初盘已经三连，发布被拦截');
  if (card.budget !== 4) notes.push('解题卡预算固定为四步');

  return {
    stable,
    stableRuns: combinedRuns,
    target: card.target,
    armor: {
      left: columns.slice(0, SEAM_COLUMN).reduce((sum, column) => sum + column.armor.reduce((a, b) => a + b, 0), 0),
      right: columns.slice(SEAM_COLUMN).reduce((sum, column) => sum + column.armor.reduce((a, b) => a + b, 0), 0),
      combined: columns.reduce((sum, column) => sum + column.armor.reduce((a, b) => a + b, 0), 0),
    },
    slices,
    witness: {
      status: found.status === 'found' ? 'found' : found.status === 'unknown' ? 'unknown' : 'none',
      value: witness ? {
        moves: witness.moves,
        budget: witness.moves.length,
        armor: witness.armor,
        waves: witness.waves,
        cross: witness.cross!,
        signature: witness.cross!.signature,
      } : null,
    },
    checks,
    publishable,
    draftOnly: !publishable,
    notes,
  };
}

export { COLUMN_ROWS };
