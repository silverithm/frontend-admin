'use client';

/** 시설 정보 카드 — 어떤 법정 점검이 이 센터에 해당하는지를 가르는 칸들. 저장은 두 번 눌러도 한 번만 된다. */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Loading } from '@/components/Loading';
import { ErrorBanner, LabDateInput, NumField, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { saveFacilityProfile } from '@/lib/lab/labApi';
import type { FacilityElevator, FacilityGasKind, FacilityPowerKind, FacilityProfile, FacilitySeptic, FacilitySprinkler, FacilityWaterTank } from '@/lib/lab/labTypes';
import { profileBlockers, profileInput, profileToDraft } from './FacilityLedgerDraft';
import type { ProfileDraft } from './FacilityLedgerDraft';
import {
  ELEVATOR_OPTIONS, GAS_OPTIONS, MAX_AREA, MAX_LPG_KG, MAX_MANAGER, MAX_NOTE, POWER_OPTIONS, SEPTIC_OPTIONS, SPRINKLER_OPTIONS, TANK_OPTIONS,
} from './FacilityLedgerFormat';
import plans from './labPlans.module.css';
import styles from './facilityLedger.module.css';

interface Props {
  profile: FacilityProfile | null;
  loading: boolean;
  error: string | null;
  today: string;
  onRetry: () => void;
  onSaved: (p: FacilityProfile) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export default function FacilityLedgerProfile({ profile, loading, error, today, onRetry, onSaved, onDirtyChange }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const busy = useRef(false);
  const [draft, setDraft] = useState<ProfileDraft>(() => profileToDraft(profile));
  const initial = useRef(JSON.stringify(draft));
  const dirty = JSON.stringify(draft) !== initial.current;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = (p: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...p }));

  // 처음 읽어 오거나 다시 읽었는데 쓰던 내용이 없으면 저장된 값으로 맞춘다
  useEffect(() => {
    if (!profile) return;
    if (JSON.stringify(draft) === initial.current) {
      const next = profileToDraft(profile);
      initial.current = JSON.stringify(next);
      setDraft(next);
    }
    // draft는 일부러 뺀다 — 서버 값이 바뀐 때만 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const blockers = profileBlockers(draft, today);
  const save = async () => {
    if (busy.current || blockers.length > 0) return;
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveFacilityProfile(profileInput(draft, profile));
      if (!alive.current) return;
      const next = profileToDraft(saved);
      initial.current = JSON.stringify(next);
      setDraft(next);
      onSaved(saved);
      notify('시설 정보를 저장했습니다', 'success');
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '시설 정보를 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const revert = () => {
    const next = profileToDraft(profile);
    initial.current = JSON.stringify(next);
    setDraft(next);
    setSaveError(null);
  };

  if (error && !profile) {
    return (
      <Card padding={4}>
        <ErrorBanner message={error} onRetry={onRetry} />
      </Card>
    );
  }
  if (loading && !profile) {
    return (
      <Card padding={4}>
        <Loading size="section" label="시설 정보를 불러오는 중..." />
      </Card>
    );
  }
  const disabled = saving;
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">시설 정보</Text>
        <Text type="supporting" color="secondary">아래 칸으로 어떤 법정 점검이 우리 센터에 해당하는지 판정합니다. 모르는 칸은 ‘모름’으로 두면 관할 기관 확인 대상으로 표시됩니다.</Text>
        {!draft.approvedOn && (
          <div className={styles.callout} role="status" data-tone="warn">
            <Text type="label">소방 점검 기한을 계산하려면 사용승인일(건축물대장)이 필요합니다</Text>
          </div>
        )}
        <div className={plans.fieldGrid}>
          <LabDateInput label="사용승인일 (건축물대장)" value={draft.approvedOn} max={today} onChange={(v) => set({ approvedOn: v })} />
          <NumField label="연면적 (㎡)" value={draft.grossAreaM2} max={MAX_AREA} placeholder="예: 330" isDisabled={disabled} onChange={(v) => set({ grossAreaM2: v })} />
          <Selector label="스프링클러" placeholder="고르기" options={SPRINKLER_OPTIONS} value={draft.sprinkler} onChange={(v) => v && set({ sprinkler: v as FacilitySprinkler })} isDisabled={disabled} />
          <Selector label="전기 수전" placeholder="고르기" options={POWER_OPTIONS} value={draft.powerKind} onChange={(v) => v && set({ powerKind: v as FacilityPowerKind })} isDisabled={disabled} />
          <Selector label="가스" placeholder="고르기" options={GAS_OPTIONS} value={draft.gasKind} onChange={(v) => v && set({ gasKind: v as FacilityGasKind })} isDisabled={disabled} />
          {draft.gasKind === 'LPG' && (
            <NumField label="LPG 저장능력 (kg)" value={draft.lpgCapacityKg} max={MAX_LPG_KG} grouped placeholder="예: 300" isDisabled={disabled} onChange={(v) => set({ lpgCapacityKg: v })} />
          )}
          <Selector label="승강기" placeholder="고르기" options={ELEVATOR_OPTIONS} value={draft.elevator} onChange={(v) => v && set({ elevator: v as FacilityElevator })} isDisabled={disabled} />
          <Selector label="저수조" placeholder="고르기" options={TANK_OPTIONS} value={draft.waterTank} onChange={(v) => v && set({ waterTank: v as FacilityWaterTank })} isDisabled={disabled} />
          <Selector label="정화조" placeholder="고르기" options={SEPTIC_OPTIONS} value={draft.septic} onChange={(v) => v && set({ septic: v as FacilitySeptic })} isDisabled={disabled} />
          <TextInput label="소방안전관리자" placeholder="예: 홍길동" value={draft.fireManagerName} onChange={(v) => set({ fireManagerName: v.slice(0, MAX_MANAGER) })} isDisabled={disabled} />
        </div>
        <TextInput label="메모" placeholder="예: 건물주가 승강기를 관리함, 저수조는 옥상" value={draft.note} onChange={(v) => set({ note: v.slice(0, MAX_NOTE) })} isDisabled={disabled} />
        {draft.gasKind === 'LPG' && draft.lpgCapacityKg === null && <SupportText tone="warn">LPG 저장능력(kg)을 적어야 정기검사 대상인지 판정할 수 있습니다.</SupportText>}
        {(dirty || profile?.id === null) && blockers.length > 0 && (
          <VStack gap={1}>
            {blockers.map((m) => (
              <SupportText key={m} tone="warn">{m}</SupportText>
            ))}
          </VStack>
        )}
        {error && <ErrorBanner message={error} onRetry={onRetry} />}
        {saveError && <ErrorBanner message={saveError} />}
        <HStack gap={2} vAlign="center" hAlign="end" wrap="wrap">
          {dirty && <SupportText tone="warn">저장하지 않은 변경이 있습니다. 저장해야 아래 표에 반영됩니다.</SupportText>}
          {profile?.updatedAt && !dirty && <SupportText>마지막 저장 {profile.updatedAt.slice(0, 10)}{profile.writerName ? ` · ${profile.writerName}` : ''}</SupportText>}
          {dirty && <Button label="변경 되돌리기" variant="ghost" isDisabled={disabled} onClick={revert} />}
          <Button label="시설 정보 저장" variant="primary" isLoading={saving} isDisabled={disabled || !dirty || blockers.length > 0} onClick={() => void save()} />
        </HStack>
      </VStack>
    </Card>
  );
}
