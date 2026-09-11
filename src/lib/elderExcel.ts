/**
 * 어르신 대량 등록 엑셀 — 양식 생성과 업로드 파일 파싱·검증.
 *
 * exceljs는 번들이 커서 호출 시점에 동적 로드한다 (workScheduleExcel과 같은 이유).
 * 서버에 보내기 전에 모든 행을 여기서 검증해, 어떤 행이 왜 제외되는지
 * 등록 전에 눈으로 확인하고 시작할 수 있게 한다 — 등록 도중에 터지는 오류를
 * 사전 검증 단계로 앞당기는 것이 이 파일의 존재 이유다.
 *
 * 파일 읽기(exceljs)와 행 해석을 일부러 갈라 놨다: 해석 규칙(parseElderRows)은
 * 문자열 격자만 받아 node:test로 검증하고, exceljs는 격자를 만드는 일만 한다.
 */

import type { ElderlyInfo, ElderCareProfileInput, CareGrade, DiaperType, CognitionLevel, MealType, Gender } from '@/types/elderly';
// 확장자까지 적는 이유: 이 규칙을 node:test가 번들러 없이 그대로 불러 검증한다
import { digitsOnly, isValidResidentNumber } from './elderCare.ts';

/** 한 번에 등록할 수 있는 최대 인원. 백엔드 bulk API와 같은 값이어야 한다. */
export const MAX_BULK_ELDERS = 500;

const NAME_MAX = 50;
const ADDRESS_MAX = 200;
const NOTE_MAX = 500;

const HEADER_NAME = ['이름', '성명'];
const HEADER_ADDRESS = ['주소', '자택주소', '집주소', '거주지'];

/**
 * 케어 열 별칭. 기관마다 쓰던 표가 달라 같은 뜻의 열 이름이 여러 개다 —
 * 양식을 새로 받지 않고 쓰던 파일을 그대로 올려도 읽히게 한다.
 * (헤더는 공백·괄호·별표를 지우고 비교한다)
 */
const CARE_HEADERS = {
  residentNumber: ['주민번호', '주민등록번호'],
  birthDate: ['생년월일', '생일'],
  gender: ['성별'],
  careGrade: ['등급', '장기요양등급', '요양등급'],
  floor: ['층'],
  seatNote: ['자리', '자리위치', '좌석'],
  fallRisk: ['낙상'],
  pressureSore: ['욕창'],
  diaperType: ['기저귀'],
  diaperIntermittent: ['간헐적', '간헐'],
  cognitionLevel: ['인지'],
  cognitionNote: ['인지메모', '인지 메모', '인지특이사항'],
  mealType: ['식사형태', '식사종류'],
  morningSnack: ['오전간식'],
  afternoonSnack: ['오후간식'],
  dinner: ['저녁식사', '저녁'],
  mealNote: ['기피식품', '식사메모'],
  bathTime: ['목욕시간'],
  bathNote: ['목욕비고', '목욕메모'],
  medMorning: ['투약아침'],
  medLunch: ['투약점심'],
  medEvening: ['투약저녁'],
  medNote: ['투약메모'],
  vehicleNote: ['차량'],
  careNote: ['비고', '메모'],
} as const;

type CareHeaderKey = keyof typeof CARE_HEADERS;

export type ElderRowStatus =
  | 'ok' // 새로 등록할 대상
  | 'fillExisting' // 이미 등록된 어르신 — 새로 만들지 않고 케어 정보만 채운다
  | 'invalid' // 값이 잘못돼 등록 불가
  | 'duplicateInFile' // 파일 안에 같은 이름·주소가 또 있어 자동 제외
  | 'duplicateExisting'; // 이미 등록된 어르신과 겹쳐 기본 제외 (선택 포함 가능)

export interface ParsedElderRow {
  /** 엑셀 원본 행 번호 — 오류를 파일에서 바로 찾을 수 있게 그대로 보존한다 */
  rowNumber: number;
  name: string;
  homeAddress: string;
  status: ElderRowStatus;
  /** 제외 사유 또는 등록해도 되지만 확인이 필요한 경고 */
  message?: string;
  /** 케어 열이 하나라도 채워져 있을 때만 붙는다 — 빈 프로필을 만들지 않기 위해 */
  careProfile?: ElderCareProfileInput;
  /** status가 'fillExisting'일 때 케어 정보를 채워 넣을 기존 어르신 id */
  existingId?: number;
}

