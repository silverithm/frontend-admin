'use client';

/** 차량 등록·고치기 — 차량 번호, 차종, 보험사·증권 번호, 보험 기간, 종합보험 여부. 책임보험만으로는 인정되지 않는다. */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createTransportVehicle, updateTransportVehicle } from '@/lib/lab/labApi';
import type { TransportVehicle } from '@/lib/lab/labTypes';
import { ErrorBanner, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { useAlive } from './recordsFormat';
import { VEHICLE_NO_MAX, emptyVehicleDraft, validateVehicle, vehicleDraftOf, vehicleInput } from './TransportDraft';
import type { VehicleDraft } from './TransportDraft';
import styles from './labRecords.module.css';

interface Props {
  vehicle: TransportVehicle | null;
  vehicles: TransportVehicle[];
  onSaved: () => void;
  onClose: () => void;
}

export default function TransportVehicleForm({ vehicle, vehicles, onSaved, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const busy = useRef(false);
  const [draft, setDraft] = useState<VehicleDraft>(() => (vehicle ? vehicleDraftOf(vehicle) : emptyVehicleDraft()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof VehicleDraft>(key: K, value: VehicleDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (busy.current) return;
    const problem = validateVehicle(draft, vehicles, vehicle?.id ?? null);
    if (problem) {
      setError(problem);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      if (vehicle) await updateTransportVehicle(vehicle.id, vehicleInput(draft));
      else await createTransportVehicle(vehicleInput(draft));
      notify(vehicle ? '차량 정보를 고쳤습니다' : '차량을 등록했습니다', 'success');
      onSaved();
      onClose();
    } catch (e) {
      if (alive.current) setError(errorText(e, '차량 정보를 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <Text type="large" weight="semibold">
            {vehicle ? '차량 고치기' : '차량 추가'}
          </Text>
          <Button label="닫기" variant="ghost" isDisabled={saving} onClick={onClose} />
        </HStack>
        <div className={styles.fieldGrid}>
          <TextInput label="차량 번호" placeholder="예: 12가 3456" value={draft.vehicleNo} onChange={(v) => set('vehicleNo', v.slice(0, VEHICLE_NO_MAX))} isDisabled={saving} />
          <TextInput label="차종 (선택)" placeholder="예: 카니발 휠체어 리프트" value={draft.label} onChange={(v) => set('label', v.slice(0, 50))} isDisabled={saving} />
          <TextInput label="보험사 (선택)" placeholder="예: OO화재" value={draft.insurer} onChange={(v) => set('insurer', v.slice(0, 50))} isDisabled={saving} />
          <TextInput label="증권 번호 (선택)" value={draft.policyNo} onChange={(v) => set('policyNo', v.slice(0, 40))} isDisabled={saving} />
          <LabDateInput label="보험 시작일" value={draft.insuranceFrom} onChange={(v) => set('insuranceFrom', v)} />
          <LabDateInput label="보험 만기일" value={draft.insuranceTo} onChange={(v) => set('insuranceTo', v)} />
        </div>
        <CheckboxInput label="자동차종합보험에 가입함" value={draft.comprehensive} onChange={(v) => set('comprehensive', v)} isDisabled={saving} />
        {!draft.comprehensive && <SupportText tone="warn">책임보험만으로는 인정되지 않습니다. 종합보험에 가입해야 평가에서 인정됩니다.</SupportText>}
        <CheckboxInput label="지금 운행하는 차량" value={draft.active} onChange={(v) => set('active', v)} isDisabled={saving} />
        <TextInput label="메모 (선택)" placeholder="예: 점검은 위생·안전 점검 화면에 기록" value={draft.note} onChange={(v) => set('note', v.slice(0, 200))} isDisabled={saving} />
        {error && <ErrorBanner message={error} />}
        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="end">
            <Button label={vehicle ? '고쳐서 저장' : '차량 등록'} variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
          </HStack>
        </div>
      </VStack>
    </Card>
  );
}
