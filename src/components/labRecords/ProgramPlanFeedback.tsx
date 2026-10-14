'use client';

/**
 * 프로그램 의견수렴 — 올해 상반기·하반기 수렴 여부(반기마다 1회 이상)와 반영 여부(연 1회 이상), 기록 목록과 편집.
 * 평가 24~26 기준③. 프로그램 만족도 응답 요약은 '급여 만족도' 화면에서 본다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listProgramFeedback } from '@/lib/lab/labApi';
import type { ProgramFeedback } from '@/lib/lab/labTypes';
import { FEEDBACK_METHODS, feedbackStatus, halfLabel } from '@/lib/lab/programPlanRules';
import { Chip, ErrorBanner, SupportText, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText, todayString } from '@/components/lab/labFormat';
import ProgramPlanFeedbackEditor from './ProgramPlanFeedbackEditor';
import { YearStepper } from './RecordsUi';
import styles from './labRecords.module.css';
import own from './ProgramPlan.module.css';

export default function ProgramPlanFeedback() {
  const notify = useNotify();
  const thisYear = Number(todayString().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [list, setList] = useState<ProgramFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProgramFeedback | 'new' | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (target: number) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await listProgramFeedback(target);
      if (n !== seq.current) return;
      setList(rows);
    } catch (e) {
      if (n !== seq.current) return;
      setList([]);
      setError(errorText(e, '프로그램 의견수렴 기록을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(year);
    return () => {
      seq.current += 1;
    };
  }, [year, load]);

  const status = useMemo(() => feedbackStatus(list, year), [list, year]);
  const sorted = useMemo(() => [...list].sort((a, b) => (a.collectedOn < b.collectedOn ? 1 : -1)), [list]);
  const methodText = (m: string) => FEEDBACK_METHODS.find((x) => x.value === m)?.label ?? m;
  const refresh = () => {
    setEditing(null);
    void load(year);
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <YearStepper
          value={year}
          onChange={(y) => {
            setEditing(null);
            setYear(y);
          }}
          isDisabled={loading}
          max={thisYear}
        />
        <div className={styles.spacer}>
          <Button label="의견수렴 기록 쓰기" variant="primary" isDisabled={loading || !!error} onClick={() => setEditing('new')} />
        </div>
      </div>

      <SupportText>평가 24·25·26 기준③: 어르신·보호자 의견을 반기마다 1회 이상 모으고, 그 내용을 1년에 한 번 이상 프로그램에 반영합니다.</SupportText>

      {error && <ErrorBanner message={error} onRetry={() => void load(year)} />}

      {!error && (
        <div className={own.halfGrid}>
          {([['h1', 'H1'], ['h2', 'H2']] as const).map(([key, code]) => (
            <Card key={key} padding={4}>
              <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
                <Text type="label">{halfLabel(`${year}-${code}`)}</Text>
                {loading ? <Chip tone="neutral" label="확인 중" /> : status[key] ? <Chip tone="ok" label="수렴함" /> : <Chip tone="danger" label="수렴 전" />}
              </HStack>
            </Card>
          ))}
          <Card padding={4}>
            <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
              <Text type="label">{year}년 반영</Text>
              {loading ? <Chip tone="neutral" label="확인 중" /> : status.reflected ? <Chip tone="ok" label="반영함" /> : <Chip tone="warn" label="반영 전" />}
            </HStack>
          </Card>
        </div>
      )}

      {editing && (
        <ProgramPlanFeedbackEditor
          key={editing === 'new' ? 'new' : editing.id}
          year={year}
          feedback={editing === 'new' ? null : editing}
          onSaved={(saved, isNew) => {
            notify(isNew ? '의견수렴 기록을 저장했습니다' : '의견수렴 기록을 고쳤습니다', 'success');
            // 다른 해 날짜로 저장했어도 이 해 목록을 다시 불러온다
            refresh();
            if (!saved.collectedOn.startsWith(`${year}-`)) setYear(Number(saved.collectedOn.slice(0, 4)));
          }}
          onDeleted={() => {
            notify('의견수렴 기록을 삭제했습니다', 'success');
            refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {loading && list.length === 0 && !error ? (
        <Loading size="inline" label="의견수렴 기록을 불러오는 중..." />
      ) : !error && sorted.length === 0 ? (
        <Card padding={6}>
          <EmptyState isCompact title={`${year}년 의견수렴 기록이 없습니다`} description="설문·면담·회의로 들은 의견을 요약하고, 프로그램에 반영한 내용까지 남겨 두세요." actions={<Button label="의견수렴 기록 쓰기" variant="secondary" onClick={() => setEditing('new')} />} />
        </Card>
      ) : (
        !error && (
          <Card padding={0}>
            {sorted.map((f) => (
              <div key={f.id} className={own.feedbackRow}>
                <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
                  <Text type="label">
                    {halfLabel(f.half)} · {dotDate(f.collectedOn)} · {methodText(f.method)} · {f.participants}명
                  </Text>
                  <HStack gap={2} vAlign="center">
                    {f.reflectedOn ? <Chip tone="ok" label={`반영 ${dotDate(f.reflectedOn)}`} /> : <Chip tone="neutral" label="반영 전" />}
                    <Button label="고치기" variant="ghost" onClick={() => setEditing(f)} />
                  </HStack>
                </HStack>
                <div className={own.clamp}>
                  <Text type="supporting">{f.summary}</Text>
                </div>
                {f.reflection && (
                  <div className={own.clamp}>
                    <Text type="supporting" color="secondary">
                      반영: {f.reflection}
                    </Text>
                  </div>
                )}
              </div>
            ))}
          </Card>
        )
      )}

      <Card padding={4}>
        <Text type="supporting" color="secondary">
          프로그램에 대한 어르신·보호자 만족도 응답은 ‘급여 만족도’ 화면에서 프로그램 종류로 고르면 문항별 평균과 의견을 볼 수 있습니다. 거기서 본 내용을 의견 요약에 옮겨 적으면 편합니다.
        </Text>
      </Card>
    </div>
  );
}
