'use client';

/** 탑승자 한 명 — 탑승 여부, 승차·하차 시각, 메모. 타지 않은 분은 시각 칸을 잠근다. */
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TimeField } from './RecordsUi';
import { RIDER_NOTE_MAX } from './TransportDraft';
import type { RiderDraft } from './TransportDraft';
import own from './Transport.module.css';

interface Props {
  rider: RiderDraft;
  onChange: (next: RiderDraft) => void;
  isDisabled?: boolean;
}

export default function TransportRiderRow({ rider, onChange, isDisabled }: Props) {
  const set = <K extends keyof RiderDraft>(key: K, value: RiderDraft[K]) => onChange({ ...rider, [key]: value });
  return (
    <div className={`${own.riderRow} ${rider.boarded ? '' : own.riderOff}`}>
      <CheckboxInput label={`${rider.name} 탑승`} value={rider.boarded} onChange={(v) => set('boarded', v)} isDisabled={isDisabled} />
      {rider.boarded && (
        <div className={own.riderGrid}>
          <TimeField label="승차 시각 (선택)" value={rider.boardTime} onChange={(v) => set('boardTime', v)} />
          <TimeField label="하차 시각 (선택)" value={rider.alightTime} onChange={(v) => set('alightTime', v)} />
          <TextInput label="메모 (선택)" placeholder="예: 휠체어 이용" value={rider.note} onChange={(v) => set('note', v.slice(0, RIDER_NOTE_MAX))} isDisabled={isDisabled} />
        </div>
      )}
    </div>
  );
}
