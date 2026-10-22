/**
 * 공식 수가표 대조 — `node --test src/lib/lab/ltc2026Official.test.ts`
 *
 * 근거: 보건복지부 보도자료(2025-11-04 보도시점) 붙임2 "'26년도 등급별 재가이용 월 한도액 및 급여유형별 수가" —
 * ③ 주야간보호 표(수가·본인부담, 일반 15%)와 재가급여 월 한도액 표. 케어포 공개 자료실에도 같은 PDF가 올라 있다.
 * 왜: 청구서 금액은 이 표에서 나온다. 한 칸이 틀리면 모든 청구서가 같은 만큼 틀리므로 표를 손으로 옮긴 값 그대로 박아 둔다.
 *
 * 1일 본인부담은 표가 사사오입(예: 51,930원×15% = 7,789.5 → 7,790)이고 청구서 계산은 내림(원 미만 버림)이라
 * 칸에 따라 1원까지 다를 수 있다. 이 차이는 한 칸에 1원 이내인지만 확인한다(월 합계의 원 단위 처리는 공단 청구상세와 대조 필요).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CARE_GRADES, MONTHLY_LIMIT_2026, calcDaycareCopay, dailyFee } from '../ltc2026.ts';
import type { CareGrade, HourBand } from '../ltc2026.ts';

type Cell = [CareGrade, number, number]; // 등급, 1일 수가, 1일 본인부담(표)

const OFFICIAL: Record<HourBand, Cell[]> = {
  h3to6: [['1', 41820, 6273], ['2', 38720, 5808], ['3', 35740, 5361], ['4', 34120, 5118], ['5', 32490, 4874], ['cognitive', 32490, 4874]],
  h6to8: [['1', 56060, 8409], ['2', 51930, 7790], ['3', 47940, 7191], ['4', 46300, 6945], ['5', 44650, 6698], ['cognitive', 44650, 6698]],
  h8to10: [['1', 69730, 10460], ['2', 64590, 9689], ['3', 59640, 8946], ['4', 58010, 8702], ['5', 56360, 8454], ['cognitive', 56360, 8454]],
  h10to13: [['1', 76820, 11523], ['2', 71160, 10674], ['3', 65750, 9863], ['4', 64090, 9614], ['5', 62460, 9369], ['cognitive', 56360, 8454]],
  over13: [['1', 82370, 12356], ['2', 76310, 11447], ['3', 70500, 10575], ['4', 68860, 10329], ['5', 67240, 10086], ['cognitive', 56360, 8454]],
};

const OFFICIAL_MONTHLY_LIMIT: Record<CareGrade, number> = {
  '1': 2512900,
  '2': 2331200,
  '3': 1528200,
  '4': 1409700,
  '5': 1208900,
  cognitive: 676320,
};

let feeCells = 0;
let limitCells = 0;

test('일반 주야간보호 1일 급여비용이 공식 표와 같다', () => {
  for (const [band, cells] of Object.entries(OFFICIAL) as Array<[HourBand, Cell[]]>) {
    for (const [grade, fee] of cells) {
      assert.equal(dailyFee(grade, 'general', band), fee, `${band} ${grade}등급 1일 수가`);
      feeCells += 1;
    }
  }
});

test('1일 본인부담은 공식 표와 1원 이내다(표는 사사오입, 계산은 원 미만 버림)', () => {
  for (const [band, cells] of Object.entries(OFFICIAL) as Array<[HourBand, Cell[]]>) {
    for (const [grade, , copay] of cells) {
      const r = calcDaycareCopay({ grade, unit: 'general', band, days: 1, copayClass: 'standard' });
      assert.ok(r !== null);
      assert.ok(Math.abs(r.totalCopay - copay) <= 1, `${band} ${grade}등급: 표 ${copay}원, 계산 ${r.totalCopay}원`);
    }
  }
});

test('재가급여 월 한도액이 공식 표와 같다', () => {
  for (const grade of CARE_GRADES.map((g) => g.id)) {
    assert.equal(MONTHLY_LIMIT_2026[grade], OFFICIAL_MONTHLY_LIMIT[grade], `${grade} 월 한도액`);
    limitCells += 1;
  }
});

test('표의 칸 수를 센다', () => {
  assert.equal(feeCells, 30);
  assert.equal(limitCells, 6);
  console.log(`official-fee-table verified ${feeCells} daily fees and ${limitCells} monthly limits`);
});
