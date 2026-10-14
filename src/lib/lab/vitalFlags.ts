/**
 * 간호일지 바이탈 판정 — 값이 "눈여겨볼 범위"인지를 알려 주는 규칙이다. 진단이 아니다.
 * 기준은 PLAN 계약(규칙: 바이탈 판정)과 글자 그대로 같다. 한쪽만 고치면 화면 배지와 AI 요약의 근거가 어긋난다.
 *
 *  · 혈압  수축기 ≥160 또는 이완기 ≥100 → HIGH / 수축기 140~159 또는 이완기 90~99 → WATCH / 수축기 <90 → LOW
 *  · 맥박  <50 또는 >110 → WATCH (약 복용·운동 직후에 흔들려 HIGH·LOW로 나누지 않는다)
 *  · 체온  ≥37.8 → HIGH(발열) / 37.3~37.7 → WATCH / <35.5 → LOW
 *  · 혈당  <70 → LOW(저혈당) / ≥250 → HIGH / 180~249 → WATCH (식전·식후를 구분하지 못해 보수적으로 본다)
 *  · 체중  30일 안의 가장 가까운 이전 기록 대비 ±5% 이상 → WATCH (고령자의 급한 체중 변화는 부종·탈수·영양 문제의 신호)
 * 값이 없으면 판정하지 않는다. 문제가 없는 항목은 결과에 넣지 않는다.
 */
import type { VitalFlagMetric, VitalReading, VitalSeriesEntry } from './labTypes.ts';
import { parseYmd, seoulDateString } from './labDate.ts';

export type VitalLevel = 'HIGH' | 'WATCH' | 'LOW';

export interface VitalFlag {
  metric: VitalFlagMetric;
  level: VitalLevel;
  message: string;
}

/** 이전 체중 기록 */
export interface PreviousWeight {
  weight?: number | null;
  logDate?: string | null;
}

/** 기준값 — AI 프롬프트가 같은 숫자를 쓰도록 내보낸다. */
export const VITAL_THRESHOLDS = {
  systolicHigh: 160,
  systolicWatch: 140,
  systolicLow: 90,
  diastolicHigh: 100,
  diastolicWatch: 90,
  pulseLow: 50,
  pulseHigh: 110,
  tempHigh: 37.8,
  tempWatch: 37.3,
  tempLow: 35.5,
  sugarLow: 70,
  sugarHigh: 250,
  sugarWatch: 180,
  weightChangePercent: 5,
  weightWindowDays: 30,
} as const;

export const VITAL_METRIC_LABEL: Readonly<Record<VitalFlagMetric, string>> = {
  bloodPressure: '혈압',
  pulse: '맥박',
  temperature: '체온',
  bloodSugar: '혈당',
  weight: '체중',
};

export const VITAL_LEVEL_LABEL: Readonly<Record<VitalLevel, string>> = {
  HIGH: '높음',
  WATCH: '관찰',
  LOW: '낮음',
};

const LEVEL_RANK: Record<VitalLevel, number> = { HIGH: 3, LOW: 2, WATCH: 1 };

/** 유한한 숫자만 값으로 본다. 빈 칸(null·undefined)이나 NaN·문자열은 "값 없음". */
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** 날짜 사이 일수(b - a). 형식이 틀리면 null. */
export function daysBetween(a: string, b: string): number | null {
  const x = parseYmd(a);
  const y = parseYmd(b);
  if (!x || !y) return null;
  return Math.round((Date.UTC(y.year, y.month - 1, y.day) - Date.UTC(x.year, x.month - 1, x.day)) / 86_400_000);
}

