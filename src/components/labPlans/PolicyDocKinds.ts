/** 규정·지침 대장의 종류·번호·슬롯(대장에 있어야 하는 칸) 이름. 규칙 숫자는 policyDocRules에 있다. */
import type { PolicyDoc, PolicyDocKind } from '@/lib/lab/labTypes';

export const KIND_LABEL: Readonly<Record<PolicyDocKind, string>> = {
  OPERATING_RULES: '운영규정',
  CARE_GUIDE: '급여제공지침',
  PRIVACY_POLICY: '개인정보 처리방침',
  INFECTION_PLAN: '감염병 대응계획',
  TRANSPORT_RULES: '이동서비스 수칙',
  GRIEVANCE_GUIDE: '고충처리지침',
  OTHER: '기타',
};

export const KIND_OPTIONS: ReadonlyArray<{ value: PolicyDocKind; label: string }> = (Object.keys(KIND_LABEL) as PolicyDocKind[]).map((value) => ({ value, label: KIND_LABEL[value] }));

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'];
export const GUIDE_NOS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const guideLabel = (no: number): string => `급여제공지침 ${CIRCLED[no - 1] ?? no}${no === 10 ? ' 개인정보보호지침' : ''}`;

/** 화면에 보일 이름 — 급여제공지침은 번호를 붙인다 */
export const kindName = (kind: PolicyDocKind, guideNo: number | null): string => (kind === 'CARE_GUIDE' && guideNo !== null ? guideLabel(guideNo) : KIND_LABEL[kind]);

export interface Slot {
  key: string;
  kind: PolicyDocKind;
  guideNo: number | null;
  name: string;
  /** 같은 종류가 하나만 허용되는 필수 칸 */
  fixed: boolean;
}

/** 대장에 있어야 하는 칸 — 운영규정, 급여제공지침 ①~⑫, 처리방침, 감염병 대응계획, 이동서비스 수칙, 고충처리지침 */
export const SLOTS: readonly Slot[] = [
  { key: 'OPERATING_RULES', kind: 'OPERATING_RULES', guideNo: null, name: KIND_LABEL.OPERATING_RULES, fixed: true },
  ...GUIDE_NOS.map((no): Slot => ({ key: `CARE_GUIDE-${no}`, kind: 'CARE_GUIDE', guideNo: no, name: guideLabel(no), fixed: true })),
  { key: 'PRIVACY_POLICY', kind: 'PRIVACY_POLICY', guideNo: null, name: KIND_LABEL.PRIVACY_POLICY, fixed: true },
  { key: 'INFECTION_PLAN', kind: 'INFECTION_PLAN', guideNo: null, name: KIND_LABEL.INFECTION_PLAN, fixed: true },
  { key: 'TRANSPORT_RULES', kind: 'TRANSPORT_RULES', guideNo: null, name: KIND_LABEL.TRANSPORT_RULES, fixed: true },
  { key: 'GRIEVANCE_GUIDE', kind: 'GRIEVANCE_GUIDE', guideNo: null, name: KIND_LABEL.GRIEVANCE_GUIDE, fixed: true },
];

export const slotKeyOf = (doc: Pick<PolicyDoc, 'kind' | 'guideNo'>): string => (doc.kind === 'CARE_GUIDE' ? `CARE_GUIDE-${doc.guideNo}` : doc.kind);

/** 같은 종류(+번호)의 문서가 이미 있는가 — 기타는 여러 개 허용 */
export const hasSameKind = (docs: readonly PolicyDoc[], kind: PolicyDocKind, guideNo: number | null, exceptId: number | null): boolean =>
  kind !== 'OTHER' && docs.some((d) => d.id !== exceptId && d.kind === kind && (kind !== 'CARE_GUIDE' || d.guideNo === guideNo));
