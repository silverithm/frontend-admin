/**
 * 어르신 케어 정보의 표시 규칙 — enum 라벨과 요약 문자열을 한곳에 모은다.
 *
 * React를 부르지 않는 순수 모듈로 둔 이유: 표·다이얼로그·엑셀 파서가 같은 규칙을 쓰고,
 * node:test로 브라우저 없이 검증하기 위해서다. 여기 없는 라벨이 화면에 하드코딩되기 시작하면
 * 표와 상세가 서로 다른 말을 하게 된다.
 */

import type {
  CareGrade,
  CognitionLevel,
  DiaperType,
  ElderCareProfile,
  Gender,
  MealType,
} from '@/types/elderly';

export const CARE_GRADE_LABELS: Record<CareGrade, string> = {
  GRADE_1: '1등급',
  GRADE_2: '2등급',
  GRADE_3: '3등급',
  GRADE_4: '4등급',
  GRADE_5: '5등급',
  COGNITIVE_SUPPORT: '인지지원',
  NONE: '등급 없음',
};

export const DIAPER_LABELS: Record<DiaperType, string> = {
  NONE: '없음',
  PANTY: '팬티기저귀',
  PAD: '패드',
  BOTH: '팬티+패드',
};

export const COGNITION_LABELS: Record<CognitionLevel, string> = {
  NORMAL: '정상',
  MILD: '경도',
  MODERATE: '중등도',
  SEVERE: '중증',
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  REGULAR: '일반식',
  CHOPPED: '다진식',
  PORRIDGE: '죽',
  MIXED: '비빔식',
};

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: '남',
  FEMALE: '여',
};

/** 값이 없을 때 표에서 쓰는 표기 */
export const EMPTY_MARK = '—';

type MaybeProfile = ElderCareProfile | null | undefined;

/**
 * 투약을 한 줄로. "아침·저녁", 시간이 있으면 "아침(10시)·점심(14시)".
 * 아무 끼니도 없으면 "없음" — 빈 문자열로 두면 표에서 '모름'과 구분되지 않는다.
 */
export function formatMedication(profile: MaybeProfile): string {
  if (!profile) return '없음';
  const slots: [boolean | undefined, string, string | null | undefined][] = [
    [profile.medMorning, '아침', profile.medMorningTime],
    [profile.medLunch, '점심', profile.medLunchTime],
    [profile.medEvening, '저녁', profile.medEveningTime],
  ];
  const parts = slots
    .filter(([on]) => on === true)
    .map(([, label, time]) => {
      const t = (time || '').trim();
      return t ? `${label}(${t})` : label;
    });
  return parts.length > 0 ? parts.join('·') : '없음';
}

/**
 * 식사 제공 여부를 O/X로. "오전간식 X · 오후간식 O · 저녁 O"
 * 세 값은 기본 true라 undefined도 O로 본다 (서버 기본값과 같은 해석).
 */
export function formatMeals(profile: MaybeProfile): string {
  const mark = (v: boolean | undefined) => (v === false ? 'X' : 'O');
  return [
    `오전간식 ${mark(profile?.morningSnack)}`,
    `오후간식 ${mark(profile?.afternoonSnack)}`,
    `저녁 ${mark(profile?.dinner)}`,
  ].join(' · ');
}

/** 자리를 한 줄로. "1층 · TV 앞" / "1층" / "TV 앞" / 없으면 빈 문자열 */
export function formatSeat(profile: MaybeProfile): string {
  const parts: string[] = [];
  if (profile?.floor != null) parts.push(`${profile.floor}층`);
  const note = (profile?.seatNote || '').trim();
  if (note) parts.push(note);
  return parts.join(' · ');
}

/** "85세 · 여" / "85세" / "여" / 없으면 빈 문자열 */
export function formatAgeGender(profile: MaybeProfile): string {
  const parts: string[] = [];
  if (profile?.age != null) parts.push(`${profile.age}세`);
  if (profile?.gender) parts.push(GENDER_LABELS[profile.gender]);
  return parts.join(' · ');
}

/** 낙상·욕창·기저귀 등 위험 표시용 칩 목록 (표에서 Badge로 그린다) */
export function riskChips(profile: MaybeProfile): { label: string; tone: 'error' | 'warning' | 'neutral' }[] {
  if (!profile) return [];
  const chips: { label: string; tone: 'error' | 'warning' | 'neutral' }[] = [];
  if (profile.fallRisk) chips.push({ label: '낙상', tone: 'error' });
  if (profile.pressureSore) chips.push({ label: '욕창', tone: 'warning' });
  if (profile.diaperType && profile.diaperType !== 'NONE') {
    chips.push({
      label: profile.diaperIntermittent ? `${DIAPER_LABELS[profile.diaperType]}(간헐)` : DIAPER_LABELS[profile.diaperType],
      tone: 'neutral',
    });
  }
  return chips;
}

/** 주민번호에서 숫자만 남긴다 (하이픈·공백 허용) */
export function digitsOnly(raw: string | null | undefined): string {
  return (raw || '').replace(/\D/g, '');
}

/**
 * 입력 중 자동 하이픈 — 6자리를 넘어가는 순간 "-"를 끼우고 13자리에서 멈춘다.
 * 붙여넣기로 하이픈이 이미 있는 값이 들어와도 숫자만 다시 세므로 결과가 같다.
 */
export function formatResidentNumberInput(raw: string | null | undefined): string {
  const digits = digitsOnly(raw).slice(0, 13);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

/** 13자리를 다 채웠는지. 앞자리 유효성(월·일)까지는 서버가 본다. */
export function isValidResidentNumber(raw: string | null | undefined): boolean {
  return digitsOnly(raw).length === 13;
}

/** 화면에서 쓰는 마스킹 — 서버 마스킹본이 없을 때(방금 입력한 값) 같은 모양으로 보이게 한다 */
export function maskResidentNumber(raw: string | null | undefined): string {
  const digits = digitsOnly(raw);
  if (digits.length < 7) return '';
  return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
}

/**
 * 주민번호 뒷자리 첫 숫자로 생년월일을 파생한다 (서버와 같은 규칙).
 * 1·2=19xx, 3·4=20xx, 9·0=18xx. 판별 불가면 null.
 */
export function birthDateFromResidentNumber(raw: string | null | undefined): string | null {
  const d = digitsOnly(raw);
  if (d.length < 7) return null;
  // 5~8은 외국인등록번호다 — 서버가 그렇게 파생하므로 화면 자동채움도 같은 표를 써야 한다
  const century = { '1': 19, '2': 19, '5': 19, '6': 19, '3': 20, '4': 20, '7': 20, '8': 20, '9': 18, '0': 18 }[d[6]];
  if (!century) return null;
  const year = century * 100 + Number(d.slice(0, 2));
  const month = d.slice(2, 4);
  const day = d.slice(4, 6);
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${year}-${month}-${day}`;
}

/** 주민번호 뒷자리 첫 숫자로 성별을 파생한다 — 홀수가 남, 짝수가 여 (0은 여) */
export function genderFromResidentNumber(raw: string | null | undefined): Gender | null {
  const d = digitsOnly(raw);
  if (d.length < 7) return null;
  if (!/[0-9]/.test(d[6])) return null;
  return Number(d[6]) % 2 === 1 ? 'MALE' : 'FEMALE';
}
