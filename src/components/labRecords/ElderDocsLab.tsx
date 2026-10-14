'use client';

/**
 * 수급자 서류함 — 어르신별 서류 갖춤 현황. 서류 기록이 없어도 계약·올해 급여계획·위험도 평가·인권 안내가 있으면 "자동"으로 갖춘 것으로 본다.
 * 어르신을 열면 서류별로 기록을 추가·고치고, 만료·빠진 서류는 강조한다. 보존 기한(급여 종료 5년)과 파기 대상, 점검표 인쇄.
 */
import { useState } from 'react';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import type { ElderDocStatusRow } from '@/lib/lab/elderDocRules';
import type { ElderDocument } from '@/lib/lab/labTypes';
import { ErrorBanner } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import { useElderDocsData } from './ElderDocsData';
import ElderDocsList from './ElderDocsList';
import ElderDocsRetention from './ElderDocsRetention';
import ElderDocsSheet from './ElderDocsSheet';
import styles from './labRecords.module.css';
import own from './ElderDocs.module.css';

interface PrintTarget {
  elderName: string;
  rows: Array<ElderDocStatusRow<ElderDocument>>;
}

export default function ElderDocsLab() {
  const today = todayString();
  const { elders, isLoading: eldersLoading, error: eldersError, reload: reloadElders } = useLabElders();
  const data = useElderDocsData(Number(today.slice(0, 4)));
  const [openId, setOpenId] = useState<number | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [printing, setPrinting] = useState<PrintTarget | null>(null);
  // 처음 불러올 때만 로딩 표시 — 서류를 저장한 뒤 다시 읽을 때 목록이 깜빡이지 않게 한다
  const [ready, setReady] = useState(false);
  if (!ready && !eldersLoading && !data.isLoading) setReady(true);

  return (
    <div className={styles.stack}>
      <div className={own.guide}>
        <p>서류 목록은 법정 목록이 아니라 평가·운영 기준을 묶은 기관 점검표입니다(대조 필요). 인정서·이용계획서 사본과 개인정보 동의서의 보관 의무는 규정에서 확인하지 못했습니다.</p>
        <p>제목·보관 위치에 개인정보(주민등록번호·연락처·주소 등)를 적지 마세요. 서류 파일이 아니라 어디에 있는지만 기록합니다.</p>
      </div>
      {eldersError && <ErrorBanner message={eldersError} onRetry={() => void reloadElders()} />}
      {data.errors.length > 0 && (
        <ErrorBanner
          message={`${data.errors.join(' · ')} — 자동 근거가 빠져 갖춤 현황이 실제와 다를 수 있습니다`}
          onRetry={data.reloadAll}
        />
      )}
      <div className={styles.toolbar}>
        <Text type="supporting" color="secondary">
          어르신 {elders.length}명 · 갖춤은 서류 기록, 자동은 계약·급여계획·위험도·인권 안내 기록으로 본 것
        </Text>
        <div className={styles.spacer}>
          <Switch label="빠졌거나 만료된 분만 보기" value={onlyProblems} onChange={setOnlyProblems} />
        </div>
      </div>
      <ElderDocsList
        elders={elders}
        isLoading={!ready}
        source={data}
        today={today}
        openId={openId}
        onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
        onChanged={() => void data.reloadDocs()}
        onPrint={(elder, rows) => setPrinting({ elderName: elder.name, rows })}
        onlyProblems={onlyProblems}
      />
      <ElderDocsRetention contracts={data.contracts} today={today} />
      {printing && <ElderDocsSheet elderName={printing.elderName} rows={printing.rows} today={today} onDone={() => setPrinting(null)} />}
    </div>
  );
}