export interface ElderExcelParseResult {
  rows: ParsedElderRow[];
  sheetName: string;
}

/** 셀 값을 안전하게 문자열로 바꾼다. 수식 결과·서식 있는 텍스트·하이퍼링크·숫자를 모두 받는다. */
// exceljs Cell 타입을 직접 import하면 정적 의존이 생겨 동적 로드가 무의미해진다
function cellText(cell: { text?: unknown; value?: unknown }): string {
  try {
    const text = cell.text;
    if (typeof text === 'string') return text.trim();
    if (text != null) return String(text).trim();
  } catch {
    // cell.text 게터가 특수 셀에서 던지는 경우 — value로 폴백
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

const dupKey = (name: string, address: string) => `${name}\u0000${address}`;

const normalizeHeader = (raw: string) => (raw || '').replace(/\s|\(.*\)|（.*）|\*|:|：/g, '');

const TRUE_WORDS = ['O', 'Ｏ', 'Y', 'YES', 'TRUE', '예', '있음', 'V', '○', 'ㅇ'];
const FALSE_WORDS = ['X', 'Ｘ', 'N', 'NO', 'FALSE', '아니오', '아니요', '없음', '무', '-'];

/**
 * O/X 계열 값 하나를 읽는다. "O(10시)"처럼 괄호 안에 시간이 붙어 오는 표가 많아
 * 참/거짓과 시간을 함께 돌려준다. 빈 칸은 undefined — '건드리지 않음'과 '아니오'는 다르다.
 */
export function parseBoolCell(raw: string): { value?: boolean; time?: string } {
  const text = (raw || '').trim();
  if (!text) return {};
  const timeMatch = text.match(/[(（]([^)）]+)[)）]/);
  const time = timeMatch ? timeMatch[1].trim() : undefined;
  const head = text.replace(/[(（][^)）]*[)）]/g, '').trim().toUpperCase();
  // 괄호만 있고 앞글자가 없는 칸("(10시)")도 준다는 뜻으로 본다
  if (!head) return time ? { value: true, time } : {};
  if (head === '0') return { value: false };
  if (head === '1') return { value: true, time };
  if (FALSE_WORDS.includes(head)) return { value: false };
  if (TRUE_WORDS.includes(head)) return { value: true, time };
  // 알 수 없는 값이면 시간만 적힌 칸("10시")으로 본다 — 시간을 적었다는 건 준다는 뜻
  return { value: true, time: text };
}

export function parseCareGrade(raw: string): CareGrade | undefined {
  const text = normalizeHeader(raw || '').replace(/등급$/, '');
  if (!text) return undefined;
  if (['인지지원', '인지'].includes(text)) return 'COGNITIVE_SUPPORT';
  if (['없음', '무', '해당없음', '-'].includes(text)) return 'NONE';
  const n = Number(text);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return `GRADE_${n}` as CareGrade;
  return undefined;
}

export function parseDiaper(raw: string): DiaperType | undefined {
  const text = (raw || '').replace(/\s/g, '');
  if (!text) return undefined;
  if (['없음', '무', 'X', 'x', '-'].includes(text)) return 'NONE';
  if (text.includes('둘다') || (text.includes('팬티') && text.includes('패드'))) return 'BOTH';
  if (text.includes('팬티')) return 'PANTY';
  if (text.includes('패드')) return 'PAD';
  return undefined;
}

export function parseCognition(raw: string): CognitionLevel | undefined {
  const text = (raw || '').replace(/\s/g, '');
  if (!text) return undefined;
  if (text.includes('중등')) return 'MODERATE';
  if (text.includes('중증') || text.includes('심함')) return 'SEVERE';
  if (text.includes('경도') || text.includes('경증')) return 'MILD';
  if (text.includes('정상') || text.includes('양호')) return 'NORMAL';
  return undefined;
}

