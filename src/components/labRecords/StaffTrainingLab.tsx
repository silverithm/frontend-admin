'use client';

/**
 * 직원 교육·회의 — 위쪽은 올해 법정 교육 이수 현황, 아래는 연도별 교육·회의 목록.
 * 직원별로 빠진 법정 교육을 보고, 버튼 한 번으로 "빠진 직원이 참석자로 채워진" 새 기록을 열 수 있다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listLabStaff, listStaffTrainings } from '@/lib/lab/labApi';
import type { LabStaff, LegalTrainingCategory, StaffTraining } from '@/lib/lab/labTypes';
import { TRAINING_KIND_LABEL, trainingCategoryLabel } from '@/lib/lab/trainingRules';
import { AiChip, Chip, ErrorBanner, useNotify } from '@/components/lab/LabUi';
import { dateLabel, errorText, todayString } from '@/components/lab/labFormat';
import StaffTrainingCoverage from './StaffTrainingCoverage';
import StaffTrainingEditor from './StaffTrainingEditor';
import { isLegal } from './StaffTrainingDraft';
import type { TrainingPreset } from './StaffTrainingDraft';
import { YearStepper } from './RecordsUi';
import { yearOf } from './recordsFormat';
import styles from './labRecords.module.css';

type KindFilter = 'ALL' | 'TRAINING' | 'MEETING';
const NAME_PREVIEW = 6;

interface EditState {
  training: StaffTraining | null;
  preset: TrainingPreset;
}

/** 새 기록의 기본 날짜 — 올해면 오늘, 지난 해면 그 해의 마지막 날 */
function defaultDate(year: number): string {
  const today = todayString();
  return yearOf(today) === year ? today : `${year}-12-31`;
}

