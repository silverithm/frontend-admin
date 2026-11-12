/**
 * 케어포 8-2 근무일정표에 바로 올릴 수 있는 직원근무일정 엑셀
 *
 * 흐름
 *   1. 케어포 8-2 근무일정표 → 근무내용 공단연동 → [케어포➔공단] 엑셀파일로 받은
 *      `YYYY년 MM월_직원근무일정.xlsx`를 케어브이에 넣는다.
 *   2. 그 파일에서 직원별 성명·생년월일·근무기간·직종·평소 근무시간·근무 요일을 읽는다.
 *   3. 케어브이에서 승인된 휴무(휴무·연차·반차)를 얹어 같은 양식으로 원하는 달 파일을 만든다.
 *   4. 원장은 그 파일을 8-2 → 근무내용 공단연동 → [공단➔케어포] 엑셀파일로 올린다.
 *      케어포는 파일에 있는 직원의 그 달 근무일정을 지우고 파일 내용으로 다시 쓴다.
 *      직원은 성명+생년월일로 맞춘다. (공단 '근무내용일괄등록 > 종사자 업로드'와 같은 양식)
 *
 * 케어포가 실제로 내보낸 파일(2026년 11월, 직원 29명)에서 확인한 규칙
 *   - 1행 헤더 24칸, 2행 빈 행, 3행부터 직원 × 날짜 한 줄. 모든 칸이 텍스트다.
 *   - 생년월일 YYMMDD, 근무기간 'YYYY-MM-DD~YYYY-MM-DD'(재직 중이면 끝이 9999-12-31)
 *   - 직종 '11.요양보호사 1급'처럼 공단 번호가 붙은 이름
 *   - 근무시작·근무종료 HHMM, 주간휴식시·분. 운전원처럼 하루 두 번 나뉘면 근무시작2·근무종료2
 *   - 일하는 날  : 근무휴일상세여부 '근무' + 시간
 *   - 쉬는 날    : '근무' + 시간 빈칸 (일요일·휴무·근무기간 밖 모두)
 *   - 연차       : '휴가' + 휴가코드 01 + 휴가시간 8, 시간 빈칸
 *   - 반차       : '휴가' + 휴가코드 02 + 휴가시간 4, 시간 빈칸
 *   - 유급휴일대체: 공단연동으로 못 넣는다고 케어포가 안내한다. 케어브이에는 그 구분이 없어 다루지 않는다.
 *
 * 생년월일은 화면에도 서버에도 남기지 않는다. 브라우저에서 파일을 읽어 바로 새 파일로 옮길 뿐이다.
 *
 * 테스트: `node --test src/lib/careforWorkExcel.test.ts` — 파일 읽기(exceljs)와 해석을 갈라 둔 이유다.
 */

import { resolveVacationKind } from '../types/vacation.ts';

/**
 * 휴무 신청에서 쓰는 칸만. 서버 duration에는 타입에 없는 UNUSED도 오므로 문자열로 받는다
 * (VacationRequest를 그대로 넘길 수 있다)
 */
export interface CareforVacationInput {
  userName?: string | null;
  date?: string | null;
  status?: string | null;
  type?: string | null;
  /** 달력 API는 종류를 type 대신 vacationType으로 준다 */
  vacationType?: string | null;
  duration?: string | null;
}

/** 양식의 24칸 (순서 고정) */
export const CAREFOR_WORK_HEADERS = [
  '성명',
  '생년월일',
  '근무기간',
  '직종',
  '일자',
  '요일',
  '근무시작',
  '근무종료',
  '주간휴식시',
  '주간휴식분',
  '야간휴식시',
  '야간휴식분',
  '근무시작2',
  '근무종료2',
  '주간휴식시2',
  '주간휴식분2',
  '야간휴식시2',
  '야간휴식분2',
  '휴가코드',
  '휴가시간',
  '휴일근무시간',
  '근무상세구분',
  '근무상세내용',
  '근무휴일상세여부',
] as const;

