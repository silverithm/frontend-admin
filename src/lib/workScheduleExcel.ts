/**
 * 근무조정 근무표 → 직원근무일정 엑셀 내보내기
 *
 * 기존에 쓰던 `YYYY년 MM월_직원근무일정.xlsx` 양식을 그대로 재현한다.
 * - 시트명 Sheet1, 1행 헤더 24개, 2행은 빈 행, 3행부터 (직원 × 날짜) 한 줄
 * - 모든 셀은 텍스트 서식(@) / Arial 10pt
 * - 시스템에 없는 항목(생년월일·근무시간·휴게시간·휴가코드 등)은 빈 문자열로 둔다
 *
 * 휴무 판정: 일요일(정기 휴무) 또는 승인된 휴무 신청이 있는 날.
 * 토요일은 근무일이다.
 */

import { format, getDaysInMonth } from 'date-fns';
import type { VacationRequest } from '@/types/vacation';

// 양식의 24개 컬럼 (순서 고정)
export const WORK_SCHEDULE_HEADERS = [
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

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 일요일 인덱스 (Date#getDay 기준) */
const SUNDAY = 0;

/**
 * 기관 정기 휴무일 판정.
 * 일요일은 근무 편성과 무관하게 무조건 휴무다. (토요일은 근무일)
 */
const isRegularDayOff = (date: Date) => date.getDay() === SUNDAY;

export interface WorkScheduleMember {
  id?: string | number | null;
  name?: string | null;
  position?: string | null;
  role?: string | null;
}

export interface BuildWorkScheduleOptions {
  /** 내보낼 월 (해당 월의 1일~말일 전체가 행으로 생성된다) */
  targetMonth: Date;
  members: WorkScheduleMember[];
  /** 해당 월의 휴무 신청 목록. 이 중 승인된 건만 휴무로 반영된다. */
  vacations: VacationRequest[];
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 휴무 판정에 쓸 키: 이름 기준(휴무 레코드가 userName으로 저장됨) */
const normalizeName = (value?: string | null) => (value || '').trim();

/**
 * (직원명|날짜) → 휴무 레코드.
 * 승인된 휴무만 확정 휴무로 본다. 대기중/반려/취소 건은 아직 근무일이므로 반영하지 않는다.
 */
const buildVacationIndex = (vacations: VacationRequest[]) => {
  const index = new Map<string, VacationRequest>();

  vacations.forEach((vacation) => {
    if ((vacation.status || '').toLowerCase() !== 'approved') {
      return;
    }

    const name = normalizeName(vacation.userName);
    if (!name || !vacation.date) {
      return;
    }

    index.set(`${name}|${vacation.date}`, vacation);
  });

  return index;
};

/**
 * 양식 그대로의 2차원 문자열 배열을 만든다. (1행 헤더 + 2행 빈 행 + 데이터)
 * 값이 없는 칸은 원본 파일과 동일하게 빈 문자열로 채운다.
 */
export function buildWorkScheduleRows({
  targetMonth,
  members,
  vacations,
}: BuildWorkScheduleOptions): string[][] {
  const vacationIndex = buildVacationIndex(vacations);
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();
  const dayCount = getDaysInMonth(targetMonth);

  const rows: string[][] = [];

  // 1행: 헤더
  rows.push([...WORK_SCHEDULE_HEADERS]);
  // 2행: 원본 양식과 동일하게 빈 행
  rows.push(WORK_SCHEDULE_HEADERS.map(() => ''));

  members.forEach((member) => {
    const name = normalizeName(member.name);
    if (!name) {
      return;
    }

    // 직종: 시스템에는 코드 없이 직책명만 있어 그대로 내보낸다
    const jobTitle = (member.position || '').trim();

    for (let day = 1; day <= dayCount; day += 1) {
      const date = new Date(year, month, day);
      const dateKey = format(date, 'yyyy-MM-dd');
      const vacation = vacationIndex.get(`${name}|${dateKey}`);
      // 일요일은 정기 휴무이므로 휴무 신청 여부와 무관하게 휴무로 본다
      const dayOff = isRegularDayOff(date) || Boolean(vacation);

      rows.push([
        name,                                   // A 성명
        '',                                     // B 생년월일 (미보유)
        '',                                     // C 근무기간 (입퇴사일 미보유)
        jobTitle,                               // D 직종
        pad2(day),                              // E 일자
        WEEKDAY_LABELS[date.getDay()],          // F 요일
        '',                                     // G 근무시작 (근무시간 미보유)
        '',                                     // H 근무종료
        '',                                     // I 주간휴식시
        '',                                     // J 주간휴식분
        '',                                     // K 야간휴식시
        '',                                     // L 야간휴식분
        '',                                     // M 근무시작2
        '',                                     // N 근무종료2
        '',                                     // O 주간휴식시2
        '',                                     // P 주간휴식분2
        '',                                     // Q 야간휴식시2
        '',                                     // R 야간휴식분2
        '',                                     // S 휴가코드 (코드 체계 미보유)
        '',                                     // T 휴가시간
        '',                                     // U 휴일근무시간
        '',                                     // V 근무상세구분
        '',                                     // W 근무상세내용
        dayOff ? '휴무' : '근무',                // X 근무휴일상세여부
      ]);
    }
  });

  return rows;
}

export const buildWorkScheduleFileName = (targetMonth: Date) =>
  `${targetMonth.getFullYear()}년 ${pad2(targetMonth.getMonth() + 1)}월_직원근무일정.xlsx`;

/**
 * 엑셀 파일을 만들어 브라우저에서 내려받는다.
 * exceljs는 번들 크기가 커서 호출 시점에 동적 로드한다.
 */
export async function exportWorkScheduleExcel(options: BuildWorkScheduleOptions): Promise<number> {
  const rows = buildWorkScheduleRows(options);

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');

  rows.forEach((row) => {
    sheet.addRow(row);
  });

  // 원본 양식과 동일한 서식: 전 셀 텍스트(@) + Arial 10pt
  sheet.eachRow((row) => {
    row.height = 12.1;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.numFmt = '@';
      cell.font = { name: 'Arial', size: 10 };
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
  link.download = buildWorkScheduleFileName(options.targetMonth);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // 헤더 + 빈 행을 제외한 실제 데이터 행 수
  return Math.max(0, rows.length - 2);
}
