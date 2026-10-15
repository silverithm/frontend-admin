'use client';

/** 하루 기록 — 날짜를 고르고, 어르신 목록에서 한 분씩 기록한다. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listCareRecordsByDate } from '@/lib/lab/labApi';
import { findVaguePhrases } from '@/lib/lab/careRecordQuality';
import { COGNITIVE_STATE_LABEL, cognitiveCoverage, isCognitiveRequiredGrade } from '@/lib/lab/cognitiveProgramRules';
import type { CognitiveState } from '@/lib/lab/cognitiveProgramRules';
import type { CareRecord } from '@/lib/lab/labTypes';
import { useDayAttendance } from './CareRecordLabAttendance';
import CareRecordLabEditor from './CareRecordLabEditor';
import { useCareStaff, useDayPrograms } from './CareRecordLabSources';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, SupportText } from './LabUi';
import { careFieldsOf, dateLabel, errorText, todayString } from './labFormat';
import type { LabElder } from './useLabElders';
import styles from './lab.module.css';
import formStyles from './labForm.module.css';

interface CareDailyViewProps {
  elders: LabElder[];
  eldersLoading: boolean;
}

export default function CareRecordLabDaily({ elders, eldersLoading }: CareDailyViewProps) {
  const [date, setDate] = useState(todayString);
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  // 출석한 어르신만 보기(기본 켬). 출석 정보가 없거나 불러오지 못하면 거르지 않는다.
  const [onlyPresent, setOnlyPresent] = useState(true);
  const attendance = useDayAttendance(date);
  const { staff, error: staffError } = useCareStaff();
  const { programs, error: programsError } = useDayPrograms(date);
  const seq = useRef(0);

  const load = useCallback(async (target: string) => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listCareRecordsByDate(target);
      if (id !== seq.current) return; // 날짜를 빨리 넘길 때 늦게 온 응답은 버린다
      setRecords(list);
    } catch (e) {
      if (id !== seq.current) return;
      setRecords([]);
      setError(errorText(e, '급여제공기록을 불러오지 못했습니다'));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const byElder = useMemo(() => new Map(records.map((r) => [r.elderlyId, r])), [records]);
  // 5등급·인지지원 어르신의 인지활동형 제공 상태 — 그날 출석한 분(출결 기록이 없는 날은 기록을 남긴 분)만 본다. 프로그램 일지를 못 읽었으면 표시하지 않는다.
  const cognitive = useMemo(() => {
    const map = new Map<number, CognitiveState>();
    if (!programs || attendance.isLoading) return map;
    const attendees = elders
      .filter((e) => isCognitiveRequiredGrade(e.careGrade) && (attendance.hasData ? attendance.statuses.get(e.id) === 'PRESENT' : byElder.has(e.id)))
      .map((e) => ({ elderlyId: e.id, careGrade: e.careGrade }));
    for (const row of cognitiveCoverage(date, attendees, programs)) map.set(row.elderlyId, row.state);
    return map;
  }, [programs, attendance.isLoading, attendance.hasData, attendance.statuses, elders, byElder, date]);
  const warnCount = useCallback((r: CareRecord | undefined) => (r ? findVaguePhrases(careFieldsOf(r)).length : 0), []);

  // 저장하지 않은 내용이 있으면 이동 전에 한 번 묻는다
  const guarded = useCallback(
    (action: () => void) => {
      if (dirty) setPendingNav(() => action);
      else action();
    },
    [dirty],
  );

  const changeDate = (value: string) => {
    if (!value || value === date) return;
    guarded(() => {
      setSelectedId(null);
      setDate(value);
    });
  };

  const selectElder = (id: number) => {
    if (id === selectedId) return;
    guarded(() => setSelectedId(id));
  };

  // 그날 출결 기록이 있고 출석을 거르는 중이면 출석한 분만 보인다. 이미 기록한 분은 늘 보인다.
  const filtering = onlyPresent && attendance.hasData && !attendance.isLoading;
  const visibleElders = useMemo(
    () => (filtering ? elders.filter((e) => attendance.statuses.get(e.id) === 'PRESENT' || byElder.has(e.id) || e.id === selectedId) : elders),
    [filtering, elders, attendance.statuses, byElder, selectedId],
  );
  const hiddenCount = elders.length - visibleElders.length;
  const selected = elders.find((e) => e.id === selectedId) ?? null;
  const recordedCount = visibleElders.filter((e) => byElder.has(e.id)).length;

  const handleSaved = useCallback((record: CareRecord) => {
    setRecords((prev) => [...prev.filter((r) => r.elderlyId !== record.elderlyId), record]);
  }, []);
  const handleDeleted = useCallback((recordId: number) => {
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
  }, []);
  const handleBack = useCallback(() => guarded(() => setSelectedId(null)), [guarded]);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGrow} style={{ maxWidth: 220 }}>
          <LabDateInput label="기록 날짜" value={date} onChange={changeDate} max={todayString()} />
        </div>
        <Button
          label="오늘로"
          variant="ghost"
          isDisabled={date === todayString()}
          onClick={() => changeDate(todayString())}
        />
        <Text type="supporting" color="secondary">
          {dateLabel(date)} · 기록 {recordedCount}/{visibleElders.length}명
        </Text>
      </div>

      <div className={styles.toolbar}>
        <Switch label="출석한 어르신만" value={onlyPresent} onChange={setOnlyPresent} />
        {attendance.isLoading ? (
          <SupportText>출석 정보를 확인하는 중...</SupportText>
        ) : attendance.error ? (
          <SupportText tone="warn">{attendance.error}</SupportText>
        ) : !attendance.hasData ? (
          <SupportText>이 날은 출석 기록이 없어 모든 어르신을 보여 드립니다.</SupportText>
        ) : filtering && hiddenCount > 0 ? (
          <SupportText>출석 기록이 없는 {hiddenCount}분은 숨겼습니다. 끄면 모두 보입니다.</SupportText>
        ) : null}
      </div>

      {programsError && elders.some((e) => isCognitiveRequiredGrade(e.careGrade)) && (
        <SupportText tone="warn">프로그램 일지를 불러오지 못해 5등급·인지지원 어르신의 인지활동형 상태를 표시하지 못했습니다. {programsError}</SupportText>
      )}

      {error && <ErrorBanner message={error} onRetry={() => void load(date)} />}

      {eldersLoading ? (
        <Loading size="inline" label="어르신 목록을 불러오는 중..." />
      ) : elders.length === 0 ? (
        <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />
      ) : visibleElders.length === 0 ? (
        <EmptyState title="이 날 출석한 어르신이 없습니다" description="‘출석한 어르신만’을 끄면 모든 어르신을 볼 수 있어요." />
      ) : (
        <div className={styles.split} data-has-selection={selected ? 'true' : 'false'}>
          <div className={styles.splitList}>
            <Card padding={0}>
              {loading && records.length === 0 ? (
                <Loading size="inline" label="기록을 불러오는 중..." />
              ) : (
                <nav aria-label="어르신 목록">
                  {visibleElders.map((elder) => {
                    const record = byElder.get(elder.id);
                    const warns = warnCount(record);
                    const cogState = cognitive.get(elder.id);
                    return (
                      <button
                        key={elder.id}
                        type="button"
                        className={styles.elderButton}
                        aria-current={elder.id === selectedId}
                        disabled={loading}
                        onClick={() => selectElder(elder.id)}
                      >
                        <span className={formStyles.elderStack}>
                          <span className={formStyles.elderRow}>
                            <Text type="body" weight="medium">
                              {elder.name}
                            </Text>
                            <span className={styles.chips}>
                              {attendance.statuses.get(elder.id) === 'PRESENT' && <Chip tone="info" label="출석" />}
                              {attendance.statuses.get(elder.id) === 'ABSENT' && <Chip tone="neutral" label="결석" />}
                              {cogState === 'OK' && <Chip tone="ok" label="인지활동형 제공됨" />}
                              {cogState && cogState !== 'OK' && <Chip tone="warn" label="인지활동형 누락" />}
                              {warns > 0 && <Chip tone="warn" label={`문구 주의 ${warns}`} />}
                              <Chip tone={record ? 'ok' : 'neutral'} label={record ? '기록 있음' : '기록 없음'} />
                            </span>
                          </span>
                          {cogState && cogState !== 'OK' && (
                            <span className={formStyles.cogNote}>
                              <Text type="supporting" weight="medium">
                                인지활동형 누락 — 그날 급여비용 산정 불가(고시 제32조⑩), 예외는 사유 기재
                              </Text>
                              <br />
                              <Text type="supporting" color="secondary">
                                {COGNITIVE_STATE_LABEL[cogState]}
                              </Text>
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              )}
            </Card>
          </div>
          <div className={styles.splitDetail}>
            {selected ? (
              <CareRecordLabEditor
                key={`${selected.id}-${date}`}
                elderId={selected.id}
                elderName={selected.name}
                date={date}
                record={byElder.get(selected.id) ?? null}
                careGrade={selected.careGrade}
                absent={attendance.statuses.get(selected.id) === 'ABSENT'}
                programs={programs}
                programsError={programsError}
                staff={staff}
                staffError={staffError}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                onDirtyChange={setDirty}
                onBack={handleBack}
              />
            ) : (
              <Card padding={6}>
                <EmptyState
                  isCompact
                  title="왼쪽에서 어르신을 골라 주세요"
                  description="기록이 없는 분부터 메모를 적고 AI로 정리해 보세요."
                />
              </Card>
            )}
          </div>
        </div>
      )}

      <LabConfirm
        isOpen={pendingNav !== null}
        title="저장하지 않은 내용이 있습니다"
        description="이동하면 지금 적은 내용이 사라집니다. 그래도 이동할까요?"
        actionLabel="이동"
        onConfirm={() => {
          const action = pendingNav;
          setPendingNav(null);
          setDirty(false);
          action?.();
        }}
        onClose={() => setPendingNav(null)}
      />
    </div>
  );
}