/** 근무시작(G)부터 야간휴식분2(R)까지 12칸 — 하루 근무시간 한 묶음 */
const TIME_FIRST = CAREFOR_WORK_HEADERS.indexOf('근무시작');
const TIME_COUNT = 12;

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 케어포가 쓰는 휴가코드 — 실제 파일에서 확인한 두 가지만 쓴다 */
export const CAREFOR_LEAVE = {
  annual: { code: '01', hours: '8' },
  half: { code: '02', hours: '4' },
} as const;

/** 케어포 근무기간 한 줄 (재직 이력이 바뀌면 한 사람에게 둘 이상 생긴다) */
export interface CareforPeriod {
  /** 원문 그대로 ('2025-04-01~9999-12-31') */
  text: string;
  start: string;
  end: string;
  job: string;
}

/** 케어포 파일에서 읽은 직원 한 사람 — 성명+생년월일이 같으면 같은 사람이다 */
export interface CareforStaff {
  name: string;
  birth: string;
  /** 파일에 나온 순서 */
  periods: CareforPeriod[];
  /** 평소 근무시간 G~R 12칸. 견본 달에 하루도 일하지 않았으면 빈 배열 */
  times: string[];
  /** 견본 달에 일했거나 연차·반차를 쓴 요일 (0=일요일) */
  workWeekdays: number[];
  /** 견본 달에 일한 날 수 */
  workDays: number;
}

export interface CareforParseResult {
  staff: CareforStaff[];
}

const normalizeName = (value?: string | null) => (value || '').replace(/\s+/g, '');

const REQUIRED_HEADERS = ['성명', '생년월일', '근무기간', '직종', '일자', '요일', '근무시작', '근무종료', '근무휴일상세여부'];

/**
 * 케어포가 내보낸 직원근무일정 격자(1행 헤더)를 직원별 근무 정보로 바꾼다.
 * 파일이 다른 양식이면 이유를 담아 throw한다.
 */
export function parseCareforWorkGrid(grid: string[][]): CareforParseResult {
  const header = (grid[0] || []).map((cell) => (cell || '').replace(/\s+/g, ''));
  const missing = REQUIRED_HEADERS.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    throw new Error(
      `케어포 8-2에서 받은 직원근무일정 파일이 아닙니다. (${missing.join('·')} 칸이 없어요)`,
    );
  }
  const col = (name: string) => header.indexOf(name);
  const timeCols = CAREFOR_WORK_HEADERS.slice(TIME_FIRST, TIME_FIRST + TIME_COUNT).map((name) => col(name));
  const cell = (row: string[], index: number) => (index >= 0 ? (row[index] || '').trim() : '');

  interface Person {
    staff: CareforStaff;
    timeCounts: Map<string, { times: string[]; count: number }>;
    weekdays: Set<number>;
  }
  const people = new Map<string, Person>();

  grid.slice(1).forEach((row) => {
    const name = cell(row, col('성명'));
    if (!name) return;
    const birth = cell(row, col('생년월일'));
    const key = `${normalizeName(name)}\u0000${birth}`;

    let person = people.get(key);
    if (!person) {
      person = {
        staff: { name, birth, periods: [], times: [], workWeekdays: [], workDays: 0 },
        timeCounts: new Map(),
        weekdays: new Set(),
      };
      people.set(key, person);
    }

    const text = cell(row, col('근무기간'));
    const job = cell(row, col('직종'));
    if (!person.staff.periods.some((p) => p.text === text && p.job === job)) {
      const [start = '', end = ''] = text.split('~').map((part) => part.trim());
      person.staff.periods.push({ text, start, end, job });
    }

    const times = timeCols.map((index) => cell(row, index));
    const weekday = WEEKDAY_LABELS.indexOf(cell(row, col('요일')));
    // 연차·반차는 원래 일하는 날에만 쓴다 — 그 요일은 근무 요일로 친다
    if (cell(row, col('근무휴일상세여부')) === '휴가' && weekday >= 0) person.weekdays.add(weekday);
    if (!times[0]) return; // 근무시작이 없으면 일하지 않은 날

    person.staff.workDays += 1;
    if (weekday >= 0) person.weekdays.add(weekday);
    const timeKey = times.join('|');
    const counted = person.timeCounts.get(timeKey);
    if (counted) counted.count += 1;
    else person.timeCounts.set(timeKey, { times, count: 1 });
  });

  const staff = [...people.values()].map(({ staff: s, timeCounts, weekdays }) => {
    // 가장 많이 쓴 시간 묶음이 평소 근무시간이다. 같으면 먼저 나온 쪽
    let best: string[] = [];
    let bestCount = 0;
    timeCounts.forEach((entry) => {
      if (entry.count > bestCount) {
        best = entry.times;
        bestCount = entry.count;
      }
    });
    return { ...s, times: [...best], workWeekdays: [...weekdays].sort((a, b) => a - b) };
  });

  return { staff };
}