export function parseMealType(raw: string): MealType | undefined {
  const text = (raw || '').replace(/\s/g, '');
  if (!text) return undefined;
  if (text.includes('비빔')) return 'MIXED';
  if (text.includes('다진') || text.includes('잘게')) return 'CHOPPED';
  if (text.includes('죽')) return 'PORRIDGE';
  if (text.includes('일반')) return 'REGULAR';
  return undefined;
}

export function parseGender(raw: string): Gender | undefined {
  const text = (raw || '').replace(/\s/g, '').toUpperCase();
  if (!text) return undefined;
  if (['남', '남자', '남성', 'M', 'MALE'].includes(text)) return 'MALE';
  if (['여', '여자', '여성', 'F', 'FEMALE'].includes(text)) return 'FEMALE';
  return undefined;
}

/** "1941-02-03" / "1941.2.3" / "1941년 2월 3일" / 엑셀 날짜 문자열을 YYYY-MM-DD로 */
export function parseBirthDate(raw: string): string | undefined {
  const text = (raw || '').trim();
  if (!text) return undefined;
  const m = text.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // 엑셀이 Date로 돌려준 뒤 문자열이 된 경우
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(text)) {
    const y = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return undefined;
}

/** 헤더 행을 찾아 열 위치를 돌려준다. 이름 열이 없으면 null. */
function locateColumns(grid: string[][]): { headerRow: number; nameCol: number; addressCol: number; care: Partial<Record<CareHeaderKey, number>> } | null {
  const scanLimit = Math.min(grid.length, 10);
  for (let r = 0; r < scanLimit; r += 1) {
    const row = grid[r] || [];
    const nameCol = row.findIndex((cell) => HEADER_NAME.includes(normalizeHeader(cell)));
    if (nameCol === -1) continue;

    let addressCol = -1;
    const care: Partial<Record<CareHeaderKey, number>> = {};
    for (let c = 0; c < row.length; c += 1) {
      if (c === nameCol) continue;
      const head = normalizeHeader(row[c]);
      if (!head) continue;
      if (addressCol === -1 && HEADER_ADDRESS.includes(head)) {
        addressCol = c;
        continue;
      }
      for (const key of Object.keys(CARE_HEADERS) as CareHeaderKey[]) {
        if (care[key] === undefined && (CARE_HEADERS[key] as readonly string[]).includes(head)) {
          care[key] = c;
          break;
        }
      }
    }
    return { headerRow: r, nameCol, addressCol, care };
  }
  return null;
}

