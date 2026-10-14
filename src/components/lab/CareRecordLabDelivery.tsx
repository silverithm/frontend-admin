'use client';

/** 제공대장 — 한 달치 급여제공기록을 어르신·보호자께 드린 날과 방법을 남긴다. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Loading } from '@/components/Loading';
import { deleteCareDelivery, listCareDeliveries, saveCareDelivery } from '@/lib/lab/labApi';
import type { CareDelivery, DeliveryMethod } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, MonthStepper, useNotify } from './LabUi';
import { currentMonth, dotDate, errorText, monthLabel, monthRange, todayString } from './labFormat';
import type { LabElder } from './useLabElders';
import styles from './lab.module.css';

const METHODS: ReadonlyArray<{ value: DeliveryMethod; label: string }> = [
  { value: 'VISIT', label: '방문' },
  { value: 'MAIL', label: '우편' },
  { value: 'FAX', label: '팩스' },
  { value: 'ELECTRONIC', label: '전자 열람' },
];
const methodLabel = (m: DeliveryMethod) => METHODS.find((x) => x.value === m)?.label ?? m;

interface DialogState {
  elder: LabElder;
  existing: CareDelivery | null;
}

interface CareDeliveryViewProps {
  elders: LabElder[];
  eldersLoading: boolean;
}

export default function CareRecordLabDelivery({ elders, eldersLoading }: CareDeliveryViewProps) {
  const notify = useNotify();
  const [month, setMonth] = useState(currentMonth);
  const [items, setItems] = useState<CareDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [removing, setRemoving] = useState<CareDelivery | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listCareDeliveries(target);
      if (n !== seq.current) return;
      setItems(list);
    } catch (e) {
      if (n !== seq.current) return;
      setItems([]);
      setError(errorText(e, '제공대장을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [month, load]);

  const byElder = useMemo(() => new Map(items.map((d) => [d.elderlyId, d])), [items]);
  const done = elders.filter((e) => byElder.has(e.id)).length;
  const label = month === currentMonth() ? '이번 달' : monthLabel(month);

  const confirmRemove = async () => {
    if (!removing || removeBusy) return;
    setRemoveBusy(true);
    try {
      await deleteCareDelivery(removing.id);
      setItems((prev) => prev.filter((d) => d.id !== removing.id));
      setRemoving(null);
      notify('제공 기록을 삭제했습니다', 'success');
    } catch (e) {
      setRemoving(null);
      setError(errorText(e, '제공대장 기록을 삭제하지 못했습니다'));
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={setMonth} isDisabled={loading} />
        <Text type="label">
          {label} 제공 {done}/{elders.length}명
        </Text>
      </div>
      <Text type="supporting" color="secondary">
        월별 급여제공기록을 어르신이나 보호자께 드린 날과 방법을 남기는 장부입니다. 한 달에 한 번, 어르신마다 하나씩 남겨요.
      </Text>

      {error && <ErrorBanner message={error} onRetry={() => void load(month)} />}

      {eldersLoading || (loading && items.length === 0) ? (
        <Loading size="inline" label="불러오는 중..." />
      ) : elders.length === 0 ? (
        <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />
      ) : (
        <Card padding={0}>
          {elders.map((elder) => {
            const d = byElder.get(elder.id);
            return (
              <div className={styles.rowBlock} key={elder.id}>
                <div className={styles.rowHead}>
                  <VStack gap={0.5}>
                    <Text type="body" weight="medium">
                      {elder.name}
                    </Text>
                    {d ? (
                      <Text type="supporting" color="secondary">
                        {dotDate(d.deliveredOn)} · {methodLabel(d.method)}
                        {d.recipient ? ` · 받은 분 ${d.recipient}` : ''}
                        {d.note ? ` · ${d.note}` : ''}
                      </Text>
                    ) : (
                      <Text type="supporting" color="secondary">
                        아직 제공 기록이 없습니다
                      </Text>
                    )}
                  </VStack>
                  <HStack gap={2} vAlign="center">
                    <Chip tone={d ? 'ok' : 'warn'} label={d ? '제공 완료' : '미제공'} />
                    <Button
                      label={d ? '수정' : '제공 기록'}
                      size="sm"
                      variant={d ? 'ghost' : 'secondary'}
                      onClick={() => setDialog({ elder, existing: d ?? null })}
                    />
                    {d && <Button label="삭제" size="sm" variant="ghost" onClick={() => setRemoving(d)} />}
                  </HStack>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {dialog && (
        <DeliveryDialog
          key={`${dialog.elder.id}-${month}`}
          elder={dialog.elder}
          month={month}
          existing={dialog.existing}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setItems((prev) => [...prev.filter((d) => d.elderlyId !== saved.elderlyId), saved]);
            setDialog(null);
            notify('제공 기록을 저장했습니다', 'success');
          }}
        />
      )}

      <LabConfirm
        isOpen={removing !== null}
        title="제공 기록을 삭제할까요?"
        description={removing ? `${removing.elderlyName} 어르신의 ${monthLabel(removing.month)} 제공 기록이 지워집니다.` : ''}
        actionLabel="삭제"
        isLoading={removeBusy}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

interface DeliveryDialogProps {
  elder: LabElder;
  month: string;
  existing: CareDelivery | null;
  onClose: () => void;
  onSaved: (saved: CareDelivery) => void;
}

function DeliveryDialog({ elder, month, existing, onClose, onSaved }: DeliveryDialogProps) {
  const range = monthRange(month);
  const today = todayString();
  // 기본 제공일: 이번 달이면 오늘, 지난 달이면 그 달의 마지막 날
  const initialDate = existing?.deliveredOn.slice(0, 10) ?? (today >= range.start && today <= range.end ? today : range.end);
  const [deliveredOn, setDeliveredOn] = useState<string>(initialDate);
  const [method, setMethod] = useState<DeliveryMethod>(existing?.method ?? 'VISIT');
  const [recipient, setRecipient] = useState(existing?.recipient ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (saving) return;
    if (!deliveredOn) {
      setError('제공한 날짜를 골라 주세요');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveCareDelivery({
        elderlyId: elder.id,
        month,
        deliveredOn,
        method,
        recipient: recipient.trim() === '' ? null : recipient.trim(),
        note: note.trim() === '' ? null : note.trim(),
      });
      onSaved(saved);
    } catch (e) {
      setError(errorText(e, '제공대장을 저장하지 못했습니다'));
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen onOpenChange={(open) => !open && !saving && onClose()} purpose="form" width="min(440px, calc(100vw - 24px))">
      <Layout
        header={<DialogHeader title={`${elder.name} · ${monthLabel(month)} 제공 기록`} onOpenChange={(open) => !open && !saving && onClose()} />}
        content={
          <LayoutContent>
            <VStack gap={3}>
              <LabDateInput label="제공일" value={deliveredOn} onChange={setDeliveredOn} max={today} isRequired />
              <Selector
                label="제공 방법"
                options={METHODS.map((m) => ({ value: m.value, label: m.label }))}
                value={method}
                onChange={(v) => v && setMethod(v as DeliveryMethod)}
              />
              <TextInput label="받은 분" value={recipient} onChange={(v) => setRecipient(v.slice(0, 50))} isOptional placeholder="예: 보호자 김OO" />
              <TextInput label="메모" value={note} onChange={(v) => setNote(v.slice(0, 200))} isOptional />
              {error && <ErrorBanner message={error} />}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="취소" variant="ghost" isDisabled={saving} onClick={onClose} />
              <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void submit()} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
