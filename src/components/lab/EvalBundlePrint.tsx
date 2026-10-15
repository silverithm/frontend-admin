'use client';

/**
 * 평가 준비 묶음 인쇄 — 모든 지표(2026판 삭제 지표 제외)의 상태·요건 체크리스트·근거 메모·AI 검토 의견·자동 근거를 분야별로 한 문서에 담는다.
 * 단추를 누르면 자동 근거를 순서대로 계산(최근 10분 안에 화면에서 계산해 둔 것은 다시 계산하지 않음)한 뒤 인쇄 창을 연다.
 * 인쇄본은 화면에서 보이지 않고 인쇄할 때만 나타난다(A4 세로, 지표마다 쪽이 끊기지 않게).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { EVAL_AUTO_SOURCE_LABEL, indicatorsByGroup, readinessSummary } from '@/lib/lab/evalIndicators';
import type { EvalCheck, EvalStatus } from '@/lib/lab/labTypes';
import { collectEvidenceCached } from './EvalAutoEvidence';
import { ErrorBanner } from './LabUi';
import { companyNameStored, dotDate, errorText, todayString } from './labFormat';
import styles from './lab.module.css';

/** 인쇄본의 상태 글자 — 화면 단추(준비됨·일부·없음·해당 없음)와 맞춘다 */
const PRINT_STATUS: Record<EvalStatus, string> = {
  READY: '준비',
  PARTIAL: '일부',
  MISSING: '없음',
  NOT_APPLICABLE: '해당없음',
};

