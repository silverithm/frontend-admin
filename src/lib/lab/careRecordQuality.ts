/**
 * 급여제공기록 "형식적 문구" 감지.
 *
 * 왜: 장기요양기관 평가는 "특이사항 없음", "지난주와 동일" 같은 기록을 서비스 제공 근거로 인정하지 않는다.
 * 직원은 바쁠 때 이런 문구로 칸을 메우므로, 저장 전에 어디가 비어 있는지 짚어 준다.
 * 이 목록은 공개된 평가 안내를 바탕으로 한 보수적 규칙이다 — 거짓 경고보다 놓침이 더 아프지만,
 * 내용이 있는 문장(예: "혈압 130/80 이상 없음")까지 막으면 직원이 경고를 무시하게 되므로 숫자가 있는 문장은 봐준다.
 */

export type CareTextField =
  | 'physical'
  | 'cognitive'
  | 'meal'
  | 'toilet'
  | 'bath'
  | 'nursing'
  | 'training'
  | 'specialNote'
  | 'rawNote';

export const CARE_TEXT_FIELDS: readonly CareTextField[] = [
  'physical',
  'cognitive',
  'meal',
  'toilet',
  'bath',
  'nursing',
  'training',
  'specialNote',
  'rawNote',
];

export const CARE_FIELD_LABELS: Readonly<Record<CareTextField, string>> = {
  physical: '신체활동지원',
  cognitive: '인지활동지원',
  meal: '식사',
  toilet: '화장실 이용',
  bath: '목욕·청결',
  nursing: '간호·처치',
  training: '기능회복훈련',
  specialNote: '특이사항',
  rawNote: '메모 원문',
};

export interface VaguePhrase {
  field: string;
  phrase: string;
  hint: string;
}

export type CareRecordFields = Partial<Record<string, string | null | undefined>>;

const HINT_NO_ISSUE =
  '"없음"만 적으면 무엇을 살폈는지 알 수 없어 평가에서 형식적 기록으로 봅니다. 확인한 내용(예: 식사량, 표정, 보행 상태)을 한 줄 적어 주세요.';
const HINT_SAME_AS_BEFORE =
  '이전 기록과 같다고만 적으면 그날 실제로 제공했다는 근거가 되지 않습니다. 그날 한 일과 어르신 반응을 따로 적어 주세요.';
const HINT_USUAL =
  '"평소와 같음"은 기준이 없어 확인할 수 없습니다. 평소와 비교해 무엇이 같았는지(양, 횟수, 상태)를 적어 주세요.';
const HINT_ADJECTIVE_ONLY =
  '"양호", "좋음"처럼 평가 말만 있으면 근거가 되지 않습니다. 그렇게 본 사실(식사량, 걸음 상태, 참여 모습)을 적어 주세요.';
const HINT_PARTICIPATE_ONLY =
  '"참여함"만으로는 무엇을 어떻게 했는지 알 수 없습니다. 활동 이름과 반응(집중 시간, 도움이 필요했던 점)을 적어 주세요.';

interface WholeRule {
  /** 띄어쓰기 없이 쓴 기준 문구. 없음·같음은 아래에서 여러 어미로 풀어 준다. */
  bases: string[];
  hint: string;
}