/**
 * 그날 줄에 적을 근무기간. 케어포는 날짜마다 그날을 품는 근무기간 줄에 적고,
 * 둘 이상이 품으면 먼저 끝나는 쪽에 적는다 (11월 파일: 1~7일은 '~11-07', 8일부터는 '~9999-12-31').
 * 어느 기간에도 들지 않는 날은 가장 가까운 기간에 '근무'+빈 시간으로 적는다.
 */
export function periodForDate(periods: CareforPeriod[], date: string): { period: CareforPeriod; inPeriod: boolean } {
  const containing = periods
    .filter((p) => (!p.start || p.start <= date) && (!p.end || p.end >= date))
    .sort((a, b) => (a.end || '9999-12-31').localeCompare(b.end || '9999-12-31'));
  if (containing.length > 0) return { period: containing[0], inPeriod: true };

  const byEnd = [...periods].sort((a, b) => (a.end || '9999-12-31').localeCompare(b.end || '9999-12-31'));
  const before = byEnd.filter((p) => p.end && p.end < date);
  return { period: before.length > 0 ? before[before.length - 1] : byEnd[0], inPeriod: false };
}

export type CareforDayMark = 'annual' | 'half' | 'off';

/** 케어브이 휴무 한 건 → 케어포에 적을 표시. 화면에 보이는 종류와 같게 resolveVacationKind로 가른다 */
export const toCareforDayMark = (
  vacation: Pick<CareforVacationInput, 'type' | 'vacationType' | 'duration'>,
): CareforDayMark => {
  const kind = resolveVacationKind(vacation.type || vacation.vacationType || undefined, vacation.duration ?? undefined).value;
  if (kind === 'annual') return 'annual';
  if (kind === 'half_am' || kind === 'half_pm') return 'half';
  return 'off';
};

export interface BuildCareforWorkOptions {
  /** 만들 달 (그 달 1일~말일) */
  year: number;
  /** 0부터 (1월 = 0) */
  month: number;
  staff: CareforStaff[];
  /** 케어브이 직원 이름 — 케어포 파일과 이름이 같은 직원만 파일에 넣는다 */
  memberNames: string[];
  /** 그 달 휴무 신청. 승인된 건만 반영한다 */
  vacations: CareforVacationInput[];
}

export interface CareforStaffSummary {
  name: string;
  job: string;
  /** 평소 근무시간을 사람이 읽는 글로 ('08:20~17:20', '08:00~10:00 · 16:00~18:00') */
  usualTime: string;
  /** 쉬는 요일 ('일', '일·토') */
  offWeekdays: string;
  workDays: number;
  offDays: number;
  annualDays: number;
  halfDays: number;
}

export interface BuildCareforWorkResult {
  rows: string[][];
  staff: CareforStaffSummary[];
  /** 케어포 파일에는 있는데 케어브이에서 이름을 못 찾은 직원 — 파일에서 뺀다 (케어포 일정은 그대로 남는다) */
  careforOnly: string[];
  /** 케어브이에는 있는데 케어포 파일에 없는 직원 — 생년월일을 몰라 넣을 수 없다 */
  carevOnly: string[];
  /** 케어포에 같은 이름이 둘 이상(생년월일이 다름) — 누구 휴무인지 알 수 없어 뺀다 */
  sameName: string[];
  /** 일요일·평소 안 나오는 요일에 잡힌 연차·반차 — 케어포 연차를 깎지 않도록 넣지 않는다 */
  leaveOnRestDays: { name: string; date: string }[];
}

