'use client';

/**
 * 실험실 첫 화면의 "오늘 확인할 것" 카드 — 계약 알림, 오늘 투약 대기, 약품 사용기한, 입소 상담 연락, 진료 후속 확인, 건강검진 기한, 사례관리 기한, 차량 보험을 한눈에 보고 누르면 그 도구로 간다.
 * 줄마다 따로 불러오고, 실패한 줄만 숨긴다(전부 실패하면 카드를 그리지 않는다).
 * 기본은 한 줄 요약(묶음 메뉴 위에서 도구 내용을 아래로 밀어내지 않게)이고, '자세히'를 누르면 줄마다 미리보기가 펼쳐진다. 펼침 상태는 이 브라우저에 기억한다.
 * 투약 대기는 의뢰서와 투약 기록만 보고 센 것이라 오늘 출결은 반영하지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip } from './LabUi';
import { NOTHING_TO_CHECK, loadContractLine, loadDoseLine, loadIntakeLine, loadHealthLine, loadStockLine, loadVisitLine, loadCaseMeetingLine, loadVehicleLine } from './LabTodayData';
import type { TodayLine, TodayLineId, TodayTarget } from './LabTodayData';
import { readStored, todayString, writeStored } from './labFormat';
import styles from './lab.module.css';

/** 접힌 줄에 보일 칩 수 — 넘으면 '+N' */
const MAX_PILLS = 5;
const EXPANDED_KEY = 'carev.lab.todayExpanded';

type LineState = { status: 'loading' } | { status: 'failed' } | { status: 'ok'; line: TodayLine };

const LINES: ReadonlyArray<{ id: TodayLineId; title: string; note: string | null; target: TodayTarget; actionLabel: string; load: (today: string) => Promise<TodayLine> }> = [
  { id: 'contract', title: '계약 알림', note: null, target: 'contract', actionLabel: '계약·인정 열기', load: loadContractLine },
  { id: 'dose', title: '오늘 투약 대기', note: '의뢰 기준 · 출결은 반영하지 않음', target: 'medication', actionLabel: '투약 관리 열기', load: loadDoseLine },
  { id: 'stock', title: '약품 사용기한', note: null, target: 'medication', actionLabel: '투약 관리 열기', load: loadStockLine },
  { id: 'intake', title: '입소 상담 연락', note: '연락 예정일이 오늘이거나 지난 상담', target: 'intake', actionLabel: '입소 상담·대기 열기', load: loadIntakeLine },
  { id: 'visit', title: '진료 후속 확인', note: '후속 확인일이 오늘이거나 지났는데 확인 전인 진료 동행', target: 'medicalVisit', actionLabel: '진료 동행 열기', load: loadVisitLine },
  { id: 'health', title: '건강검진 기한', note: '마지막 검진 후 1년(사무직 2년)이 지났거나 30일 안에 닿는 직원 · 검진 기록이 아직 없는 직원은 직원 인사에서 확인', target: 'staffHr', actionLabel: '직원 인사 열기', load: loadHealthLine },
  { id: 'caseMeeting', title: '사례관리 기한', note: '회의 다음날부터 30일 안에 반영·평가해야 하는 사례관리 대상 · 올해·작년 회의 기준', target: 'caseMeeting', actionLabel: '사례관리 회의 열기', load: loadCaseMeetingLine },
  { id: 'vehicle', title: '차량 보험', note: '쓰는 차량 중 보험 만기가 지났거나 30일 안이거나 종합보험이 아닌 차량', target: 'transport', actionLabel: '송영 일지 열기', load: loadVehicleLine },
];

interface LabTodayProps {
  /** 줄을 눌렀을 때 도구를 연다 — LabHome의 도구 고르기 함수 */
  onOpenTool: (tool: TodayTarget) => void;
  /** 값이 바뀌면(도구를 옮기면) 다시 불러온다. 투약·계약을 고치고 돌아왔을 때 숫자가 낡지 않게 한다 */
  refreshKey: string;
}

