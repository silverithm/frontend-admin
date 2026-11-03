'use client';

/**
 * 운행일지 쓰기 — 운전원·동승자, 출발·도착 시각, 탑승자(그날 출석한 어르신으로 채움), 어르신별 탑승·승하차 시각, 특이사항.
 * 같은 날·등원/하원·차량의 일지가 있으면 고쳐 쓰고(upsert), 저장 단추는 두 번 눌러도 한 번만 저장한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { saveTransportLog } from '@/lib/lab/labApi';
import { doneFirst, isRiderDone, mergePickedRiders, placeRider } from '@/lib/lab/transportRiderOrder';
import type { LabStaff, TransportDirection, TransportLog } from '@/lib/lab/labTypes';
import { ErrorBanner, SupportText, useNotify } from '@/components/lab/LabUi';
import { dateLabel, errorText, readStored, writeStored } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import PersonPicker from './PersonPicker';
import { TimeField } from './RecordsUi';
import { useAlive } from './recordsFormat';
import TransportRiderRow from './TransportRiderRow';
import { DIRECTION_LABEL, DRIVER_KEY, ESCORT_KEY, LOG_NOTE_MAX, MAX_RIDERS, draftFromLog, logInput, newRider, validateLog } from './TransportDraft';
import type { LogDraft, RiderDraft } from './TransportDraft';
import styles from './labRecords.module.css';
import own from './Transport.module.css';

interface Props {
  date: string;
  direction: TransportDirection;
  vehicleNo: string;
  existing: TransportLog | null;
  elders: LabElder[];
  staff: LabStaff[];
  /** 그날 출석한 어르신 id와 출결 기록이 있었는지 */
  present: Set<number>;
  hasAttendance: boolean;
  attendanceError: string | null;
  onSaved: () => void;
}

const NONE = 'none';

function firstDraft(props: Props): LogDraft {
  if (props.existing) {
    // 불러온 일지도 다 적은 분부터 — 이어 적을 분이 그 아래에 모인다
    const loaded = draftFromLog(props.existing);
    return { ...loaded, riders: doneFirst(loaded.riders, props.direction) };
  }
  const riders = props.hasAttendance ? props.elders.filter((e) => props.present.has(e.id)).slice(0, MAX_RIDERS).map((e) => newRider(e.id, e.name)) : [];
  const staffIds = new Set(props.staff.map((s) => s.id));
  const stored = (key: string): number | null => {
    const n = Number(readStored(key));
    return Number.isInteger(n) && staffIds.has(n) ? n : null;
  };
  return { driverId: stored(DRIVER_KEY), escortId: stored(ESCORT_KEY), departTime: '', arriveTime: '', riders, note: '' };
}