const pad2 = (value: number) => String(value).padStart(2, '0');
const hhmm = (value: string) => (/^\d{4}$/.test(value) ? `${value.slice(0, 2)}:${value.slice(2)}` : value);

/** 평소 근무시간 12칸 → '08:20~17:20' (두 번 나뉘면 ' · '로 잇는다) */
export const describeTimes = (times: string[]): string => {
  if (!times[0]) return '근무 기록 없음';
  const first = `${hhmm(times[0])}~${hhmm(times[1])}`;
  return times[6] ? `${first} · ${hhmm(times[6])}~${hhmm(times[7])}` : first;
};

/**
 * 케어포 파일에서 읽은 직원 정보 + 케어브이 휴무 → 케어포에 올릴 격자(1행 헤더, 2행 빈 행).
 *
 * 하루를 정하는 순서
 *   1. 근무기간 밖           → '근무', 시간 빈칸
 *   2. 일요일·평소 안 나오는 요일 → '근무', 시간 빈칸 (여기 잡힌 연차·반차는 넣지 않고 알린다)
 *   3. 승인된 연차           → '휴가' 01 / 8
 *   4. 승인된 반차           → '휴가' 02 / 4
 *   5. 승인된 휴무(대체 포함) → '근무', 시간 빈칸
 *   6. 그 밖                 → '근무' + 평소 근무시간
 */
export function buildCareforWorkRows({
  year,
  month,
  staff,
  memberNames,
  vacations,
}: BuildCareforWorkOptions): BuildCareforWorkResult {
  const carevNames = new Map(memberNames.map((name) => [normalizeName(name), name.trim()] as const));
  carevNames.delete('');

  const dayCount = new Date(year, month + 1, 0).getDate();
  const monthStart = `${year}-${pad2(month + 1)}-01`;
  const monthEnd = `${year}-${pad2(month + 1)}-${pad2(dayCount)}`;

  const marks = new Map<string, CareforDayMark>();
  vacations.forEach((vacation) => {
    if ((vacation.status || '').toLowerCase() !== 'approved') return;
    const name = normalizeName(vacation.userName);
    if (!name || !vacation.date) return;
    marks.set(`${name}|${vacation.date}`, toCareforDayMark(vacation));
  });

  // 그 달과 근무기간이 하나라도 겹치는 사람만 다룬다
  const active = staff.filter((s) =>
    s.periods.some((p) => (!p.start || p.start <= monthEnd) && (!p.end || p.end >= monthStart)),
  );
  const nameCount = new Map<string, number>();
  active.forEach((s) => nameCount.set(normalizeName(s.name), (nameCount.get(normalizeName(s.name)) || 0) + 1));

  const sameName = [...new Set(
    active.filter((s) => (nameCount.get(normalizeName(s.name)) || 0) > 1).map((s) => s.name.trim()),
  )];
  const included = active.filter(
    (s) => carevNames.has(normalizeName(s.name)) && nameCount.get(normalizeName(s.name)) === 1,
  );
  const careforOnly = [...new Set(
    active.filter((s) => !carevNames.has(normalizeName(s.name))).map((s) => s.name.trim()),
  )];
  const fileNames = new Set(staff.map((s) => normalizeName(s.name)));
  const carevOnly = [...carevNames.entries()].filter(([key]) => !fileNames.has(key)).map(([, name]) => name);

  const rows: string[][] = [[...CAREFOR_WORK_HEADERS], CAREFOR_WORK_HEADERS.map(() => '')];
  const summaries: CareforStaffSummary[] = [];
  const leaveOnRestDays: { name: string; date: string }[] = [];
  const blankTimes = Array.from({ length: TIME_COUNT }, () => '');

  included.forEach((s) => {
    const name = normalizeName(s.name);
    const latest = periodForDate(s.periods, monthEnd).period;
    const summary: CareforStaffSummary = {
      name: s.name.trim(),
      job: latest.job,
      usualTime: describeTimes(s.times),
      offWeekdays: WEEKDAY_LABELS.filter((_, weekday) => !s.workWeekdays.includes(weekday)).join('·') || '없음',
      workDays: 0,
      offDays: 0,
      annualDays: 0,
      halfDays: 0,
    };

    for (let day = 1; day <= dayCount; day += 1) {
      const date = `${year}-${pad2(month + 1)}-${pad2(day)}`;
      const weekday = new Date(year, month, day).getDay();
      const { period, inPeriod } = periodForDate(s.periods, date);
      const mark = inPeriod ? marks.get(`${name}|${date}`) : undefined;

      let times = blankTimes;
      let leaveCode = '';
      let leaveHours = '';
      let status = '근무';

      // 쉬는 날은 요일로만 가른다 — 견본 달에 근무시간 없이 연차만 있던 사람(휴직 등)의 연차도 살린다
      const restDay = weekday === 0 || !s.workWeekdays.includes(weekday);

      if (!inPeriod) {
        // 근무기간 밖 — 케어포도 '근무' + 빈 시간으로 내보낸다
      } else if (restDay) {
        if (mark === 'annual' || mark === 'half') leaveOnRestDays.push({ name: s.name.trim(), date });
      } else if (mark === 'annual') {
        status = '휴가';
        leaveCode = CAREFOR_LEAVE.annual.code;
        leaveHours = CAREFOR_LEAVE.annual.hours;
        summary.annualDays += 1;
      } else if (mark === 'half') {
        status = '휴가';
        leaveCode = CAREFOR_LEAVE.half.code;
        leaveHours = CAREFOR_LEAVE.half.hours;
        summary.halfDays += 1;
      } else if (mark === 'off') {
        summary.offDays += 1;
      } else if (s.times[0]) {
        times = s.times;
        summary.workDays += 1;
      }

      rows.push([
        s.name.trim(),
        s.birth,
        period.text,
        period.job,
        pad2(day),
        WEEKDAY_LABELS[weekday],
        ...times,
        leaveCode,
        leaveHours,
        '', // 휴일근무시간
        '', // 근무상세구분
        '', // 근무상세내용
        status,
      ]);
    }

    summaries.push(summary);
  });

  return { rows, staff: summaries, careforOnly, carevOnly, sameName, leaveOnRestDays };
}