export default function LabToday({ onOpenTool, refreshKey }: LabTodayProps) {
  const [expanded, setExpanded] = useState(false);
  const [states, setStates] = useState<Record<TodayLineId, LineState>>({ contract: { status: 'loading' }, dose: { status: 'loading' }, stock: { status: 'loading' }, intake: { status: 'loading' }, visit: { status: 'loading' }, health: { status: 'loading' }, caseMeeting: { status: 'loading' }, vehicle: { status: 'loading' } });
  const seq = useRef(0);

  // 저장된 값은 브라우저에서만 읽을 수 있으므로 첫 그림 뒤에 반영한다
  useEffect(() => {
    setExpanded(readStored(EXPANDED_KEY) === '1');
  }, []);

  const load = useCallback(() => {
    const n = ++seq.current;
    const today = todayString();
    for (const line of LINES) {
      line
        .load(today)
        .then((result) => {
          if (n === seq.current) setStates((prev) => ({ ...prev, [line.id]: { status: 'ok', line: result } }));
        })
        .catch(() => {
          // 숫자가 이미 보이던 줄은 낡은 숫자를 남기지 않고 숨긴다
          if (n === seq.current) setStates((prev) => ({ ...prev, [line.id]: { status: 'failed' } }));
        });
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      seq.current += 1;
    };
  }, [load, refreshKey]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    writeStored(EXPANDED_KEY, next ? '1' : '0');
  };

  const shown = LINES.filter((l) => states[l.id].status !== 'failed');
  if (shown.length === 0) return null;
  const total = shown.reduce((sum, l) => {
    const s = states[l.id];
    return sum + (s.status === 'ok' ? s.line.count : 0);
  }, 0);
  const loaded = shown.every((l) => states[l.id].status === 'ok');
  // 접힌 줄은 한 줄을 넘지 않게: 확인할 것이 있는 줄만, 급한 것(빨강)부터 최대 MAX_PILLS개, 나머지는 '+N'으로 펼친다
  const urgentRank = (id: TodayLineId): number => {
    const st = states[id];
    return st.status === 'ok' && st.line.danger ? 1 : 0;
  };
  const pending = shown.filter((l) => {
    const st = states[l.id];
    return st.status === 'ok' && st.line.count > 0;
  });
  const ordered = pending.map((l, i) => ({ l, i })).sort((a, b) => urgentRank(b.l.id) - urgentRank(a.l.id) || a.i - b.i).map((x) => x.l);
  const pills = ordered.slice(0, MAX_PILLS);
  const morePills = ordered.length - pills.length;
  const loadingCount = shown.filter((l) => states[l.id].status === 'loading').length;

  return (
    <Card padding={0}>
      <div className={styles.todayBar}>
        <Text type="label">오늘 확인할 것</Text>
        {/* 휴대폰에서는 칩 대신 합계 하나만 — 펼치면 아래 줄별 상세가 나온다 */}
        <span className={styles.todayTotalMobile}>
          {loaded ? <Chip tone={total > 0 ? 'warn' : 'ok'} label={total > 0 ? `${total}건` : NOTHING_TO_CHECK} /> : <Spinner size="sm" aria-label="오늘 확인할 것을 불러오는 중" />}
        </span>
        <div className={styles.todayPills}>
          {pills.map((l) => {
            const st = states[l.id];
            if (st.status !== 'ok') return null;
            return (
              <button key={l.id} type="button" className={styles.todayPill} aria-label={`${l.title}: ${st.line.text}. ${l.actionLabel}`} onClick={() => onOpenTool(l.target)}>
                <span className={styles.todayPillTitle}>
                  <Text type="supporting">{l.title}</Text>
                </span>
                {/* 접힌 줄에는 숫자만 — 자세한 글은 '자세히'와 읽어 주는 이름에 있다 */}
                <Chip tone={st.line.danger ? 'danger' : 'warn'} label={String(st.line.count)} />
              </button>
            );
          })}
          {morePills > 0 && (
            <button type="button" className={styles.todayPill} aria-label={`확인할 것 ${morePills}가지 더 보기`} onClick={toggle}>
              <Text type="supporting">+{morePills}</Text>
            </button>
          )}
          {loadingCount > 0 && (
            <span className={styles.todayPillStatic}>
              <Spinner size="sm" aria-label="오늘 확인할 것을 불러오는 중" />
              <Text type="supporting" color="secondary">
                {loadingCount}가지 불러오는 중
              </Text>
            </span>
          )}
          {loaded && total === 0 && <Chip tone="ok" label={NOTHING_TO_CHECK} />}
        </div>
        <Button label={expanded ? '간단히' : '자세히'} size="sm" variant="ghost" aria-expanded={expanded} onClick={toggle} />
      </div>
      {expanded &&
        shown.map((l) => {
          const s = states[l.id];
          if (s.status !== 'ok') return null;
          const { line } = s;
          return (
            <button key={l.id} type="button" className={styles.todayRow} aria-label={`${l.title}: ${line.text}. ${l.actionLabel}`} onClick={() => onOpenTool(l.target)}>
              <VStack gap={0.5}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text type="body" weight="medium">
                    {l.title}
                  </Text>
                  <Chip tone={line.count === 0 ? 'ok' : line.danger ? 'danger' : 'warn'} label={line.text} />
                </HStack>
                {line.preview && (
                  <span className={styles.todayPreview}>
                    <Text type="supporting" color="secondary">
                      {line.preview}
                    </Text>
                  </span>
                )}
                {l.note && (
                  <Text type="supporting" color="secondary">
                    {l.note}
                  </Text>
                )}
              </VStack>
              <span className={styles.todayOpen}>
                <Text type="supporting" color="secondary">
                  열기
                </Text>
              </span>
            </button>
          );
        })}
    </Card>
  );
}