export default function TransportLogEditor(props: Props) {
  const { date, direction, vehicleNo, existing, elders, staff, present, hasAttendance, attendanceError, onSaved } = props;
  const notify = useNotify();
  const alive = useAlive();
  const busy = useRef(false);
  const [draft, setDraft] = useState<LogDraft>(() => firstDraft(props));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staffOptions = useMemo(() => {
    const isDriver = (s: LabStaff) => /운전|driver/i.test(`${s.role ?? ''} ${s.position ?? ''}`);
    return [...staff]
      .sort((a, b) => Number(isDriver(b)) - Number(isDriver(a)) || a.name.localeCompare(b.name, 'ko'))
      .map((s) => ({ value: String(s.id), label: s.position ? `${s.name} (${s.position})` : s.name }));
  }, [staff]);
  const escortOptions = useMemo(() => [{ value: NONE, label: '없음' }, ...staffOptions], [staffOptions]);

  const items = useMemo(() => elders.map((e) => ({ id: e.id, name: e.name, priority: hasAttendance && present.has(e.id) })), [elders, hasAttendance, present]);
  const ids = draft.riders.map((r) => r.elderlyId);
  const nameOf = (id: number) => elders.find((e) => e.id === id)?.name ?? draft.riders.find((r) => r.elderlyId === id)?.name ?? '이름 없음';

  // 고르기에서 명단을 바꿔도 적어 둔 순서(= 실제로 태운 순서)는 그대로, 새로 고른 분은 맨 뒤
  const pickRiders = (next: number[]) =>
    setDraft((d) => ({ ...d, riders: mergePickedRiders(d.riders, next, (id) => newRider(id, nameOf(id))) }));

  // 시각을 다 적은 분은 위 묶음 끝으로 올린다(버그제보 11/3 — 다음 분을 찾아 목록을 오르내렸다).
  // 칸을 벗어날 때만 값이 들어오므로 적는 도중에는 줄이 움직이지 않는다.
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const riderBoxRef = useRef<HTMLDivElement>(null);
  const scrollToNext = useRef(false);
  const changeRider = (next: RiderDraft) => {
    const before = draft.riders.find((r) => r.elderlyId === next.elderlyId);
    if (before && !isRiderDone(before, direction) && isRiderDone(next, direction)) scrollToNext.current = true;
    setDraft((d) => ({ ...d, riders: placeRider(d.riders, next, direction) }));
  };
  useEffect(() => {
    if (!scrollToNext.current) return;
    scrollToNext.current = false;
    // 이미 다음 분 칸을 눌러 적기 시작했으면 화면을 움직이지 않는다(손가락 밑에서 칸이 도망가지 않게)
    if (riderBoxRef.current?.contains(document.activeElement)) return;
    const nextUp = draft.riders.find((r) => !isRiderDone(r, direction));
    const el = nextUp ? rowRefs.current.get(nextUp.elderlyId) : null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [draft.riders, direction]);
  const outsideRiders = draft.riders.filter((r) => !elders.some((e) => e.id === r.elderlyId));

  const save = async () => {
    if (busy.current) return;
    const problem = validateLog(draft, date, vehicleNo);
    if (problem) {
      setError(problem);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await saveTransportLog(logInput(draft, date, direction, vehicleNo));
      if (draft.driverId !== null) writeStored(DRIVER_KEY, String(draft.driverId));
      writeStored(ESCORT_KEY, draft.escortId === null ? '' : String(draft.escortId));
      notify(`${dateLabel(date)} ${DIRECTION_LABEL[direction]} 운행일지를 저장했습니다`, 'success');
      onSaved();
    } catch (e) {
      if (alive.current) setError(errorText(e, '운행일지를 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const boardedCount = draft.riders.filter((r) => r.boarded).length;
  const doneCount = draft.riders.filter((r) => isRiderDone(r, direction)).length;
  const timeLabel = direction === 'PICKUP' ? '승차' : '하차';
  return (
    <Card padding={4}>
      <VStack gap={4}>
        <VStack gap={0.5}>
          <Text type="large" weight="semibold">
            {dateLabel(date)} {DIRECTION_LABEL[direction]} · {vehicleNo}
          </Text>
          <Text type="supporting" color="secondary">
            {existing ? '이미 쓴 일지입니다. 고쳐서 저장하면 같은 일지가 바뀝니다' : '새 일지입니다. 그날 출석한 어르신이 탑승자로 채워져 있습니다'}
          </Text>
        </VStack>

        <div className={styles.fieldGrid}>
          <Selector
            label="운전원"
            placeholder="운전원 고르기"
            hasSearch={staffOptions.length > 8}
            searchPlaceholder="찾기"
            options={staffOptions}
            value={draft.driverId === null ? '' : String(draft.driverId)}
            onChange={(v) => v && setDraft((d) => ({ ...d, driverId: Number(v) }))}
            isDisabled={saving}
          />
          <Selector
            label="동승자 (선택)"
            placeholder="동승자 고르기"
            hasSearch={escortOptions.length > 8}
            searchPlaceholder="찾기"
            options={escortOptions}
            value={draft.escortId === null ? NONE : String(draft.escortId)}
            onChange={(v) => v && setDraft((d) => ({ ...d, escortId: v === NONE ? null : Number(v) }))}
            isDisabled={saving}
          />
          <TimeField label="출발 시각 (선택)" value={draft.departTime} onChange={(v) => setDraft((d) => ({ ...d, departTime: v }))} />
          <TimeField label="도착 시각 (선택)" value={draft.arriveTime} onChange={(v) => setDraft((d) => ({ ...d, arriveTime: v }))} />
        </div>
        {staff.length === 0 && <SupportText tone="warn">고를 수 있는 직원이 없습니다. 직원 인사에서 직원을 먼저 등록해 주세요.</SupportText>}

        <PersonPicker label="탑승자" items={items} selected={ids} onChange={pickRiders} priorityLabel="출석" max={MAX_RIDERS} isDisabled={saving} emptyText="등록된 어르신이 없습니다" />
        {attendanceError && <SupportText>{attendanceError}</SupportText>}
        {!attendanceError && !hasAttendance && <SupportText>이 날 출결 기록이 없어 출석한 분을 채우지 못했습니다. 탑승한 어르신을 직접 골라 주세요.</SupportText>}
        {outsideRiders.length > 0 && <SupportText>목록에 없는 {outsideRiders.length}명(퇴소 등)은 기록에 그대로 남습니다.</SupportText>}

        {draft.riders.length > 0 && (
          <VStack gap={1.5}>
            <VStack gap={0.5}>
              <Text type="label">어르신별 탑승 ({boardedCount}명 탑승 / {draft.riders.length}명)</Text>
              <SupportText>{timeLabel} 시각을 적은 분은 위로 올라갑니다</SupportText>
            </VStack>
            <div className={own.riderBox} ref={riderBoxRef}>
              {draft.riders.map((r, i) => (
                <div
                  key={r.elderlyId}
                  className={own.riderItem}
                  ref={(el) => {
                    if (el) rowRefs.current.set(r.elderlyId, el);
                    else rowRefs.current.delete(r.elderlyId);
                  }}
                >
                  {/* 다 적은 묶음과 아직 안 적은 묶음 사이 — 다음 분이 어디서부터인지 */}
                  {i === doneCount && doneCount > 0 && (
                    <div className={own.riderSplit}>
                      <Text type="supporting" weight="semibold" color="secondary">
                        아직 {timeLabel} 시각을 안 적은 분 {draft.riders.length - doneCount}명
                      </Text>
                    </div>
                  )}
                  <TransportRiderRow rider={r} onChange={changeRider} isDisabled={saving} />
                </div>
              ))}
            </div>
          </VStack>
        )}

        <TextArea
          label="특이사항 (선택)"
          placeholder="예: 도로 공사로 15분 지연, 한 분 병원 진료로 하차 지점 변경"
          value={draft.note}
          onChange={(v) => setDraft((d) => ({ ...d, note: v.slice(0, LOG_NOTE_MAX) }))}
          rows={3}
          maxLength={LOG_NOTE_MAX}
          isDisabled={saving}
        />

        {error && <ErrorBanner message={error} />}
        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <Text type="supporting" color="secondary">
              {boardedCount}명 탑승
            </Text>
            <Button label={existing ? '고쳐서 저장' : '일지 저장'} variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
          </HStack>
        </div>
      </VStack>
    </Card>
  );
}
