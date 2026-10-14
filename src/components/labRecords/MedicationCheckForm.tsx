'use client';

/**
 * 약품 보관 점검 기록 — 점검 일자·점검자, 보관함 잠금, 냉장고 잠금(냉장 약이 있을 때만), 약품마다 확인과 조치(폐기·재주문·옮김).
 * 같은 날짜에 이미 기록이 있으면 불러와 고친다(날짜마다 한 건). 폐기로 표시한 약은 저장하면 대장의 폐기일이 점검일로 채워진다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { saveMedicineCheck } from '@/lib/lab/labApi';
import type { MedicineCheck, MedicineCheckAction, MedicineStock } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, defaultPersonName, dotDate, errorText, todayString, writeStored } from '@/components/lab/labFormat';
import { ACTION_LABEL, sheetRow } from './MedicationCheckSheet';
import type { CheckSheetData } from './MedicationCheckSheet';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

interface ItemState {
  ok: boolean;
  action: MedicineCheckAction;
  note: string;
}

interface CheckDraft {
  date: string;
  inspector: string;
  cabinet: boolean;
  fridge: boolean;
  note: string;
  items: Record<number, ItemState>;
}

const ACTIONS: MedicineCheckAction[] = ['NONE', 'DISPOSE', 'REORDER', 'MOVE'];

function buildDraft(date: string, existing: MedicineCheck | undefined, live: MedicineStock[], inspectorFallback: string): CheckDraft {
  const items: Record<number, ItemState> = {};
  for (const s of live) items[s.id] = { ok: false, action: 'NONE', note: '' };
  for (const it of existing?.items ?? []) items[it.stockId] = { ok: it.ok, action: it.action, note: it.note ?? '' };
  return {
    date,
    inspector: existing?.inspectorName ?? inspectorFallback,
    cabinet: existing?.cabinetLocked ?? false,
    fridge: existing?.fridgeLocked ?? false,
    note: existing?.note ?? '',
    items,
  };
}

interface Props {
  stock: MedicineStock[];
  checks: MedicineCheck[];
  initialDate: string;
  onSaved: () => void;
  onClose: () => void;
  onPrint: (data: CheckSheetData) => void;
}

export default function MedicationCheckForm({ stock, checks, initialDate, onSaved, onClose, onPrint }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const today = todayString();
  const live = useMemo(() => stock.filter((s) => !s.disposedOn).sort((a, b) => a.expiresOn.localeCompare(b.expiresOn)), [stock]);
  const byId = useMemo(() => new Map(stock.map((s) => [s.id, s])), [stock]);
  const existingOn = (date: string) => checks.find((c) => c.checkedOn.slice(0, 10) === date);
  const [draft, setDraft] = useState<CheckDraft>(() => buildDraft(initialDate, existingOn(initialDate), live, defaultPersonName()));
  const [loadedNote, setLoadedNote] = useState(() => (existingOn(initialDate) ? '이 날짜의 점검 기록을 불러왔습니다. 저장하면 이 기록을 덮어씁니다.' : ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = useMemo(() => checks.find((c) => c.checkedOn.slice(0, 10) === draft.date), [checks, draft.date]);
  const hasFridge = live.some((s) => s.storage === 'FRIDGE') || (existing?.fridgeLocked ?? null) !== null;
  const rowIds = useMemo(() => {
    const ids = new Set<number>(live.map((s) => s.id));
    for (const it of existing?.items ?? []) ids.add(it.stockId);
    return [...ids].filter((id) => draft.items[id]).sort((a, b) => (byId.get(a)?.expiresOn ?? '').localeCompare(byId.get(b)?.expiresOn ?? ''));
  }, [live, existing, draft.items, byId]);

  const set = <K extends keyof CheckDraft>(key: K, value: CheckDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setItem = (id: number, patch: Partial<ItemState>) => setDraft((d) => ({ ...d, items: { ...d.items, [id]: { ...d.items[id], ...patch } } }));

  const changeDate = (date: string) => {
    if (date === '' || date > today) return;
    const found = existingOn(date);
    setDraft((d) => buildDraft(date, found, live, d.inspector));
    setLoadedNote(found ? '이 날짜의 점검 기록을 불러왔습니다. 저장하면 이 기록을 덮어씁니다.' : '');
  };

  const markAllOk = () =>
    setDraft((d) => {
      const items = { ...d.items };
      for (const s of live) if (s.expiresOn.slice(0, 10) >= today) items[s.id] = { ...items[s.id], ok: true };
      return { ...d, items };
    });

  const unchecked = rowIds.filter((id) => !draft.items[id].ok && draft.items[id].action === 'NONE').length;

  const sheetData = (): CheckSheetData => ({
    checkedOn: draft.date,
    inspector: draft.inspector.trim(),
    cabinetLocked: draft.cabinet,
    fridgeLocked: hasFridge ? draft.fridge : null,
    rows: rowIds.map((id) => sheetRow(byId.get(id), { ok: draft.items[id].ok || draft.items[id].action !== 'NONE' ? draft.items[id].ok : null, action: draft.items[id].action, note: draft.items[id].note }, draft.date)),
    note: draft.note.trim(),
  });

  const save = async () => {
    if (saving) return;
    if (draft.date === '') return setError('점검 일자를 골라 주세요');
    if (draft.inspector.trim() === '') return setError('점검자 이름을 적어 주세요');
    if (rowIds.length > 200) return setError('점검할 약품이 200종을 넘었습니다. 다 쓴 약은 폐기 처리해 주세요');
    setSaving(true);
    setError(null);
    try {
      await saveMedicineCheck({
        checkedOn: draft.date,
        inspectorName: draft.inspector.trim(),
        cabinetLocked: draft.cabinet,
        fridgeLocked: hasFridge ? draft.fridge : null,
        items: rowIds.map((id) => ({ stockId: id, ok: draft.items[id].ok, action: draft.items[id].action, note: draft.items[id].note.trim().slice(0, 100) })),
        note: draft.note.trim() === '' ? null : draft.note.trim().slice(0, 500),
      });
      writeStored(PROVIDER_KEY, draft.inspector.trim());
      notify('약품 보관 점검을 저장했습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) setError(errorText(e, '약품 보관 점검을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <Text type="large" weight="semibold">
            약품 보관 점검 기록
          </Text>
          <Button label="닫기" variant="ghost" isDisabled={saving} onClick={onClose} />
        </HStack>
        <div className={styles.fieldGridWide}>
          <LabDateInput label="점검 일자" value={draft.date} onChange={changeDate} max={today} />
          <TextInput label="점검자" placeholder="점검한 사람 이름" value={draft.inspector} onChange={(v) => set('inspector', v.slice(0, 50))} />
        </div>
        {loadedNote && <SupportText tone="warn">{loadedNote}</SupportText>}
        <VStack gap={1}>
          <Text type="label">잠금 확인</Text>
          <div className={own.slotChecks}>
            <CheckboxInput label="약품보관함이 잠겨 있다" value={draft.cabinet} onChange={(v) => set('cabinet', v)} />
            {hasFridge && <CheckboxInput label="냉장고가 잠겨 있다 (냉장 약 보관)" value={draft.fridge} onChange={(v) => set('fridge', v)} />}
          </div>
          {!hasFridge && (
            <Text type="supporting" color="secondary">
              냉장 보관 약이 없어 냉장고 잠금은 묻지 않습니다.
            </Text>
          )}
        </VStack>

        <VStack gap={1}>
          <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
            <Text type="label">
              약품별 확인 <span className={styles.mutedText}>· {rowIds.length}종</span>
            </Text>
            <Button label="사용기한 안 지난 약 모두 이상 없음" variant="secondary" isDisabled={live.length === 0} onClick={markAllOk} />
          </HStack>
          <Text type="supporting" color="secondary">
            사용기한과 보관 상태(개봉 여부·변색·냉장 보관)를 직접 보고 확인해 체크해 주세요. 폐기로 표시하면 저장할 때 폐기일이 점검일로 채워집니다.
          </Text>
          {rowIds.length === 0 ? (
            <Text type="supporting" color="secondary">
              보관 중인 약품이 없습니다. 약품 대장에 먼저 등록해 주세요.
            </Text>
          ) : (
            rowIds.map((id) => {
              const s = byId.get(id);
              const it = draft.items[id];
              const expired = s ? !s.disposedOn && s.expiresOn.slice(0, 10) < draft.date : false;
              return (
                <div className={own.stockCheckRow} key={id}>
                  <div>
                    <Text type="body" weight="medium">
                      {s?.name ?? '(삭제된 약품)'}
                    </Text>
                    <div className={styles.chips} style={{ justifyContent: 'flex-start' }}>
                      <Text type="supporting" color="secondary">
                        {s ? `${s.efficacy} · ${s.storage === 'FRIDGE' ? '냉장' : '실온'} · 사용기한 ${dotDate(s.expiresOn)}` : ''}
                      </Text>
                      {expired && <Chip tone="danger" label="사용기한 지남" />}
                      {s?.disposedOn && <Chip tone="neutral" label="폐기함" />}
                    </div>
                  </div>
                  <CheckboxInput label="이상 없음" value={it.ok} onChange={(v) => setItem(id, { ok: v })} />
                  <Selector
                    label="조치"
                    placeholder="고르기"
                    options={ACTIONS.map((a) => ({ value: a, label: ACTION_LABEL[a] }))}
                    value={it.action}
                    onChange={(v) => v && setItem(id, { action: v as MedicineCheckAction })}
                  />
                  <TextInput label="메모 (선택)" value={it.note} onChange={(v) => setItem(id, { note: v.slice(0, 100) })} />
                </div>
              );
            })
          )}
          {unchecked > 0 && (
            <SupportText tone="warn">이상 없음도 조치도 고르지 않은 약이 {unchecked}종 있습니다. 확인하지 않았다면 그대로 두어도 되지만, 점검표에는 이상 있음으로 남습니다.</SupportText>
          )}
        </VStack>

        <TextInput label="점검 메모 (선택)" placeholder="예: 비상약 상자 위치 변경" value={draft.note} onChange={(v) => set('note', v.slice(0, 500))} />
        {error && <ErrorBanner message={error} />}
        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <Button label="점검표 인쇄" variant="secondary" isDisabled={saving} onClick={() => onPrint(sheetData())} />
            <Button label="점검 저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
          </HStack>
        </div>
      </VStack>
    </Card>
  );
}