/** 케어 열을 읽어 요청 모양으로 만든다. 채워진 칸이 하나도 없으면 undefined. */
function buildCareProfile(
  cells: string[],
  care: Partial<Record<CareHeaderKey, number>>,
): { profile?: ElderCareProfileInput; error?: string } {
  const at = (key: CareHeaderKey) => {
    const col = care[key];
    return col === undefined ? '' : (cells[col] || '').trim();
  };

  const profile: ElderCareProfileInput = {};
  let touched = false;
  const set = <K extends keyof ElderCareProfileInput>(key: K, value: ElderCareProfileInput[K] | undefined) => {
    if (value === undefined) return;
    profile[key] = value;
    touched = true;
  };

  const rrnRaw = at('residentNumber');
  if (rrnRaw) {
    if (!isValidResidentNumber(rrnRaw)) {
      return { error: `주민번호가 13자리가 아닙니다 (${rrnRaw})` };
    }
    set('residentNumber', digitsOnly(rrnRaw));
  }

  set('birthDate', parseBirthDate(at('birthDate')));
  set('gender', parseGender(at('gender')));
  set('careGrade', parseCareGrade(at('careGrade')));

  const floorRaw = at('floor').replace(/층|\s/g, '');
  if (floorRaw) {
    const floor = Number(floorRaw);
    if (!Number.isInteger(floor) || floor < 0 || floor > 99) {
      return { error: `층은 숫자로 적어주세요 (${at('floor')})` };
    }
    set('floor', floor);
  }
  if (at('seatNote')) set('seatNote', at('seatNote').slice(0, 100));

  const fall = parseBoolCell(at('fallRisk'));
  set('fallRisk', fall.value);
  if (fall.time) set('fallNote', fall.time);

  const sore = parseBoolCell(at('pressureSore'));
  set('pressureSore', sore.value);
  if (sore.time) set('pressureSoreNote', sore.time);

  set('diaperType', parseDiaper(at('diaperType')));
  set('diaperIntermittent', parseBoolCell(at('diaperIntermittent')).value);
  set('cognitionLevel', parseCognition(at('cognitionLevel')));
  if (at('cognitionNote')) set('cognitionNote', at('cognitionNote').slice(0, NOTE_MAX));

  set('mealType', parseMealType(at('mealType')));
  set('morningSnack', parseBoolCell(at('morningSnack')).value);
  set('afternoonSnack', parseBoolCell(at('afternoonSnack')).value);
  set('dinner', parseBoolCell(at('dinner')).value);
  if (at('mealNote')) set('mealNote', at('mealNote').slice(0, NOTE_MAX));

  if (at('bathTime')) set('bathTime', at('bathTime').slice(0, 50));
  if (at('bathNote')) set('bathNote', at('bathNote').slice(0, NOTE_MAX));

  // 투약은 O/X 옆에 시간이 괄호로 붙는 표가 흔하다 — 같은 칸에서 둘 다 뽑는다
  const morning = parseBoolCell(at('medMorning'));
  set('medMorning', morning.value);
  if (morning.time) set('medMorningTime', morning.time.slice(0, 20));
  const lunch = parseBoolCell(at('medLunch'));
  set('medLunch', lunch.value);
  if (lunch.time) set('medLunchTime', lunch.time.slice(0, 20));
  const evening = parseBoolCell(at('medEvening'));
  set('medEvening', evening.value);
  if (evening.time) set('medEveningTime', evening.time.slice(0, 20));
  if (at('medNote')) set('medNote', at('medNote').slice(0, NOTE_MAX));

  if (at('vehicleNote')) set('vehicleNote', at('vehicleNote').slice(0, 255));
  if (at('careNote')) set('careNote', at('careNote').slice(0, NOTE_MAX));

  return touched ? { profile } : {};
}

/**
 * 문자열 격자(행 × 열)를 해석해 행별 검증 결과를 돌려준다.
 * grid[0]이 엑셀 1행 — rowNumber는 사용자가 파일에서 보는 번호 그대로 매긴다.
 */
