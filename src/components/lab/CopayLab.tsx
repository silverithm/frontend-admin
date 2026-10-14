'use client';

/**
 * 본인부담금 — 달을 고르면 어르신별 청구 한 줄씩. 등급·출석일수는 미리 채워지고, 직원이 고쳐 저장한다.
 * 금액은 2026년 수가 기준 어림 계산이다(가산·미이용일 등 미반영). 은행 입금 맞춤은 브라우저 안에서만 돈다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Loading } from '@/components/Loading';
import { getElderAttendanceRange } from '@/lib/apiService';
import { deleteCopayBill, listCopayBills, saveCopayBill } from '@/lib/lab/labApi';
import { copayNoticeText, remainingDue } from '@/lib/lab/copayBill';
import { formatWon } from '@/lib/ltc2026';
import type { CopayBill } from '@/lib/lab/labTypes';
import CopayDepositPanel from './CopayDepositPanel';
import CopayPaymentDialog from './CopayPaymentDialog';
import CopayRow from './CopayRow';
import { ErrorBanner, LabConfirm, MonthStepper, useNotify } from './LabUi';
import { buildFromDraft, defaultDraft, draftFromBill, draftKey, isBuildError } from './copayDraft';
import type { CopayDraft } from './copayDraft';
import { companyNameStored, currentMonth, errorText, monthRange, shiftMonth } from './labFormat';
import { useLabElders } from './useLabElders';
import styles from './lab.module.css';

/** 출결 기간 조회 응답에서 어르신별 출석(PRESENT) 일수를 센다. 응답 모양이 둘 이상이라 느슨하게 읽는다. */
function countPresentDays(data: unknown): Map<number, number> {
  const box = data as { attendances?: unknown; records?: unknown; content?: unknown } | null;
  const raw = Array.isArray(data) ? data : box?.attendances ?? box?.records ?? box?.content ?? [];
  const list = Array.isArray(raw) ? (raw as Array<{ elderlyId?: unknown; status?: unknown; date?: unknown }>) : [];
  const days = new Map<number, Set<string>>();
  for (const r of list) {
    const id = Number(r.elderlyId);
    if (!Number.isInteger(id) || r.status === 'ABSENT' || r.status === '결석') continue;
    if (r.status !== 'PRESENT' && r.status !== '출석') continue;
    const set = days.get(id) ?? new Set<string>();
    set.add(typeof r.date === 'string' ? r.date.slice(0, 10) : String(set.size)); // 같은 날 중복 기록은 하루로 센다
    days.set(id, set);
  }
  return new Map([...days].map(([id, set]) => [id, set.size]));
}