// 문장 전체가 이 문구뿐일 때만 잡는다(예: "양호함", "특이사항 없음", "지난주와 동일").
const WHOLE_RULES: WholeRule[] = [
  {
    hint: HINT_NO_ISSUE,
    bases: [
      '특이사항없음', '특이사항없슴', '특이없음', '특이점없음', '특별한사항없음', '특별한변화없음', '특별사항없음',
      '별다른사항없음', '별다른변화없음', '이상없음', '이상무', '변화없음', '변동없음', '문제없음', '별일없음',
      '별무', '해당없음', '없음', '무',
    ],
  },
  {
    hint: HINT_SAME_AS_BEFORE,
    bases: [
      '지난주와동일', '지난주와같음', '지난주와똑같음', '저번주와동일', '저번주와같음', '전주와동일', '전주와같음',
      '지난달과동일', '지난달과같음', '전일과동일', '전일과같음', '어제와동일', '어제와같음', '이전과동일', '이전과같음',
      '전과동일', '전과같음', '지난번과동일', '지난번과같음', '상동', '상기와같음', '위와같음', '동일', '같음', '똑같음',
    ],
  },
  {
    hint: HINT_USUAL,
    bases: ['평소와같음', '평소와동일', '평소와비슷', '평소대로', '평소같음', '평상시와같음', '평상시와동일', '평상시대로', '여전함', '변함없음'],
  },
  {
    hint: HINT_ADJECTIVE_ONLY,
    bases: ['양호', '좋음', '보통', '무난', '안정적', '안정', '정상', '적절', '원활', '괜찮음', '잘지냄', '잘드심', '잘함', '무리없음'],
  },
  {
    hint: HINT_PARTICIPATE_ONLY,
    bases: ['참여', '잘참여', '활동', '프로그램참여', '프로그램활동', '프로그램진행', '진행', '실시', '제공'],
  },
];

const ENDINGS = '(?:입니다|합니다|하다|함|임|이다|했음|하였음|하였습니다|했습니다)?';

/** 없음·같음·동일을 어미 변형까지 한 규칙으로 푼다("없슴", "없습니다", "같습니다" 등). */
function toSource(base: string): string {
  return base
    .replace(/없음$/, '(?:없음|없슴|없습니다|없었음|없었습니다)')
    .replace(/같음$/, '(?:같음|같습니다|같았음|같다)')
    .replace(/똑같음$/, '(?:똑같음|똑같습니다)');
}

// "금일 특이사항 없음", "식사 양호함", "오늘도 동일"처럼 앞에 때·칸 이름만 붙인 경우도 같은 말이다.
// 칸 이름은 판단어 앞에서만 허용하고(참여·진행 같은 행동어 앞에는 붙이지 않는다) 혈압·체온처럼 측정 대상은 넣지 않는다.
const TIME_PREFIX = '(?:금일|오늘|오늘도|금일도|금번|이번|전반적으로|전체적으로|대체로|계속|여전히|역시)*';
const LABEL_PREFIX = '(?:(?:상태|컨디션|식사량|식사|배설|배변|배뇨|활동|건강|기분|전반적상태|기능|인지|목욕|위생)(?:는|은|도|이|가)?)?';

const WHOLE_MATCHERS: Array<{ re: RegExp; hint: string }> = WHOLE_RULES.map((r, i) => ({
  // 마지막 규칙(참여·진행 등 행동어)에는 칸 이름을 붙이지 않는다
  re: new RegExp(`^${TIME_PREFIX}${i === WHOLE_RULES.length - 1 ? '' : LABEL_PREFIX}(?:${r.bases.map(toSource).join('|')})${ENDINGS}$`),
  hint: r.hint,
}));

// 문장 중간에 끼어 있어도 의미가 없는 문구. 다른 내용이 있어도 이 문구 자체는 근거가 못 된다.
const INLINE_RULES: Array<{ re: RegExp; hint: string; skipIfDigits?: boolean }> = [
  { re: /특이\s*(?:사항|점)?\s*(?:은|이|가)?\s*(?:없(?:음|슴|습니다|었음|었습니다|다))/, hint: HINT_NO_ISSUE },
  { re: /특별\s*한\s*(?:사항|변화|점)\s*(?:은|이|가)?\s*없(?:음|슴|습니다|었음|었습니다|다)/, hint: HINT_NO_ISSUE },
  { re: /(?:지난\s*주|저번\s*주|전\s*주|지난\s*달|전\s*일|어제|이전|지난\s*번|전)\s*(?:과|와|랑|이랑)\s*(?:동일|같(?:음|습니다|았음|다|이)|똑같)/, hint: HINT_SAME_AS_BEFORE },
  { re: /상기\s*와\s*같(?:음|다|습니다)/, hint: HINT_SAME_AS_BEFORE },
  { re: /(?:^|\s)상동(?:\s|$)/, hint: HINT_SAME_AS_BEFORE },
  { re: /평소\s*(?:와|랑|처럼)\s*(?:같|동일|비슷)/, hint: HINT_USUAL },
  { re: /평(?:소|상시)\s*대로/, hint: HINT_USUAL },
  // 숫자·측정값이 함께 있으면("혈압 130/80 이상 없음") 구체적인 관찰이라 넘어간다.
  { re: /(?:이상|변화|변동)\s*(?:이|은|는)?\s*없(?:음|슴|습니다|었음|었습니다|다)/, hint: HINT_NO_ISSUE, skipIfDigits: true },
];