export function parseElderRows(grid: string[][], existingSeniors: ElderlyInfo[] = []): ParsedElderRow[] {
  const located = locateColumns(grid);
  if (!located) {
    throw new Error("헤더 행을 찾을 수 없습니다. 첫 번째 시트에 '이름' 열이 있는 양식인지 확인해주세요. (양식 내려받기로 받은 파일을 쓰는 것이 가장 확실합니다)");
  }
  const { headerRow, nameCol, addressCol, care } = located;

  // 기존 등록 어르신 — 이름+주소 완전 일치는 제외 후보,
  // 이름이 한 명에게만 걸리면 '케어 정보 채우기' 후보다.
  const existingFull = new Set(existingSeniors.map((s) => dupKey(s.name.trim(), (s.homeAddressName || '').trim())));
  const existingByName = new Map<string, ElderlyInfo[]>();
  for (const senior of existingSeniors) {
    const key = senior.name.trim();
    const list = existingByName.get(key);
    if (list) list.push(senior);
    else existingByName.set(key, [senior]);
  }

  const rows: ParsedElderRow[] = [];
  const seenInFile = new Map<string, number>(); // 이름+주소 → 첫 등장 행 번호
  const namesInFile = new Map<string, number[]>(); // 이름 → 행 번호들 (동명이인 경고용)

  for (let r = headerRow + 1; r < grid.length; r += 1) {
    const cells = grid[r] || [];
    const name = (cells[nameCol] || '').trim();
    const homeAddress = addressCol === -1 ? '' : (cells[addressCol] || '').trim();

    // 완전히 빈 행은 조용히 건너뛴다 (양식 아래쪽 빈 칸)
    if (!cells.some((cell) => (cell || '').trim())) continue;

    const parsed: ParsedElderRow = {
      rowNumber: r + 1,
      name,
      homeAddress,
      status: 'ok',
    };

    const { profile, error: careError } = buildCareProfile(cells, care);
    if (profile) parsed.careProfile = profile;

    if (!name) {
      parsed.status = 'invalid';
      parsed.message = '이름이 비어 있습니다';
    } else if (name.length > NAME_MAX) {
      parsed.status = 'invalid';
      parsed.message = `이름이 너무 깁니다 (${NAME_MAX}자 이내)`;
    } else if (homeAddress.length > ADDRESS_MAX) {
      parsed.status = 'invalid';
      parsed.message = `주소가 너무 깁니다 (${ADDRESS_MAX}자 이내)`;
    } else if (careError) {
      // 케어 값이 잘못된 행은 등록하지 않는다 — 반쪽짜리 프로필이 조용히 들어가면 더 위험하다
      parsed.status = 'invalid';
      parsed.message = careError;
    } else {
      const key = dupKey(name, homeAddress);
      const firstRow = seenInFile.get(key);
      const sameName = existingByName.get(name) || [];
      if (firstRow !== undefined) {
        parsed.status = 'duplicateInFile';
        parsed.message = `${firstRow}행과 이름·주소가 같습니다`;
      } else if (sameName.length > 1) {
        // 동명이인은 어느 분인지 지목할 수 없다 — 엉뚱한 분의 케어 정보를 덮어쓰는 쪽이
        // 비어 있는 쪽보다 위험하므로 기본 제외하고 화면에서 직접 고치게 한다
        parsed.status = 'duplicateExisting';
        parsed.message = '같은 이름이 둘 이상 등록돼 있어 지목할 수 없습니다 — 화면에서 직접 수정해 주세요';
      } else if (sameName.length === 1 && parsed.careProfile) {
        // 이름이 같으면 주소가 달라도 그분으로 본다 — 현장에서 쓰던 표에는 주소 칸이 없는 경우가 많다.
        // 주소는 일부러 갱신하지 않는다: 기존 어르신의 주소에는 배차용 좌표가 딸려 있는데
        // 엑셀의 주소 문자열로 덮으면 좌표와 말이 어긋나 배차가 엉킨다. 여기서는 케어 정보만 채운다.
        parsed.status = 'fillExisting';
        parsed.existingId = sameName[0].id;
        parsed.message = '이미 등록된 어르신 — 케어 정보만 채웁니다';
      } else if (existingFull.has(key)) {
        parsed.status = 'duplicateExisting';
        parsed.message = '이미 등록된 어르신과 이름·주소가 같습니다';
      } else if (sameName.length === 1) {
        // 케어 값이 없어 채울 것이 없는 행 — 새로 등록할지 눈으로 확인시킨다
        parsed.message = '같은 이름의 어르신이 이미 등록돼 있습니다 — 동명이인인지 확인하세요';
      }

      if (firstRow === undefined) seenInFile.set(key, parsed.rowNumber);
      const sameNames = namesInFile.get(name) || [];
      sameNames.push(parsed.rowNumber);
      namesInFile.set(name, sameNames);
    }

    rows.push(parsed);
  }

  // 파일 안 동명이인(주소는 다름) 경고 — 둘 다 등록은 되지만 눈으로 확인시킨다
  for (const parsed of rows) {
    if (parsed.status !== 'ok' || parsed.message) continue;
    const sameNames = namesInFile.get(parsed.name) || [];
    if (sameNames.length > 1) {
      const others = sameNames.filter((n) => n !== parsed.rowNumber);
      parsed.message = `같은 이름이 파일에 또 있습니다 (${others.join(', ')}행) — 동명이인인지 확인하세요`;
    }
  }

  // 한도 초과분은 등록 불가로 표시한다 — 잘라내고 조용히 넘어가면 누락을 알 수 없다.
  // 기본 제외되는 '기존 중복' 행은 한도를 소진하지 않는다 (포함을 켠 채 넘치는 경우는
  // 다이얼로그가 등록 버튼에서 다시 막는다).
  let registrable = 0;
  for (const parsed of rows) {
    if (parsed.status === 'ok') {
      registrable += 1;
      if (registrable > MAX_BULK_ELDERS) {
        parsed.status = 'invalid';
        parsed.message = `한 번에 ${MAX_BULK_ELDERS}명까지 등록할 수 있습니다 — 파일을 나눠 올려주세요`;
      }
    }
  }

  return rows;
}

