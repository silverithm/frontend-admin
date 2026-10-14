/**
 * 직원 법정 교육 연간 이수 점검.
 *
 * 장기요양기관은 종사자에게 노인학대 예방·성희롱 예방·감염 예방·안전·개인정보 보호 교육을 해마다 해야 하고,
 * 평가는 "교육일지에 참석자가 있는가"로 확인한다. 직원별로 다섯 범주를 모두 들었으면 이수(COMPLETE)다.
 * 회의(kind=MEETING)는 교육이 아니므로 참석해도 이수로 세지 않는다. 해가 바뀐 12/30 교육은 작년 것이다.
 */
import type { LegalTrainingCategory, LabStaff, MeetingCategory, StaffTraining, StaffTrainingCategory, StaffTrainingKind, TrainingCategory } from './labTypes.ts';
import { parseYmd } from './labDate.ts';

export const LEGAL_TRAINING_CATEGORIES: readonly LegalTrainingCategory[] = ['ELDER_ABUSE', 'SEXUAL_HARASSMENT', 'INFECTION', 'SAFETY', 'PRIVACY'];

export const TRAINING_CATEGORIES: readonly TrainingCategory[] = [...LEGAL_TRAINING_CATEGORIES, 'DISABILITY_AWARENESS', 'JOB', 'OTHER'];
export const MEETING_CATEGORIES: readonly MeetingCategory[] = ['CASE', 'STAFF', 'OTHER'];

export const TRAINING_CATEGORY_LABEL: Readonly<Record<StaffTrainingCategory, string>> = {
  ELDER_ABUSE: '노인학대 예방',
  SEXUAL_HARASSMENT: '성희롱 예방',
  INFECTION: '감염 예방·관리',
  SAFETY: '안전(응급·낙상·화재)',
  PRIVACY: '개인정보 보호',
  DISABILITY_AWARENESS: '장애 인식 개선',
  JOB: '직무 교육',
  CASE: '사례 회의',
  STAFF: '직원 회의',
  OTHER: '기타',
};

export const TRAINING_KIND_LABEL: Readonly<Record<StaffTrainingKind, string>> = {
  TRAINING: '교육',
  MEETING: '회의',
};

/** 교육 범주 이름. 모르는 값은 그대로 돌려준다. */
export function trainingCategoryLabel(category: string): string {
  return Object.hasOwn(TRAINING_CATEGORY_LABEL, category) ? TRAINING_CATEGORY_LABEL[category as StaffTrainingCategory] : category;
}

/** kind에 맞는 범주 목록(서버는 맞지 않으면 400을 준다) */
export function categoriesForKind(kind: StaffTrainingKind): readonly StaffTrainingCategory[] {
  return kind === 'TRAINING' ? TRAINING_CATEGORIES : MEETING_CATEGORIES;
}

export function isCategoryForKind(kind: StaffTrainingKind, category: string): boolean {
  return (categoriesForKind(kind) as readonly string[]).includes(category);
}

export type TrainingLike = Pick<StaffTraining, 'kind' | 'category' | 'attendeeIds' | 'heldOn'>;

export interface StaffCoverage {
  staffId: number;
  staffName: string;
  done: LegalTrainingCategory[];
  missing: LegalTrainingCategory[];
  complete: boolean;
}

/**
 * 직원마다 법정 다섯 범주를 올해 들었는지 본다. 결과는 staff 순서 그대로(같은 id가 둘이면 처음 것만).
 * done·missing은 LEGAL_TRAINING_CATEGORIES 순서. 참석자 id 중복이나 다른 범주·다른 연도·회의는 영향을 주지 않는다.
 */
export function trainingCoverage(
  trainings: ReadonlyArray<TrainingLike>,
  staff: ReadonlyArray<Pick<LabStaff, 'id' | 'name'>>,
  year: number,
): StaffCoverage[] {
  // 직원 id → 올해 들은 법정 범주
  const heard = new Map<number, Set<LegalTrainingCategory>>();
  for (const t of trainings) {
    if (t?.kind !== 'TRAINING') continue;
    if (!(LEGAL_TRAINING_CATEGORIES as readonly string[]).includes(t.category)) continue;
    const held = parseYmd(t.heldOn);
    if (!held || held.year !== year) continue;
    for (const id of Array.isArray(t.attendeeIds) ? t.attendeeIds : []) {
      let set = heard.get(id);
      if (!set) {
        set = new Set();
        heard.set(id, set);
      }
      set.add(t.category as LegalTrainingCategory);
    }
  }

  const seen = new Set<number>();
  const out: StaffCoverage[] = [];
  for (const person of staff) {
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    const got = heard.get(person.id);
    const done = LEGAL_TRAINING_CATEGORIES.filter((c) => got?.has(c));
    const missing = LEGAL_TRAINING_CATEGORIES.filter((c) => !got?.has(c));
    out.push({ staffId: person.id, staffName: person.name, done, missing, complete: missing.length === 0 });
  }
  return out;
}

export interface CoverageSummary {
  total: number;
  complete: number;
  /** 이수 직원 비율(0~100, 반올림). 직원이 없으면 0 */
  percent: number;
  /** 범주별로 들은 직원 수 — 어느 교육이 가장 비었는지 */
  byCategory: Record<LegalTrainingCategory, number>;
}

export function summarizeCoverage(coverage: ReadonlyArray<StaffCoverage>): CoverageSummary {
  const byCategory = { ELDER_ABUSE: 0, SEXUAL_HARASSMENT: 0, INFECTION: 0, SAFETY: 0, PRIVACY: 0 } as Record<LegalTrainingCategory, number>;
  let complete = 0;
  for (const c of coverage) {
    if (c.complete) complete += 1;
    for (const d of c.done) byCategory[d] += 1;
  }
  return { total: coverage.length, complete, percent: coverage.length === 0 ? 0 : Math.round((complete / coverage.length) * 100), byCategory };
}