/** 자동 근거 이름은 괄호·덧붙임 앞까지만 쓴다(덧붙임은 계산 결과 줄에 이미 들어 있다) */
function shortSourceName(label: string): string {
  return label.split(/ [(—]/)[0];
}

type EvidenceResult = { ok: true; lines: string[] } | { ok: false };

interface BundleDoc {
  evidence: Record<string, EvidenceResult>;
  companyName: string;
  printedOn: string;
}

function BundleSheet({ doc, checks }: { doc: BundleDoc; checks: ReadonlyArray<EvalCheck> }) {
  const byCode = new Map(checks.map((c) => [c.indicatorCode, c]));
  const summary = readinessSummary(checks);
  const groups = indicatorsByGroup()
    .map((g) => ({ ...g, indicators: g.indicators.filter((i) => !i.deletedIn2026) }))
    .filter((g) => g.indicators.length > 0);
  return (
    <>
      <section className={styles.bundleCover}>
        <h1 className={styles.printTitle}>평가 준비 묶음</h1>
        <div className={styles.printMeta}>
          <span>기관: {doc.companyName.trim() === '' ? '______________________' : doc.companyName}</span>
          <span>인쇄일: {dotDate(doc.printedOn)}</span>
        </div>
        <p className={styles.bundleLead}>
          준비 완료 {summary.ready}/{summary.total}개 지표 ({summary.percent}%) · 일부 준비 {summary.partial} · 준비 안 됨 {summary.missing}
        </p>
        <p className={styles.printNote}>
          2026판에서 삭제된 지표와 &apos;해당 없음&apos;으로 고른 지표는 준비율에서 뺐습니다. 이 문서는 케어브이 실험실에서 만든 참고용 점검 묶음이며 공단 공식 서식이 아닙니다.
        </p>
      </section>

      {groups.map((g) => (
        <section key={g.id} className={styles.bundleGroup}>
          <h2 className={styles.bundleGroupTitle}>{g.label}</h2>
          {g.indicators.map((indicator) => {
            const check = byCode.get(indicator.code) ?? null;
            const auto = indicator.autoSource ? doc.evidence[indicator.code] : undefined;
            return (
              <article key={indicator.code} className={styles.bundleItem}>
                <h3 className={styles.bundleItemTitle}>
                  <span>
                    {indicator.code} · {indicator.title}
                  </span>
                  <span className={styles.bundleStatus}>{check ? PRINT_STATUS[check.status] : '점검 전'}</span>
                </h3>
                <ul className={styles.bundleChecklist}>
                  {indicator.requirements.map((req) => (
                    <li key={req}>
                      <span aria-hidden="true">□</span> {req}
                    </li>
                  ))}
                </ul>
                {indicator.autoSource && (
                  <div className={styles.bundleAuto}>
                    <div>자동 근거: {shortSourceName(EVAL_AUTO_SOURCE_LABEL[indicator.autoSource])}</div>
                    {auto?.ok ? auto.lines.map((line) => <div key={line}>{line}</div>) : <div>계산하지 못했습니다 — 화면에서 확인 후 다시 인쇄해 주세요</div>}
                  </div>
                )}
                <div className={styles.bundleMemo}>
                  <strong>근거 메모</strong>
                  <div>{check?.evidence?.trim() ? check.evidence : '(적은 근거 없음)'}</div>
                </div>
                {check?.aiComment?.trim() && (
                  <div className={styles.bundleMemo}>
                    <strong>AI 검토 의견 (제안)</strong>
                    <div>{check.aiComment}</div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}

      <section className={styles.bundleClosing}>
        <h2 className={styles.bundleGroupTitle}>확인해 주세요</h2>
        <ul className={styles.bundleChecklist}>
          <li>평가 당일 종료 시까지 확인된 자료만 인정됩니다. 그 뒤에 보완하거나 완납한 자료는 인정되지 않습니다.</li>
          <li>2026 평가 일정(2026.2~12월, 기관기호 끝자리 짝수 기관 대상)은 언론 보도 기준이라 공단 공지와 대조가 필요합니다.</li>
          <li>지표 번호·배점은 공개 매뉴얼을 요약한 것이라 원문과 다릅니다. 자동 근거는 케어브이에 입력된 기록으로 센 추정이므로 공단 전산·원본 서류와 대조해 주세요.</li>
        </ul>
      </section>
    </>
  );
}

interface EvalBundleButtonProps {
  checks: ReadonlyArray<EvalCheck>;
  /** 점검 내용을 아직 불러오는 중이면 누를 수 없다 */
  isDisabled?: boolean;
}

export default function EvalBundleButton({ checks, isDisabled }: EvalBundleButtonProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [doc, setDoc] = useState<BundleDoc | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    setHost(document.body);
    return () => {
      alive.current = false;
    };
  }, []);

  // 인쇄본이 그려진 다음에 인쇄 창을 열고, 창이 닫히면 인쇄본을 치운다
  useEffect(() => {
    if (!doc) return;
    const clear = () => setDoc(null);
    window.addEventListener('afterprint', clear);
    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', clear);
    };
  }, [doc]);

  const start = useCallback(async () => {
    if (progress) return;
    setError(null);
    try {
      const targets = indicatorsByGroup()
        .flatMap((g) => g.indicators)
        .filter((i) => !i.deletedIn2026 && i.autoSource);
      const evidence: Record<string, EvidenceResult> = {};
      setProgress({ done: 0, total: targets.length });
      let done = 0;
      for (const indicator of targets) {
        try {
          evidence[indicator.code] = { ok: true, lines: await collectEvidenceCached(indicator.autoSource!, indicator.code) };
        } catch {
          evidence[indicator.code] = { ok: false };
        }
        done += 1;
        if (!alive.current) return;
        setProgress({ done, total: targets.length });
      }
      setDoc({ evidence, companyName: companyNameStored(), printedOn: todayString() });
    } catch (e) {
      if (alive.current) setError(errorText(e, '평가 준비 묶음을 만들지 못했습니다'));
    } finally {
      if (alive.current) setProgress(null);
    }
  }, [progress]);

  return (
    <>
      <HStack gap={3} vAlign="center" wrap="wrap">
        <Button label="평가 준비 묶음 인쇄" variant="secondary" isLoading={progress !== null} isDisabled={isDisabled || progress !== null} onClick={() => void start()} />
        {progress ? (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" aria-label="자동 근거를 계산하는 중" />
            <Text type="supporting" color="secondary" hasTabularNumbers>
              자동 근거 계산 중 ({progress.done}/{progress.total})...
            </Text>
          </HStack>
        ) : (
          <Text type="supporting" color="secondary">
            모든 지표의 상태·요건·근거 메모를 분야별로 한 문서에 모아 인쇄합니다. 자동 근거는 인쇄 전에 순서대로 계산해 넣습니다.
          </Text>
        )}
      </HStack>
      {error && <ErrorBanner message={error} onRetry={() => void start()} />}
      {host &&
        doc &&
        createPortal(
          // 포털은 Astryx 테마 바깥(body 바로 아래)에 놓이므로, 토큰이 닿도록 테마 속성을 직접 단다
          <div className={styles.printRoot} data-lab-print-root="" data-astryx-theme="neutral">
            <style>{`
              @page { size: A4 portrait; margin: 15mm; }
              @media print {
                body > *:not([data-lab-print-root]) { display: none !important; }
                html, body { background: var(--color-background-card) !important; height: auto !important; overflow: visible !important; }
              }
            `}</style>
            <BundleSheet doc={doc} checks={checks} />
          </div>,
          host,
        )}
    </>
  );
}