export default function StaffTrainingLab() {
  const notify = useNotify();
  const thisYear = yearOf(todayString());
  const [year, setYear] = useState(thisYear);
  const [trainings, setTrainings] = useState<StaffTraining[]>([]);
  const [staff, setStaff] = useState<LabStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [filter, setFilter] = useState<KindFilter>('ALL');
  const [editing, setEditing] = useState<EditState | null>(null);
  const seq = useRef(0);
  const staffSeq = useRef(0);

  const load = useCallback(async (target: number) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listStaffTrainings(target);
      if (n !== seq.current) return; // 연도를 빨리 넘길 때 늦게 온 응답은 버린다
      setTrainings(list);
    } catch (e) {
      if (n !== seq.current) return;
      setTrainings([]);
      setError(errorText(e, '직원 교육·회의 기록을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  const loadStaff = useCallback(async () => {
    const n = ++staffSeq.current;
    setStaffError(null);
    try {
      const list = await listLabStaff();
      if (n === staffSeq.current) setStaff([...list].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
    } catch (e) {
      if (n === staffSeq.current) setStaffError(errorText(e, '직원 목록을 불러오지 못했습니다'));
    } finally {
      if (n === staffSeq.current) setStaffLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load(year);
    return () => {
      seq.current += 1;
    };
  }, [year, load]);

  useEffect(() => {
    void loadStaff();
    return () => {
      staffSeq.current += 1;
    };
  }, [loadStaff]);

  const shown = useMemo(
    () => [...trainings].filter((t) => filter === 'ALL' || t.kind === filter).sort((a, b) => (a.heldOn < b.heldOn ? 1 : a.heldOn > b.heldOn ? -1 : b.id - a.id)),
    [trainings, filter],
  );

  const startNew = (preset?: Partial<TrainingPreset>) => setEditing({ training: null, preset: { date: defaultDate(year), ...preset } });
  const afterChange = () => {
    setEditing(null);
    void load(year);
  };

  if (editing) {
    return (
      <div className={styles.stack}>
        <StaffTrainingEditor
          key={editing.training?.id ?? `new-${editing.preset.category ?? ''}-${editing.preset.kind ?? ''}`}
          staff={staff}
          training={editing.training}
          preset={editing.preset}
          onSaved={(saved, isNew) => {
            notify(isNew ? '교육·회의 기록을 저장했습니다' : '교육·회의 기록을 수정했습니다', 'success');
            afterChange();
            // 다른 연도 날짜로 저장했다면 그 연도로 따라간다
            if (yearOf(saved.heldOn) !== year) setYear(yearOf(saved.heldOn));
          }}
          onDeleted={() => afterChange()}
          onClose={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={setYear} isDisabled={loading} max={thisYear} />
        <Text type="supporting" color="secondary">
          {year}년 교육·회의 {trainings.length}건
        </Text>
        <div className={styles.spacer}>
          <HStack gap={2}>
            <Button label="회의 기록 쓰기" variant="secondary" onClick={() => startNew({ kind: 'MEETING' })} />
            <Button label="교육 기록 쓰기" variant="primary" onClick={() => startNew({ kind: 'TRAINING' })} />
          </HStack>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void load(year)} />}
      {staffError && <ErrorBanner message={staffError} onRetry={() => void loadStaff()} />}

      {(loading && trainings.length === 0) || !staffLoaded ? (
        <Loading size="inline" label="불러오는 중..." />
      ) : (
        <StaffTrainingCoverage
          staff={staff}
          trainings={trainings}
          year={year}
          onRecordCategory={(category: LegalTrainingCategory, missingIds: number[]) => startNew({ kind: 'TRAINING', category, attendeeIds: missingIds })}
        />
      )}

      <SegmentedControl label="종류 거르기" value={filter} onChange={(v) => setFilter(v as KindFilter)}>
        <SegmentedControlItem value="ALL" label="전체" />
        <SegmentedControlItem value="TRAINING" label="교육" />
        <SegmentedControlItem value="MEETING" label="회의" />
      </SegmentedControl>

      {shown.length === 0 && !loading && !error ? (
        <Card padding={6}>
          <EmptyState
            isCompact
            title={`${year}년에는 ${filter === 'MEETING' ? '회의' : filter === 'TRAINING' ? '교육' : '교육·회의'} 기록이 없습니다`}
            description="교육이나 회의를 마치면 참석자를 골라 바로 남겨 주세요. 평가는 참석자가 적힌 기록으로 확인합니다."
            actions={<Button label="교육 기록 쓰기" variant="secondary" onClick={() => startNew({ kind: 'TRAINING' })} />}
          />
        </Card>
      ) : (
        <Card padding={0}>
          {shown.map((t) => (
            <div className={styles.rowBlock} key={t.id}>
              <VStack gap={2}>
                <div className={styles.rowHead}>
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Chip tone={t.kind === 'TRAINING' ? 'info' : 'neutral'} label={TRAINING_KIND_LABEL[t.kind]} />
                    <Chip tone={t.kind === 'TRAINING' && isLegal(t.category) ? 'ok' : 'neutral'} label={`${trainingCategoryLabel(t.category)}${t.kind === 'TRAINING' && isLegal(t.category) ? ' · 법정' : ''}`} />
                    {t.aiAssisted && <AiChip label="AI 도움" />}
                  </HStack>
                  <Button label="수정" variant="ghost" onClick={() => setEditing({ training: t, preset: { date: t.heldOn.slice(0, 10) } })} />
                </div>
                <Text type="body" weight="medium">
                  {t.topic}
                </Text>
                <Text type="supporting" color="secondary">
                  {dateLabel(t.heldOn.slice(0, 10))}
                  {t.instructor ? ` · ${t.instructor}` : ''} · 참석 {t.attendeeIds.length}명
                  {t.attendeeNames.length > 0 ? ` (${t.attendeeNames.slice(0, NAME_PREVIEW).join(', ')}${t.attendeeNames.length > NAME_PREVIEW ? ` 외 ${t.attendeeNames.length - NAME_PREVIEW}명` : ''})` : ''}
                </Text>
              </VStack>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
