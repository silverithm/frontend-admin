/**
 * 어르신 대량 등록 엑셀 — 양식 생성과 업로드 파일 파싱·검증.
 *
 * exceljs는 번들이 커서 호출 시점에 동적 로드한다 (workScheduleExcel과 같은 이유).
 * 서버에 보내기 전에 모든 행을 여기서 검증해, 어떤 행이 왜 제외되는지
 * 등록 전에 눈으로 확인하고 시작할 수 있게 한다 — 등록 도중에 터지는 오류를
 * 사전 검증 단계로 앞당기는 것이 이 파일의 존재 이유다.
 */

import type { ElderlyInfo } from '@/types/elderly';

/** 한 번에 등록할 수 있는 최대 인원. 백엔드 bulk API와 같은 값이어야 한다. */
export const MAX_BULK_ELDERS = 500;

const NAME_MAX = 50;
const ADDRESS_MAX = 200;

const HEADER_NAME = ['이름', '성명'];
const HEADER_ADDRESS = ['주소', '자택주소', '집주소', '거주지'];

export type ElderRowStatus =
  | 'ok' // 등록 대상
  | 'invalid' // 값이 잘못돼 등록 불가
  | 'duplicateInFile' // 파일 안에 같은 이름·주소가 또 있어 자동 제외
  | 'duplicateExisting'; // 이미 등록된 어르신과 이름·주소가 같아 기본 제외 (선택 포함 가능)

export interface ParsedElderRow {
  /** 엑셀 원본 행 번호 — 오류를 파일에서 바로 찾을 수 있게 그대로 보존한다 */
  rowNumber: number;
  name: string;
  homeAddress: string;
  status: ElderRowStatus;
  /** 제외 사유 또는 등록해도 되지만 확인이 필요한 경고 */
  message?: string;
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

