'use client';

/** 규정·지침 대장 인쇄본(A4 세로) — 종류·제목·상태·최근 개정일·비치 장소·교육일. 아직 없는 필수 종류는 ‘등록 전’. 화면에서는 보이지 않는다. */
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import type { PolicyDoc } from '@/lib/lab/labTypes';
import { SLOTS, slotKeyOf } from './PolicyDocKinds';
import { statusView } from './PolicyDocStatus';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';
import ten from './labPlans10.module.css';

interface Props {
  docs: PolicyDoc[] | null;
  printKey: number;
  onReady: () => void;
}

export default function PolicyDocPrint({ docs, printKey, onReady }: Props) {
  if (!docs) return null;
  const today = todayString();
  const byKey = new Map<string, PolicyDoc>();
  for (const d of docs) if (d.kind !== 'OTHER' && !byKey.has(slotKeyOf(d))) byKey.set(slotKeyOf(d), d);
  const rows: Array<{ name: string; doc: PolicyDoc | null }> = [
    ...SLOTS.map((s) => ({ name: s.name, doc: byKey.get(s.key) ?? null })),
    ...docs.filter((d) => d.kind === 'OTHER').map((d) => ({ name: `기타: ${d.title}`, doc: d })),
  ];
  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>기관 규정·지침 대장</h1>
      <div className={styles.printMeta}>
        <span>기관명: {companyNameStored() || '____________'}</span>
        <span>기준일: {dotDate(today)}</span>
      </div>
      <table className={`${styles.sheetTable} ${ten.printSmall}`}>
        <thead>
          <tr>
            <th>종류</th>
            <th>상태</th>
            <th>최근 개정일</th>
            <th>비치 장소</th>
            <th>교육일</th>
            <th>확인</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const v = r.doc ? statusView(r.doc, today) : null;
            return (
              <tr key={r.doc ? `d${r.doc.id}` : r.name}>
                <td>{r.name}</td>
                <td>{v === null ? '등록 전' : v.ready ? '갖춤' : `보완 필요${v.gaps.length > 0 ? ` (${v.gaps.join(', ')})` : ''}`}</td>
                <td>{r.doc?.revisedOn ? dotDate(r.doc.revisedOn) : ''}</td>
                <td>{r.doc?.location ?? ''}</td>
                <td>{r.doc?.trainedOn ? dotDate(r.doc.trainedOn) : ''}</td>
                <td className={ten.signCell} />
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.printNote}>운영규정은 평가 매뉴얼 11개 항목과 노인복지법 시행규칙 별표 10 제3호 항목을 모두 갖추어야 합니다. 개정 주기와 교육 주기는 기관 기준이며 대조 필요입니다.</p>
      <div className={styles.printSign}>
        <span>출력일: {dotDate(today)}</span>
        <span>시설장: ____________ (서명)</span>
      </div>
    </PlansPrintPortal>
  );
}
