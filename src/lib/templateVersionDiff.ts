import type { FormFieldSchema, FormSchema } from '@/types/formSchema';

/**
 * 양식 버전 사이에 무엇이 바뀌었는지 짧게(2026-11-16 버전 기록).
 *
 * 구글 시트 버전 기록처럼 목록 한 줄마다 '추가: 시간, 업무내용 · 삭제: 행정 업무'를 보여 준다.
 * 숲속 업무일지 일은 '행정 업무'를 복제한 뒤 원본을 지운 것이었는데, 화면에서는 이름이 거의 같아
 * 무엇이 지워졌는지 알기 어려웠다 — 항목은 이름이 아니라 id로 비교해 '삭제: 행정 업무'로 드러낸다.
 */

export interface VersionShape {
  name: string;
  description?: string | null;
  category?: string | null;
  templateType?: string | null;
  formSchema?: string | FormSchema | null;
  defaultApprovalLine?: string | null;
  fileName?: string | null;
}

export interface VersionChange {
  /** '추가', '삭제', '이름 바꿈', '설정 바꿈', '순서 바꿈', '양식 이름', '분류', '설명', '기본 결재선', '파일', '종류' */
  kind: string;
  /** 그 변화에 해당하는 항목 이름들(이름 바꿈은 '옛 → 새') */
  items: string[];
}

export function parseVersionSchema(raw: VersionShape['formSchema']): FormSchema | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && Array.isArray((parsed as FormSchema).fields) ? (parsed as FormSchema) : null;
  } catch {
    return null;
  }
}

const fieldName = (f: FormFieldSchema) => (f.label?.trim() ? f.label.trim() : '이름 없는 항목');

/** 칸 설정 — 이름 말고 문서 모양이나 작성에 영향을 주는 것 */
function settingsKey(f: FormFieldSchema): string {
  return JSON.stringify([
    f.type,
    f.width ?? null,
    !!f.required,
    f.placeholder ?? null,
    (f.options ?? []).map((o) => o.label),
    (f.repeater?.fields ?? []).map((c) => [c.id, c.label, c.type]),
    f.computed ?? null,
    f.visibleWhen ?? null,
  ]);
}

function sameJson(a?: string | null, b?: string | null): boolean {
  if ((a ?? '') === (b ?? '')) return true;
  try {
    return JSON.stringify(JSON.parse(a ?? 'null')) === JSON.stringify(JSON.parse(b ?? 'null'));
  } catch {
    return false;
  }
}

/** [prev] → [next] 사이의 변화. prev가 없으면 빈 목록(처음 버전) */
export function diffVersions(prev: VersionShape | undefined, next: VersionShape): VersionChange[] {
  if (!prev) return [];
  const changes: VersionChange[] = [];

  if (prev.name !== next.name) changes.push({ kind: '양식 이름', items: [`${prev.name} → ${next.name}`] });
  if ((prev.category ?? '') !== (next.category ?? '')) {
    changes.push({ kind: '분류', items: [`${prev.category || '미분류'} → ${next.category || '미분류'}`] });
  }
  if ((prev.templateType ?? '') !== (next.templateType ?? '')) changes.push({ kind: '종류', items: [] });
  if ((prev.description ?? '') !== (next.description ?? '')) changes.push({ kind: '설명', items: [] });

  const before = parseVersionSchema(prev.formSchema)?.fields ?? [];
  const after = parseVersionSchema(next.formSchema)?.fields ?? [];
  const beforeById = new Map(before.map((f) => [f.id, f]));
  const afterById = new Map(after.map((f) => [f.id, f]));

  const added = after.filter((f) => !beforeById.has(f.id)).map(fieldName);
  const removed = before.filter((f) => !afterById.has(f.id)).map(fieldName);
  const renamed: string[] = [];
  const reset: string[] = [];
  for (const f of after) {
    const old = beforeById.get(f.id);
    if (!old) continue;
    if (fieldName(old) !== fieldName(f)) renamed.push(`${fieldName(old)} → ${fieldName(f)}`);
    else if (settingsKey(old) !== settingsKey(f)) reset.push(fieldName(f));
  }
  if (added.length) changes.push({ kind: '추가', items: added });
  if (removed.length) changes.push({ kind: '삭제', items: removed });
  if (renamed.length) changes.push({ kind: '이름 바꿈', items: renamed });
  if (reset.length) changes.push({ kind: '설정 바꿈', items: reset });

  // 남은 항목끼리 순서만 바뀌었는지
  const keptBefore = before.filter((f) => afterById.has(f.id)).map((f) => f.id);
  const keptAfter = after.filter((f) => beforeById.has(f.id)).map((f) => f.id);
  if (keptBefore.join('|') !== keptAfter.join('|')) changes.push({ kind: '순서 바꿈', items: [] });

  if (!sameJson(prev.defaultApprovalLine, next.defaultApprovalLine)) changes.push({ kind: '기본 결재선', items: [] });
  if ((prev.fileName ?? '') !== (next.fileName ?? '')) changes.push({ kind: '파일', items: [] });
  return changes;
}

/** 한 줄 요약 — '추가: 시간, 업무내용 · 삭제: 행정 업무'. 이름이 많으면 앞 [maxNames]개 + '외 n개' */
export function summarizeChanges(changes: VersionChange[], maxNames = 2): string {
  return changes
    .map(({ kind, items }) => {
      if (items.length === 0) return kind;
      const shown = items.slice(0, maxNames).join(', ');
      const more = items.length > maxNames ? ` 외 ${items.length - maxNames}개` : '';
      return `${kind}: ${shown}${more}`;
    })
    .join(' · ');
}