/**
 * 업로드된 .xlsx 파일을 파싱해 행별 검증 결과를 돌려준다.
 * 파일 형식이 아예 읽을 수 없을 때만 throw하고, 행 단위 문제는 전부 결과에 담는다.
 */
export async function parseElderExcel(
  file: File,
  existingSeniors: ElderlyInfo[],
): Promise<ElderExcelParseResult> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('엑셀 파일을 읽을 수 없습니다. .xlsx 형식인지 확인해주세요.');
  }

  // 안내용 시트(작성 방법)는 건너뛰고, 데이터가 있을 첫 시트를 찾는다
  const worksheet = workbook.worksheets.find((ws) => ws.name !== GUIDE_SHEET_NAME) || workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('엑셀 파일에 시트가 없습니다.');
  }

  // 격자로 옮긴 뒤의 해석은 전부 parseElderRows가 한다 (테스트가 닿는 곳)
  const columnLimit = Math.max(worksheet.columnCount, 3);
  const grid: string[][] = [];
  for (let r = 1; r <= worksheet.rowCount; r += 1) {
    const row = worksheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= columnLimit; c += 1) cells.push(cellText(row.getCell(c)));
    grid.push(cells);
  }

  return { rows: parseElderRows(grid, existingSeniors), sheetName: worksheet.name };
}

const GUIDE_SHEET_NAME = '작성 방법';

/** 양식 열 정의 — 헤더 문자열은 파서의 별칭 목록과 같은 말이어야 한다 */
/** 양식 열 정의 — 테스트가 케어 열 누락을 잡을 수 있게 내보낸다 */
export const TEMPLATE_COLUMNS: { header: string; width: number; example: string }[] = [
  { header: '이름', width: 12, example: '김복순' },
  { header: '주소', width: 34, example: '서울시 강남구 테헤란로 1' },
  { header: '주민번호', width: 16, example: '000000-0000000' },
  { header: '생년월일', width: 13, example: '1941-02-03' },
  { header: '성별', width: 7, example: '여' },
  { header: '등급', width: 10, example: '3등급' },
  { header: '층', width: 6, example: '1' },
  { header: '자리', width: 14, example: 'TV 앞 좌측' },
  { header: '낙상', width: 8, example: 'O' },
  { header: '욕창', width: 8, example: 'X' },
  { header: '기저귀', width: 10, example: '패드' },
  { header: '간헐적', width: 8, example: 'O' },
  { header: '인지', width: 9, example: '경도' },
  { header: '인지메모', width: 20, example: '오후에 혼란 심해짐' },
  { header: '식사형태', width: 10, example: '다진식' },
  { header: '오전간식', width: 9, example: 'O' },
  { header: '오후간식', width: 9, example: 'X' },
  { header: '저녁식사', width: 9, example: 'O' },
  { header: '기피식품', width: 22, example: '생선 기피, 두부로 대체' },
  { header: '목욕시간', width: 12, example: '9:40-50' },
  { header: '목욕비고', width: 24, example: '방문목욕으로 1,3주차 제외' },
  { header: '투약아침', width: 11, example: 'O(10시)' },
  { header: '투약점심', width: 11, example: 'O' },
  { header: '투약저녁', width: 11, example: 'X' },
  { header: '투약메모', width: 20, example: '혈압약 식후 30분' },
  { header: '차량', width: 18, example: '1호차 · 문 앞까지 동행' },
  { header: '비고', width: 24, example: '보호자 통화는 저녁에' },
];