export default function CopayLab() {
  const notify = useNotify();
  const { elders, isLoading: eldersLoading, error: eldersError, reload: reloadElders } = useLabElders();
  const [month, setMonth] = useState(currentMonth);
  const [bills, setBills] = useState<CopayBill[]>([]);
  const [drafts, setDrafts] = useState<Record<number, CopayDraft>>({});
  const [initialKeys, setInitialKeys] = useState<Record<number, string>>({});
  const [attendance, setAttendance] = useState<Map<number, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [payBill, setPayBill] = useState<CopayBill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CopayBill | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [noticeText, setNoticeText] = useState<string | null>(null);
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (target: string) => {
      if (eldersLoading) return;
      const n = ++seq.current;
      setLoading(true);
      setError(null);
      const range = monthRange(target);
      const [billsRes, attRes, prevRes] = await Promise.allSettled([
        listCopayBills(target),
        getElderAttendanceRange(range.start, range.end),
        listCopayBills(shiftMonth(target, -1)),
      ]);
      if (n !== seq.current) return; // 달을 빨리 넘기면 앞선 요청의 응답은 버린다
      if (billsRes.status === 'rejected') {
        setBills([]);
        setDrafts({});
        setInitialKeys({});
        setError(errorText(billsRes.reason, '청구서를 불러오지 못했습니다'));
        setLoading(false);
        return;
      }
      const loadedBills = billsRes.value;
      const present = attRes.status === 'fulfilled' ? countPresentDays(attRes.value) : null;
      const prevUnpaid = new Map<number, number>();
      if (prevRes.status === 'fulfilled') for (const b of prevRes.value) prevUnpaid.set(b.elderlyId, remainingDue(b));
      const byElder = new Map(loadedBills.map((b) => [b.elderlyId, b]));
      const nextDrafts: Record<number, CopayDraft> = {};
      const keys: Record<number, string> = {};
      for (const elder of elders) {
        const bill = byElder.get(elder.id);
        const days = present ? present.get(elder.id) ?? 0 : null;
        const draft = bill ? draftFromBill(bill) : defaultDraft(elder, days && days > 0 ? days : null, prevUnpaid.get(elder.id) ?? 0);
        nextDrafts[elder.id] = draft;
        keys[elder.id] = draftKey(draft);
      }
      setBills(loadedBills);
      setDrafts(nextDrafts);
      setInitialKeys(keys);
      setAttendance(present);
      setLoading(false);
    },
    [elders, eldersLoading],
  );

  useEffect(() => {
    void load(month);
  }, [month, load]);

  const billByElder = useMemo(() => new Map(bills.map((b) => [b.elderlyId, b])), [bills]);
  const isEdited = useCallback(
    (id: number) => drafts[id] !== undefined && draftKey(drafts[id]) !== initialKeys[id],
    [drafts, initialKeys],
  );
  const anyEdited = elders.some((e) => isEdited(e.id));

  const savableIds = useMemo(
    () =>
      elders
        .filter((e) => {
          const d = drafts[e.id];
          if (!d || isBuildError(buildFromDraft(e.id, month, d))) return false;
          return billByElder.has(e.id) ? isEdited(e.id) : (d.days ?? 0) > 0;
        })
        .map((e) => e.id),
    [elders, drafts, month, billByElder, isEdited],
  );

  const saveOne = async (elderId: number): Promise<boolean> => {
    const draft = drafts[elderId];
    if (!draft) return false;
    const built = buildFromDraft(elderId, month, draft);
    if (isBuildError(built)) {
      notify(built.error, 'error');
      return false;
    }
    setSavingIds((prev) => new Set(prev).add(elderId));
    try {
      const saved = await saveCopayBill(built);
      setBills((prev) => [...prev.filter((b) => b.elderlyId !== elderId), saved]);
      setInitialKeys((prev) => ({ ...prev, [elderId]: draftKey(draft) }));
      return true;
    } catch (e) {
      notify(errorText(e, '청구서를 저장하지 못했습니다'), 'error');
      return false;
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(elderId);
        return next;
      });
    }
  };

  const saveAll = async () => {
    if (bulkSaving) return;
    setBulkSaving(true);
    let ok = 0;
    for (const id of savableIds) {
      if (await saveOne(id)) ok += 1;
    }
    setBulkSaving(false);
    const failed = savableIds.length - ok;
    notify(failed === 0 ? `${ok}건을 저장했습니다` : `${ok}건 저장, ${failed}건은 저장하지 못했습니다`, failed === 0 ? 'success' : 'error');
  };

  const replaceBill = (saved: CopayBill) => setBills((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));

  const copyNotice = async (bill: CopayBill) => {
    const text = copayNoticeText(bill, companyNameStored());
    try {
      await navigator.clipboard.writeText(text);
      notify('안내 문자를 복사했습니다. 납부 계좌를 채워 보내 주세요', 'success');
    } catch {
      // 클립보드를 쓸 수 없는 환경(권한·http)에서는 직접 복사하도록 글을 보여 준다
      setNoticeText(text);
    }
  };

  const removeBill = async () => {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteCopayBill(deleteTarget.id);
      const elder = elders.find((e) => e.id === deleteTarget.elderlyId);
      setBills((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      // 지운 뒤에는 처음 상태(프로필 등급·출석일수)로 다시 채운다
      if (elder) {
        const days = attendance?.get(elder.id) ?? null;
        const fresh = defaultDraft(elder, days && days > 0 ? days : null, 0);
        setDrafts((prev) => ({ ...prev, [elder.id]: fresh }));
        setInitialKeys((prev) => ({ ...prev, [elder.id]: draftKey(fresh) }));
      }
      setDeleteTarget(null);
      notify('청구서를 삭제했습니다', 'success');
    } catch (e) {
      setDeleteTarget(null);
      notify(errorText(e, '청구서를 삭제하지 못했습니다'), 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const requestMonth = (next: string) => {
    if (next === month) return;
    if (anyEdited) setPendingMonth(next);
    else setMonth(next);
  };

  const totalDue = bills.reduce((s, b) => s + b.totalDue, 0);
  const totalPaid = bills.reduce((s, b) => s + b.paidAmount, 0);
  const totalRemaining = bills.reduce((s, b) => s + remainingDue(b), 0);
  const unpaidCount = bills.filter((b) => b.status !== 'PAID').length;
  const busy = loading || eldersLoading;

  return (
    <div className={styles.stack}>
      <Banner
        status="info"
        title="금액은 2026년 수가 기준 어림 계산입니다"
        description="가산·미이용일 등은 반영하지 않았어요. 실제 청구액은 공단 청구 프로그램의 값과 맞춰 확인해 주세요."
      />

      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={requestMonth} isDisabled={busy} />
        <Button label="새로 불러오기" variant="ghost" isDisabled={busy} onClick={() => (anyEdited ? setPendingMonth(month) : void load(month))} />
        <div style={{ marginInlineStart: 'auto' }}>
          <Button
            label={`전체 저장 (${savableIds.length}건)`}
            variant="primary"
            isLoading={bulkSaving}
            isDisabled={busy || bulkSaving || savableIds.length === 0}
            onClick={() => void saveAll()}
          />
        </div>
      </div>

      {eldersError && <ErrorBanner message={eldersError} onRetry={() => void reloadElders()} />}
      {error && <ErrorBanner message={error} onRetry={() => void load(month)} />}

      {busy ? (
        <Loading size="section" label="청구서를 불러오는 중..." />
      ) : elders.length === 0 ? (
        <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />
      ) : (
        <>
          <Card padding={4}>
            <div className={styles.figures} style={{ background: 'transparent', padding: 0 }}>
              <SummaryFigure label="청구 합계" value={formatWon(totalDue)} />
              <SummaryFigure label="받은 금액" value={formatWon(totalPaid)} />
              <SummaryFigure label="남은 금액" value={formatWon(totalRemaining)} strong />
              <SummaryFigure label="미납·일부 납부" value={`${unpaidCount}명`} />
            </div>
          </Card>

          <Card padding={0}>
            {elders.map((elder) => {
              const draft = drafts[elder.id];
              if (!draft) return null;
              return (
                <CopayRow
                  key={elder.id}
                  elder={elder}
                  month={month}
                  draft={draft}
                  bill={billByElder.get(elder.id) ?? null}
                  dirty={isEdited(elder.id)}
                  isSaving={savingIds.has(elder.id)}
                  attendanceDays={attendance ? attendance.get(elder.id) ?? 0 : null}
                  onChange={(next) => setDrafts((prev) => ({ ...prev, [elder.id]: next }))}
                  onSave={() => void saveOne(elder.id)}
                  onPay={() => setPayBill(billByElder.get(elder.id) ?? null)}
                  onNotice={() => {
                    const bill = billByElder.get(elder.id);
                    if (bill) void copyNotice(bill);
                  }}
                  onDelete={() => setDeleteTarget(billByElder.get(elder.id) ?? null)}
                />
              );
            })}
          </Card>

          <CopayDepositPanel key={month} bills={bills} onApplied={replaceBill} />
        </>
      )}

      {payBill && (
        <CopayPaymentDialog
          key={payBill.id}
          bill={payBill}
          onClose={() => setPayBill(null)}
          onSaved={(saved) => {
            replaceBill(saved);
            setPayBill(null);
            notify(`${saved.elderlyName} 어르신 수납을 기록했습니다`, 'success');
          }}
        />
      )}

      <LabConfirm
        isOpen={deleteTarget !== null}
        title="청구서를 삭제할까요?"
        description={deleteTarget ? `${deleteTarget.elderlyName} 어르신의 청구서와 수납 기록이 함께 지워지며 되돌릴 수 없습니다.` : ''}
        actionLabel="삭제"
        isLoading={deleteBusy}
        onConfirm={() => void removeBill()}
        onClose={() => setDeleteTarget(null)}
      />

      <LabConfirm
        isOpen={pendingMonth !== null}
        title="저장하지 않은 변경이 있습니다"
        description="계속하면 지금 입력한 내용이 사라지고 청구서를 새로 불러옵니다."
        actionLabel="계속"
        onConfirm={() => {
          const target = pendingMonth;
          setPendingMonth(null);
          if (target === null) return;
          if (target === month) void load(month);
          else setMonth(target);
        }}
        onClose={() => setPendingMonth(null)}
      />

      {noticeText !== null && (
        <Dialog isOpen onOpenChange={(open) => !open && setNoticeText(null)} purpose="info" width="min(460px, calc(100vw - 24px))">
          <Layout
            header={<DialogHeader title="안내 문자" onOpenChange={(open) => !open && setNoticeText(null)} />}
            content={
              <LayoutContent>
                <VStack gap={2}>
                  <Text type="supporting" color="secondary">
                    자동 복사가 되지 않았습니다. 아래 글을 선택해 복사해 주세요.
                  </Text>
                  <TextArea label="안내 문자 내용" isLabelHidden value={noticeText} onChange={setNoticeText} rows={12} />
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack hAlign="end">
                  <Button label="닫기" variant="primary" onClick={() => setNoticeText(null)} />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}
    </div>
  );
}

function SummaryFigure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={styles.figure}>
      <Text type="supporting" color="secondary">
        {label}
      </Text>
      <Text type="large" weight={strong ? 'bold' : 'semibold'} hasTabularNumbers>
        {value}
      </Text>
    </div>
  );
}
