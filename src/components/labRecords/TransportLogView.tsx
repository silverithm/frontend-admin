'use client';

/** 운행일지 보기 — 날짜·등원/하원·차량을 고르고 일지를 쓴다. 그날 일지 목록, 달 운행 현황, 고시 제34조 제4항 안내. */
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { Loading } from '@/components/Loading';
import { listTransportLogs } from '@/lib/lab/labApi';
import type { LabStaff, TransportDirection, TransportLog, TransportVehicle } from '@/lib/lab/labTypes';
import { ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { useElderAttendance } from './useElderAttendance';
import { useRecordsLoader } from './useRecordsLoader';
import TransportCoverage from './TransportCoverage';
import { DIRECTION_LABEL } from './TransportDraft';
import TransportLogEditor from './TransportLogEditor';
import TransportLogList from './TransportLogList';
import TransportLogSheet from './TransportLogSheet';
import styles from './labRecords.module.css';
import own from './Transport.module.css';

interface Props {
  vehicles: TransportVehicle[];
  staff: LabStaff[];
  staffError: string | null;
  elders: LabElder[];
  /** 차량·직원·어르신 중 하나라도 아직 읽는 중 */
  baseLoading: boolean;
  onGoVehicles: () => void;
}

export default function TransportLogView({ vehicles, staff, staffError, elders, baseLoading, onGoVehicles }: Props) {
  const today = todayString();
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<TransportDirection>('PICKUP');
  const [pickedVehicle, setPickedVehicle] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [printLogs, setPrintLogs] = useState<TransportLog[] | null>(null);

  const loadLogs = useCallback(() => (date === '' ? Promise.resolve([]) : listTransportLogs({ date })), [date]);
  const logs = useRecordsLoader(loadLogs, '이 날 운행일지를 불러오지 못했습니다', []);
  const attendance = useElderAttendance(date || today);

  const active = useMemo(() => vehicles.filter((v) => v.active), [vehicles]);
  const vehicleNo = pickedVehicle !== '' ? pickedVehicle : active[0]?.vehicleNo ?? '';
  const vehicleOptions = useMemo(() => {
    const options = active.map((v) => ({ value: v.vehicleNo, label: v.label ? `${v.vehicleNo} (${v.label})` : v.vehicleNo }));
    if (vehicleNo !== '' && !options.some((o) => o.value === vehicleNo)) options.push({ value: vehicleNo, label: vehicleNo });
    return options;
  }, [active, vehicleNo]);
  const existing = logs.data.find((l) => l.direction === direction && l.vehicleNo === vehicleNo) ?? null;

  const changed = () => {
    void logs.reload();
    setReloadKey((k) => k + 1);
  };
  const edit = (log: TransportLog) => {
    setDirection(log.direction);
    setPickedVehicle(log.vehicleNo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const pickDate = (next: string) => {
    setDate(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const ready = !baseLoading && !logs.isLoading && !attendance.isLoading && date !== '' && vehicleNo !== '';

  return (
    <div className={styles.stack}>
      <details className={own.guide}>
        <summary>이동서비스 일지 안내 (고시 제34조 제4항)</summary>
        <p>이동서비스(송영)를 제공하면 운행일지를 작성하고 보관해야 합니다. 이 화면의 일지는 날짜·등원/하원·차량마다 한 건이며, 같은 조합으로 다시 저장하면 기존 일지가 바뀝니다.</p>
        <p>공단의 정식 서식은 확인하지 못했습니다(대조 필요). 인쇄본에 운전원·동승자 서명 칸이 있으니 출력해 서명받아 보관할 수 있습니다.</p>
      </details>

      <div className={styles.fieldGrid}>
        <LabDateInput label="운행 날짜" value={date} onChange={setDate} max={today} />
        <Selector
          label="구분"
          placeholder="등원·하원 고르기"
          options={[
            { value: 'PICKUP', label: DIRECTION_LABEL.PICKUP },
            { value: 'DROPOFF', label: DIRECTION_LABEL.DROPOFF },
          ]}
          value={direction}
          onChange={(v) => v && setDirection(v as TransportDirection)}
        />
        <Selector
          label="차량"
          placeholder="차량 고르기"
          hasSearch={vehicleOptions.length > 8}
          searchPlaceholder="찾기"
          options={vehicleOptions}
          value={vehicleNo}
          onChange={(v) => v && setPickedVehicle(v)}
          isDisabled={vehicleOptions.length === 0}
        />
      </div>

      {!baseLoading && vehicleOptions.length === 0 && (
        <div className={own.noticeBox}>
          <SupportText>등록된 운행 차량이 없습니다. 차량·보험 보기에서 차량을 먼저 등록해 주세요.</SupportText>
          <Button label="차량·보험으로 가기" variant="secondary" size="sm" onClick={onGoVehicles} />
        </div>
      )}
      {logs.error && <ErrorBanner message={logs.error} onRetry={() => void logs.reload()} />}
      {staffError && <ErrorBanner message={staffError} />}

      {baseLoading || logs.isLoading || attendance.isLoading ? (
        <Loading size="inline" label="운행일지를 불러오는 중..." />
      ) : ready && !logs.error ? (
        <TransportLogEditor
          key={`${date}|${direction}|${vehicleNo}|${existing?.id ?? 'new'}|${existing?.updatedAt ?? ''}`}
          date={date}
          direction={direction}
          vehicleNo={vehicleNo}
          existing={existing}
          elders={elders}
          staff={staff}
          present={attendance.present}
          hasAttendance={attendance.hasData}
          attendanceError={attendance.error}
          onSaved={changed}
        />
      ) : null}

      <div className={styles.toolbar}>
        <SupportText>{date === '' ? '날짜를 고르면 그날 쓴 일지가 보입니다' : '이 날 쓴 일지'}</SupportText>
        <div className={styles.spacer}>
          <Button label="그날 일지 모두 인쇄" variant="secondary" isDisabled={logs.data.length === 0} onClick={() => setPrintLogs(logs.data)} />
        </div>
      </div>
      {!logs.isLoading && <TransportLogList logs={logs.data} onEdit={edit} onPrint={setPrintLogs} onChanged={changed} />}

      <TransportCoverage initialMonth={today.slice(0, 7)} reloadKey={reloadKey} onPickDate={pickDate} />

      {printLogs && <TransportLogSheet logs={printLogs} today={today} onDone={() => setPrintLogs(null)} />}
    </div>
  );
}