function fixed(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function bloodPressureFlag(systolic: number | null, diastolic: number | null): VitalFlag | null {
  const T = VITAL_THRESHOLDS;
  if (systolic === null && diastolic === null) return null;
  // 수축기가 이완기보다 낮은 입력은 측정·입력 오류다(서버도 400). 판정하지 않는다.
  if (systolic !== null && diastolic !== null && systolic < diastolic) return null;
  const text = systolic !== null && diastolic !== null ? `${fixed(systolic)}/${fixed(diastolic)}` : systolic !== null ? `수축기 ${fixed(systolic)}` : `이완기 ${fixed(diastolic as number)}`;
  const high = (systolic !== null && systolic >= T.systolicHigh) || (diastolic !== null && diastolic >= T.diastolicHigh);
  if (high) return { metric: 'bloodPressure', level: 'HIGH', message: `혈압 ${text}mmHg로 높습니다. 안정 후 다시 재고, 계속 높으면 보호자·담당 의료진에게 알리는 것을 검토하세요.` };
  if (systolic !== null && systolic < T.systolicLow) return { metric: 'bloodPressure', level: 'LOW', message: `혈압 ${text}mmHg로 낮습니다. 어지럼·기운 없음을 살피고 다시 재어 보세요.` };
  const watch = (systolic !== null && systolic >= T.systolicWatch) || (diastolic !== null && diastolic >= T.diastolicWatch);
  if (watch) return { metric: 'bloodPressure', level: 'WATCH', message: `혈압 ${text}mmHg로 다소 높아 관찰이 필요합니다. 투약 여부와 측정 시점을 함께 기록하세요.` };
  return null;
}

function pulseFlag(pulse: number | null): VitalFlag | null {
  const T = VITAL_THRESHOLDS;
  if (pulse === null) return null;
  if (pulse < T.pulseLow) return { metric: 'pulse', level: 'WATCH', message: `맥박 ${fixed(pulse)}회/분으로 느립니다. 어지럼·호흡 이상이 없는지 살피고 다시 재어 보세요.` };
  if (pulse > T.pulseHigh) return { metric: 'pulse', level: 'WATCH', message: `맥박 ${fixed(pulse)}회/분으로 빠릅니다. 활동 직후였는지 확인하고 안정 후 다시 재어 보세요.` };
  return null;
}

function temperatureFlag(t: number | null): VitalFlag | null {
  const T = VITAL_THRESHOLDS;
  if (t === null) return null;
  if (t >= T.tempHigh) return { metric: 'temperature', level: 'HIGH', message: `체온 ${fixed(t)}℃로 발열입니다. 기침·설사 등 동반 증상을 확인하고 보호자에게 알리는 것을 검토하세요(감염 전파 주의).` };
  if (t >= T.tempWatch) return { metric: 'temperature', level: 'WATCH', message: `체온 ${fixed(t)}℃로 미열입니다. 시간을 두고 다시 재어 변화를 기록하세요.` };
  if (t < T.tempLow) return { metric: 'temperature', level: 'LOW', message: `체온 ${fixed(t)}℃로 낮습니다. 보온하고 다시 재어 보세요.` };
  return null;
}

function bloodSugarFlag(v: number | null): VitalFlag | null {
  const T = VITAL_THRESHOLDS;
  if (v === null) return null;
  if (v < T.sugarLow) return { metric: 'bloodSugar', level: 'LOW', message: `혈당 ${fixed(v)}mg/dL로 저혈당입니다. 식은땀·떨림·의식 상태를 확인하고 즉시 조치 후 보호자·의료진에게 알려야 합니다.` };
  if (v >= T.sugarHigh) return { metric: 'bloodSugar', level: 'HIGH', message: `혈당 ${fixed(v)}mg/dL로 높습니다. 식전·식후 여부를 기록하고 보호자·담당 의료진에게 알리는 것을 검토하세요.` };
  if (v >= T.sugarWatch) return { metric: 'bloodSugar', level: 'WATCH', message: `혈당 ${fixed(v)}mg/dL로 다소 높아 관찰이 필요합니다. 식전·식후 여부를 함께 기록하세요.` };
  return null;
}

/**
 * 체중 변화. previous는 30일 안의 "가장 가까운 이전 값"이어야 한다(고르는 일은 closestPreviousWeight).
 * 오늘 이후·오늘과 같은 날의 기록이거나 30일을 넘긴 기록이면 비교하지 않는다 — 오래된 값과의 차이는 변화 속도를 말해 주지 않는다.
 */
function weightFlag(weight: number | null, previous: PreviousWeight | undefined, today: string): VitalFlag | null {
  const T = VITAL_THRESHOLDS;
  const prev = num(previous?.weight);
  if (weight === null || prev === null || prev <= 0 || typeof previous?.logDate !== 'string') return null;
  const gap = daysBetween(previous.logDate, today);
  if (gap === null || gap < 1 || gap > T.weightWindowDays) return null;
  const diff = weight - prev;
  // 부동소수점 오차로 정확히 5%인 경우(50→52.5)를 놓치지 않도록 백분율 곱셈 비교에 아주 작은 여유를 둔다.
  if (Math.abs(diff) * 100 < prev * T.weightChangePercent - 1e-9) return null;
  const percent = (diff / prev) * 100;
  const sign = diff > 0 ? '+' : '-';
  const direction = diff > 0 ? '늘었습니다. 부종이나 식사량 변화를 확인하세요' : '줄었습니다. 식사량·탈수·삼킴 문제를 확인하세요';
  return {
    metric: 'weight',
    level: 'WATCH',
    message: `체중이 ${gap}일 전(${fixed(prev)}kg)보다 ${sign}${Math.abs(percent).toFixed(1)}%(${fixed(weight)}kg) ${direction}.`,
  };
}

/**
 * 한 번의 측정값을 판정한다. 문제가 있는 항목만 돌려주고, 한 항목은 한 줄만 낸다(혈압은 수축기·이완기를 함께 본다).
 * today(YYYY-MM-DD)가 없으면 한국 오늘. 체중 비교에만 쓰인다.
 */
export function evaluateVitals(reading: VitalReading, previous?: PreviousWeight, today?: string): VitalFlag[] {
  const flags: Array<VitalFlag | null> = [
    bloodPressureFlag(num(reading.systolic), num(reading.diastolic)),
    pulseFlag(num(reading.pulse)),
    temperatureFlag(num(reading.temperature)),
    bloodSugarFlag(num(reading.bloodSugar)),
    weightFlag(num(reading.weight), previous, today ?? seoulDateString()),
  ];
  return flags.filter((f): f is VitalFlag => f !== null);
}

/** 판정 중 가장 심한 단계(HIGH > LOW > WATCH). 판정이 없으면 null. */
export function worstVitalLevel(flags: ReadonlyArray<Pick<VitalFlag, 'level'>>): VitalLevel | null {
  let worst: VitalLevel | null = null;
  for (const f of flags) if (worst === null || LEVEL_RANK[f.level] > LEVEL_RANK[worst]) worst = f.level;
  return worst;
}

/**
 * 오늘 이전 기록 중 체중이 있는 가장 가까운 것을 30일 안에서 고른다(같은 날은 제외).
 * 어르신이 주 2~3회만 나오면 직전 기록이 며칠 전이라, "지난 기록"이 아니라 "30일 안의 가장 가까운 이전 값"을 쓴다.
 */
export function closestPreviousWeight(
  logs: ReadonlyArray<{ logDate?: string | null; weight?: number | null }>,
  today: string,
): { weight: number; logDate: string } | null {
  let best: { weight: number; logDate: string; gap: number } | null = null;
  for (const log of logs) {
    const weight = num(log.weight);
    if (weight === null || typeof log.logDate !== 'string') continue;
    const gap = daysBetween(log.logDate, today);
    if (gap === null || gap < 1 || gap > VITAL_THRESHOLDS.weightWindowDays) continue;
    if (best === null || gap < best.gap) best = { weight, logDate: log.logDate.slice(0, 10), gap };
  }
  return best ? { weight: best.weight, logDate: best.logDate } : null;
}

export interface VitalSeriesResult {
  date: string;
  flags: VitalFlag[];
}

/**
 * 날짜별 측정값 묶음을 날짜순으로 판정한다. 체중은 같은 묶음 안의 "30일 안 가장 가까운 이전 값"과 비교한다.
 * 날짜가 잘못된 줄은 건너뛴다. 같은 날짜가 둘이면 둘 다 판정하되 서로를 이전 값으로 쓰지는 않는다.
 */
export function evaluateVitalSeries(series: ReadonlyArray<VitalSeriesEntry>): VitalSeriesResult[] {
  const valid = series.filter((s) => parseYmd(s.date) !== null).map((s) => ({ ...s, date: s.date.slice(0, 10) }));
  valid.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return valid.map((entry) => {
    const earlier = valid.filter((o) => o.date < entry.date).map((o) => ({ logDate: o.date, weight: o.weight }));
    const previous = closestPreviousWeight(earlier, entry.date) ?? undefined;
    return { date: entry.date, flags: evaluateVitals(entry, previous, entry.date) };
  });
}
