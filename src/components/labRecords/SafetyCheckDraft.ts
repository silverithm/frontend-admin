/**
 * 점검표 작성 상태 — 서버의 점검 기록(항목 code·ok·note)을 화면의 "적합·부적합·해당 없음" 선택으로 옮긴다.
 * 서버에는 "해당 없음"이 따로 없고 ok가 true·false·null뿐이다. 그래서 해당 없음은 ok=null에 메모 머리말 "해당 없음"으로 남긴다
 * (적합·부적합 어느 쪽으로도 세지 않는다). 아직 안 본 항목은 ok=null에 그런 머리말이 없는 것이다.
 */
import type { SafetyCheck, SafetyCheckInput, SafetyItem, SafetyKind } from '@/lib/lab/labTypes';
import { MAX_SAFETY_ACTIONS, MAX_SAFETY_NOTE, templateFor } from '@/lib/lab/safetyRules';

export type Answer = 'ok' | 'fail' | 'na' | '';

export const NA_MARK = '해당 없음';

export interface ItemDraft {
  code: string;
  answer: Answer;
  note: string;
}

export interface SafetyDraft {
  items: ItemDraft[];
  /** 양식에 없는 옛 항목 — 지우지 않고 그대로 되돌려 저장한다 */
  extra: SafetyItem[];
  actions: string;
  /** 조치 내용이 AI 제안 그대로인가 */
  actionsAi: boolean;
  inspector: string;
  aiUsed: boolean;
}

function parseItem(item: SafetyItem | undefined, code: string): ItemDraft {
  if (!item) return { code, answer: '', note: '' };
  const note = typeof item.note === 'string' ? item.note : '';
  if (item.ok === true) return { code, answer: 'ok', note };
  if (item.ok === false) return { code, answer: 'fail', note };
  if (note === NA_MARK) return { code, answer: 'na', note: '' };
  if (note.startsWith(`${NA_MARK} · `)) return { code, answer: 'na', note: note.slice(NA_MARK.length + 3) };
  return { code, answer: '', note };
}

export function draftFromCheck(kind: SafetyKind, check: SafetyCheck | null, inspector: string): SafetyDraft {
  const template = templateFor(kind);
  const byCode = new Map((check?.items ?? []).map((i) => [i.code, i]));
  const known = new Set(template.items.map((i) => i.code));
  return {
    items: template.items.map((t) => parseItem(byCode.get(t.code), t.code)),
    extra: (check?.items ?? []).filter((i) => !known.has(i.code)),
    actions: check?.actions ?? '',
    actionsAi: false,
    inspector: check?.inspectorName ?? inspector,
    aiUsed: check?.aiAssisted ?? false,
  };
}

export function itemToServer(item: ItemDraft): SafetyItem {
  const note = item.note.trim();
  if (item.answer === 'ok') return { code: item.code, ok: true, note: note.slice(0, MAX_SAFETY_NOTE) };
  if (item.answer === 'fail') return { code: item.code, ok: false, note: note.slice(0, MAX_SAFETY_NOTE) };
  if (item.answer === 'na') return { code: item.code, ok: null, note: (note === '' ? NA_MARK : `${NA_MARK} · ${note}`).slice(0, MAX_SAFETY_NOTE) };
  return { code: item.code, ok: null, note: note.slice(0, MAX_SAFETY_NOTE) };
}

export function toInput(kind: SafetyKind, date: string, draft: SafetyDraft): SafetyCheckInput {
  const actions = draft.actions.trim();
  return {
    checkDate: date,
    kind,
    items: [...draft.items.map(itemToServer), ...draft.extra],
    actions: actions === '' ? null : actions.slice(0, MAX_SAFETY_ACTIONS),
    inspectorName: draft.inspector.trim() === '' ? null : draft.inspector.trim().slice(0, 50),
    aiAssisted: draft.aiUsed,
  };
}

export function snapshotOf(draft: SafetyDraft): string {
  return JSON.stringify([draft.items, draft.actions.trim(), draft.inspector.trim()]);
}

export function countOf(draft: SafetyDraft) {
  const c = { ok: 0, fail: 0, na: 0, unset: 0 };
  for (const i of draft.items) {
    if (i.answer === 'ok') c.ok += 1;
    else if (i.answer === 'fail') c.fail += 1;
    else if (i.answer === 'na') c.na += 1;
    else c.unset += 1;
  }
  return c;
}

export function validate(draft: SafetyDraft): string | null {
  const c = countOf(draft);
  if (c.ok + c.fail === 0) return '적합 또는 부적합으로 답한 항목이 하나도 없으면 점검한 것으로 세지 않습니다. 항목을 확인한 뒤 저장해 주세요';
  return null;
}