/** 대량 등록 양식(.xlsx)을 만들어 내려받는다. */
export async function downloadElderTemplate(): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('어르신 명단');
  sheet.columns = TEMPLATE_COLUMNS.map((c) => ({ header: c.header, width: c.width }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 22;
  for (let c = 1; c <= TEMPLATE_COLUMNS.length; c += 1) {
    headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1F1' } };
    headerRow.getCell(c).border = { bottom: { style: 'thin', color: { argb: 'FFD4D4D4' } } };
  }

  // 모든 칸을 텍스트 서식으로 — 이름이 숫자로, 주소 번지가 날짜로,
  // 주민번호 앞자리 0이 사라지는 사고를 막는다
  for (let r = 2; r <= MAX_BULK_ELDERS + 2; r += 1) {
    for (let c = 1; c <= TEMPLATE_COLUMNS.length; c += 1) {
      sheet.getCell(r, c).numFmt = '@';
    }
  }

  // 예시 행 — 값 형식을 말로 설명하는 것보다 한 줄 보여주는 편이 확실하다.
  // 회색 이탤릭으로 두어 "지우고 쓰는 줄"임이 보이게 한다.
  const exampleRow = sheet.getRow(2);
  TEMPLATE_COLUMNS.forEach((col, i) => {
    exampleRow.getCell(i + 1).value = col.example;
  });
  exampleRow.font = { italic: true, color: { argb: 'FF9A9A9A' } };

  const guide = workbook.addWorksheet(GUIDE_SHEET_NAME);
  guide.columns = [{ width: 96 }];
  const guideLines = [
    '어르신 대량 등록 양식 작성 방법',
    '',
    "1. '어르신 명단' 시트의 2행(예시)을 지우고, 2행부터 한 줄에 한 분씩 적습니다.",
    `2. 이름만 필수입니다 (${NAME_MAX}자 이내). 나머지 열은 비워 두면 등록하지 않습니다.`,
    `3. 한 번에 최대 ${MAX_BULK_ELDERS}명까지 등록할 수 있습니다. 넘으면 파일을 나눠 올려주세요.`,
    '4. 필요 없는 열은 통째로 지워도 되고, 열 순서를 바꿔도 됩니다 (열 이름으로 찾습니다).',
    '',
    '■ 값 적는 법',
    '· O/X 칸(낙상, 욕창, 간헐적, 오전간식, 오후간식, 저녁식사, 투약아침/점심/저녁)',
    '  O, 예, Y, TRUE = 해당됨 / X, 아니오, N, FALSE = 해당 없음 / 빈 칸 = 입력하지 않음',
    '  시간이 있으면 괄호로 함께 적습니다 — 예: O(10시)',
    '· 주민번호: 13자리. 하이픈은 있어도 없어도 됩니다. 13자리가 아니면 그 행은 등록되지 않습니다.',
    '  적어 두면 생년월일과 성별은 자동으로 채워집니다 (직접 적은 값이 우선).',
    '· 생년월일: 1941-02-03 / 1941.2.3 / 1941년 2월 3일 모두 됩니다.',
    '· 성별: 남 또는 여 (M/F도 됩니다)',
    '· 등급: 1등급 ~ 5등급, 인지지원, 없음',
    '· 기저귀: 팬티 / 패드 / 둘다 / 없음',
    '· 인지: 정상 / 경도 / 중등도 / 중증',
    '· 식사형태: 일반식 / 다진식 / 죽 / 비빔식',
    '· 층: 숫자만 (1, 2). 자리는 위치 메모입니다 — 예: TV 앞 좌측',
    '',
    '업로드하면 등록 전에 행별 검사 결과를 먼저 보여드립니다.',
    '이미 등록된 어르신은 이름이 같으면 새로 만들지 않고 케어 정보만 채웁니다.',
    '(같은 이름이 둘 이상 등록돼 있으면 어느 분인지 지목할 수 없어 제외되니, 화면에서 직접 수정해 주세요.)',
    '',
    '※ 주민번호는 암호화해 보관하며, 목록에는 410203-2****** 형태로만 표시됩니다.',
  ];
  guideLines.forEach((line, i) => {
    const cell = guide.getCell(i + 1, 1);
    cell.value = line;
    if (i === 0) cell.font = { bold: true, size: 14 };
    else if (line.startsWith('■')) cell.font = { bold: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '어르신_대량등록_양식.xlsx';
  anchor.click();
  URL.revokeObjectURL(url);
}