/** 쉼표·마침표·줄바꿈·가운뎃점·세미콜론으로 나눈다. 숫자 안의 점(3.5)과 슬래시(1/2)는 건드리지 않는다. */
function splitSegments(text: string): string[] {
  return text
    .split(/[\n\r;·•]+|[,.!?。]\s+|[,.!?。]$|\s\/\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 글자·숫자만 남긴다(공백·구두점·이모지 제거). */
function squash(segment: string): string {
  return segment.replace(/[^0-9A-Za-z가-힣]/g, '');
}

function wholeHint(segment: string): string | null {
  const key = squash(segment);
  if (!key) return null;
  for (const m of WHOLE_MATCHERS) if (m.re.test(key)) return m.hint;
  return null;
}

/** 모든 문장이 형식적 문구뿐이면 true. 빈 글은 false(비어 있는 것과 형식적인 것은 다른 문제). */
export function isVagueOnly(text: string | null | undefined): boolean {
  if (typeof text !== 'string') return false;
  const segments = splitSegments(text);
  if (segments.length === 0) return false;
  return segments.every((s) => wholeHint(s) !== null);
}

/**
 * 각 칸에서 형식적 문구를 찾아 돌려준다. 같은 칸에서 같은 문구는 한 번만.
 * `rawNote`(메모 원문)는 직원이 편하게 적는 곳이라 검사하지 않는다.
 */
export function findVaguePhrases(fields: CareRecordFields): VaguePhrase[] {
  const found: VaguePhrase[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (field === 'rawNote' || typeof value !== 'string') continue;
    const seen = new Set<string>();
    const push = (phrase: string, hint: string) => {
      const phraseText = phrase.trim().slice(0, 60);
      const key = squash(phraseText);
      if (!key || seen.has(key)) return;
      seen.add(key);
      found.push({ field, phrase: phraseText, hint });
    };
    for (const segment of splitSegments(value)) {
      const whole = wholeHint(segment);
      if (whole) {
        push(segment, whole);
        continue;
      }
      for (const rule of INLINE_RULES) {
        if (rule.skipIfDigits && /\d/.test(segment)) continue;
        const m = rule.re.exec(segment);
        if (m) push(m[0], rule.hint);
      }
    }
  }
  return found;
}

/** 칸이 모두 비어 있는가(공백만 있어도 비어 있는 것). */
export function isRecordEmpty(fields: CareRecordFields): boolean {
  return CARE_TEXT_FIELDS.every((f) => {
    const v = fields[f];
    return typeof v !== 'string' || v.trim() === '';
  });
}

export interface QualitySummary {
  total: number;
  /** 내용이 있는 기록 중 형식적 문구가 하나라도 있는 기록 수 */
  vague: number;
  empty: number;
  /** 형식적 문구가 없는 기록의 비율(0~100). 기록이 없으면 null */
  goodPercent: number | null;
}

/** 월간 기록 묶음의 품질을 한 줄로 요약한다 — 평가 준비 점검표의 자동 근거로 쓴다. */
export function summarizeQuality(records: ReadonlyArray<CareRecordFields>): QualitySummary {
  let vague = 0;
  let empty = 0;
  for (const r of records) {
    if (isRecordEmpty(r)) {
      empty += 1;
      continue;
    }
    if (findVaguePhrases(r).length > 0) vague += 1;
  }
  const filled = records.length - empty;
  return {
    total: records.length,
    vague,
    empty,
    goodPercent: filled === 0 ? null : Math.round(((filled - vague) / filled) * 100),
  };
}