  // 헤더 행 탐색 — 양식을 조금 고쳐 썼어도(위에 제목 행 추가, 열 순서 변경 등) 찾아낸다.
  // '이름' 열이 있는 행을 헤더로 보고, 그 행 전체에서 나머지 열을 다시 찾는다.
  let headerRow = -1;
  let nameCol = -1;
  let addressCol = -1;
  const normalize = (raw: string) => raw.replace(/\s|\(.*\)|（.*）|\*/g, '');
  const scanLimit = Math.min(worksheet.rowCount, 10);
  const columnLimit = Math.max(worksheet.columnCount, 3);
  for (let r = 1; r <= scanLimit && headerRow === -1; r += 1) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= columnLimit; c += 1) {
      if (HEADER_NAME.includes(normalize(cellText(row.getCell(c))))) {
        headerRow = r;
        nameCol = c;
        break;
      }
    }
  }
  if (headerRow !== -1) {
    const row = worksheet.getRow(headerRow);
    for (let c = 1; c <= columnLimit; c += 1) {
      if (c === nameCol) continue;
      if (addressCol === -1 && HEADER_ADDRESS.includes(normalize(cellText(row.getCell(c))))) {
        addressCol = c;
      }
    }
  }
  if (headerRow === -1) {
    throw new Error("헤더 행을 찾을 수 없습니다. 첫 번째 시트에 '이름' 열이 있는 양식인지 확인해주세요. (양식 내려받기로 받은 파일을 쓰는 것이 가장 확실합니다)");
  }

  // 기존 등록 어르신 — 이름+주소 완전 일치는 제외 후보, 이름만 일치는 경고
  const existingFull = new Set(existingSeniors.map((s) => dupKey(s.name.trim(), (s.homeAddressName || '').trim())));
  const existingNames = new Set(existingSeniors.map((s) => s.name.trim()));

  const rows: ParsedElderRow[] = [];
  const seenInFile = new Map<string, number>(); // 이름+주소 → 첫 등장 행 번호
  const namesInFile = new Map<string, number[]>(); // 이름 → 행 번호들 (동명이인 경고용)

  for (let r = headerRow + 1; r <= worksheet.rowCount; r += 1) {
    const row = worksheet.getRow(r);
    const name = cellText(row.getCell(nameCol));
    const homeAddress = addressCol === -1 ? '' : cellText(row.getCell(addressCol));

    // 완전히 빈 행은 조용히 건너뛴다 (양식 아래쪽 빈 칸)
    if (!name && !homeAddress) continue;

    const parsed: ParsedElderRow = {
      rowNumber: r,
      name,
      homeAddress,
      status: 'ok',
    };

    if (!name) {
      parsed.status = 'invalid';
      parsed.message = '이름이 비어 있습니다';
    } else if (name.length > NAME_MAX) {
      parsed.status = 'invalid';
      parsed.message = `이름이 너무 깁니다 (${NAME_MAX}자 이내)`;
    } else if (homeAddress.length > ADDRESS_MAX) {
      parsed.status = 'invalid';
      parsed.message = `주소가 너무 깁니다 (${ADDRESS_MAX}자 이내)`;
    } else {
      const key = dupKey(name, homeAddress);
      const firstRow = seenInFile.get(key);
      if (firstRow !== undefined) {
        parsed.status = 'duplicateInFile';
        parsed.message = `${firstRow}행과 이름·주소가 같습니다`;
      } else if (existingFull.has(key)) {
        parsed.status = 'duplicateExisting';
        parsed.message = '이미 등록된 어르신과 이름·주소가 같습니다';
      } else if (existingNames.has(name)) {
        parsed.message = '같은 이름의 어르신이 이미 등록돼 있습니다 — 동명이인인지 확인하세요';
      }

      if (firstRow === undefined) seenInFile.set(key, r);
      const sameNames = namesInFile.get(name) || [];
      sameNames.push(r);
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

  return { rows, sheetName: worksheet.name };
}

const GUIDE_SHEET_NAME = '작성 방법';

/** 대량 등록 양식(.xlsx)을 만들어 내려받는다. */
export async function downloadElderTemplate(): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('어르신 명단');
  sheet.columns = [
    { header: '이름', key: 'name', width: 16 },
    { header: '주소', key: 'homeAddress', width: 48 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 22;
  for (let c = 1; c <= 2; c += 1) {
    headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1F1' } };
    headerRow.getCell(c).border = { bottom: { style: 'thin', color: { argb: 'FFD4D4D4' } } };
  }

  // 모든 칸을 텍스트 서식으로 — 이름이 숫자로, 주소 번지가 날짜로 바뀌는 사고를 막는다
  for (let r = 2; r <= MAX_BULK_ELDERS + 1; r += 1) {
    sheet.getCell(r, 1).numFmt = '@';
    sheet.getCell(r, 2).numFmt = '@';
  }

  const guide = workbook.addWorksheet(GUIDE_SHEET_NAME);
  guide.columns = [{ width: 90 }];
  const guideLines = [
    '어르신 대량 등록 양식 작성 방법',
    '',
    "1. '어르신 명단' 시트의 2행부터 한 줄에 한 분씩 적습니다.",
    `2. 이름은 필수입니다 (${NAME_MAX}자 이내). 주소는 비워 둘 수 있습니다 (${ADDRESS_MAX}자 이내).`,
    `3. 한 번에 최대 ${MAX_BULK_ELDERS}명까지 등록할 수 있습니다. 넘으면 파일을 나눠 올려주세요.`,
    '4. 제목(1행)만 있으면 위에 다른 행이 있어도 됩니다.',
    '',
    '업로드하면 등록 전에 행별 검사 결과를 먼저 보여드립니다.',
    '이미 등록된 어르신과 이름·주소가 같은 행은 자동으로 제외되며, 필요하면 포함할 수 있습니다.',
  ];
  guideLines.forEach((line, i) => {
    const cell = guide.getCell(i + 1, 1);
    cell.value = line;
    if (i === 0) cell.font = { bold: true, size: 14 };
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
