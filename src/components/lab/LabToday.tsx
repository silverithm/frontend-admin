'use client';

/**
 * 실험실 첫 화면의 "오늘 확인할 것" 카드 — 계약 알림, 오늘 투약 대기, 약품 사용기한을 한눈에 보고 누르면 그 도구로 간다.
 * 줄마다 따로 불러오고, 실패한 줄만 숨긴다(셋 다 실패하면 카드를 그리지 않는다). 접힘 상태는 이 브라우저에 기억한다.
 * 투약 대기는 의뢰서와 투약 기록만 보고 센 것이라 오늘 출결은 반영하지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip } from './LabUi';
import { NOTHING_TO_CHECK, loadContractLine, loadDoseLine, loadStockLine } from './LabTodayData';
import type { TodayLine, TodayLineId, TodayTarget } from './LabTodayData';
import { readStored, todayString, writeStored } from './labFormat';
import styles from './lab.module.css';

const COLLAPSED_KEY = 'carev.lab.todayCollapsed';

type LineState = { status: 'loading' } | { status: 'failed' } | { status: 'ok'; line: TodayLine };

const LINES: ReadonlyArray<{ id: TodayLineId; title: string; note: string | null; target: TodayTarget; actionLabel: string; load: (today: string) => Promise<TodayLine> }> = [
  { id: 'contract', title: '계약 알림', note: null, target: 'contract', actionLabel: '계약·인정 열기', load: loadContractLine },
  { id: 'dose', title: '오늘 투약 대기', note: '의뢰 기준 · 출결은 반영하지 않음', target: 'medication', actionLabel: '투약 관리 열기', load: loadDoseLine },
  { id: 'stock', title: '약품 사용기한', note: null, target: 'medication', actionLabel: '투약 관리 열기', load: loadStockLine },
];

interface LabTodayProps {
  /** 줄을 눌렀을 때 도구를 연다 — LabHome의 도구 고르기 함수 */
  onOpenTool: (tool: TodayTarget) => void;
  /** 값이 바뀌면(도구를 옮기면) 다시 불러온다. 투약·계약을 고치고 돌아왔을 때 숫자가 낡지 않게 한다 */
  refreshKey: string;
}

export default function LabToday({ onOpenTool, refreshKey }: LabTodayProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [states, setStates] = useState<Record<TodayLineId, LineState>>({ contract: { status: 'loading' }, dose: { status: 'loading' }, stock: { status: 'loading' } });
  const seq = useRef(0);

  // 저장된 값은 브라우저에서만 읽을 수 있으므로 첫 그림 뒤에 반영한다
  useEffect(() => {
    setCollapsed(readStored(COLLAPSED_KEY) === '1');
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
    const next = !collapsed;
    setCollapsed(next);
    writeStored(COLLAPSED_KEY, next ? '1' : '0');
  };

  const shown = LINES.filter((l) => states[l.id].status !== 'failed');
  if (shown.length === 0) return null;
  const total = shown.reduce((sum, l) => {
    const s = states[l.id];
    return sum + (s.status === 'ok' ? s.line.count : 0);
  }, 0);
  const loaded = shown.every((l) => states[l.id].status === 'ok');

  return (
    <Card padding={0}>
      <div className={styles.rowHead} style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">오늘 확인할 것</Text>
          {loaded && <Chip tone={total > 0 ? 'warn' : 'ok'} label={total > 0 ? `${total}건` : NOTHING_TO_CHECK} />}
        </HStack>
        <Button label={collapsed ? '펼치기' : '접기'} size="sm" variant="ghost" aria-expanded={!collapsed} onClick={toggle} />
      </div>
      {!collapsed &&
        shown.map((l) => {
          const s = states[l.id];
          if (s.status === 'loading') {
            return (
              <div key={l.id} className={`${styles.todayRow} ${styles.todayRowStatic}`}>
                <HStack gap={2} vAlign="center">
                  <Spinner size="sm" aria-label={`${l.title}을 불러오는 중`} />
                  <Text type="supporting" color="secondary">
                    {l.title} 불러오는 중...
                  </Text>
                </HStack>
              </div>
            );
          }
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
              <Text type="supporting" color="secondary">
                열기
              </Text>
            </button>
          );
        })}
    </Card>
  );
}