export const buildCareforWorkFileName = (year: number, month: number) =>
  `${year}년 ${pad2(month + 1)}월_직원근무일정.xlsx`;

/** 셀 값을 문자열로 — 케어포 파일은 전부 텍스트지만 엑셀에서 손대면 숫자가 될 수 있다 */
function cellText(cell: { text?: unknown; value?: unknown }): string {
  try {
    if (typeof cell.text === 'string') return cell.text.trim();
  } catch {
    // 특수 셀에서 text 게터가 던지면 value로
  }
  const value = cell.value;
  if (value == null) return '';
  if (typeof value === 'object') {
    const v = value as { text?: unknown; result?: unknown; richText?: { text?: unknown }[] };
    if (typeof v.text === 'string') return v.text.trim();
    if (Array.isArray(v.richText)) return v.richText.map((r) => String(r.text ?? '')).join('').trim();
    if (v.result != null) return String(v.result).trim();
    return '';
  }
  return String(value).trim();
}

/** 올린 케어포 파일을 읽는다. 파일은 브라우저 안에서만 읽고 서버로 보내지 않는다 */
export async function readCareforWorkExcel(file: File): Promise<CareforParseResult> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('엑셀 파일을 읽을 수 없습니다. 케어포에서 받은 .xlsx 파일인지 확인해주세요.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('엑셀 파일에 시트가 없습니다.');

  const grid: string[][] = [];
  for (let r = 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= CAREFOR_WORK_HEADERS.length; c += 1) cells.push(cellText(row.getCell(c)));
    grid.push(cells);
  }
  return parseCareforWorkGrid(grid);
}

/** 격자를 케어포와 같은 서식(전 셀 텍스트·Arial 10pt)의 .xlsx로 만들어 내려받는다 */
export async function downloadCareforWorkExcel(rows: string[][], fileName: string): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  rows.forEach((row) => sheet.addRow(row));
  sheet.eachRow((row) => {
    row.height = 12.1;
    row.eachCell({ includeEmpty: true }, (c) => {
      c.numFmt = '@';
      c.font = { name: 'Arial', size: 10 };
    });
  });
  sheet.getColumn(1).width = 11.5;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
