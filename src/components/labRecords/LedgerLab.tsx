'use client';

/**
 * 회계 장부 — 현금출납부(월), 카드·통장 붙여넣기, 연간 요약 세 보기.
 * 그 해 장부를 한 번에 받아(listLedgerEntriesByYear) 현금출납부 잔액·이월·연간 요약을 모두 같은 자료로 계산한다.
 * 연초 이월 잔액은 장부에 없는 값이라 이 브라우저에 해마다 따로 적어 둔다. 붙여넣기 화면은 숨기기만 해 입력이 사라지지 않게 한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { ErrorBanner, LabConfirm, MonthStepper, SupportText, useNotify } from '@/components/lab/LabUi';
import { currentMonth, errorText, monthLabel, readStored, todayString, writeStored } from '@/components/lab/labFormat';
import { createLedgerEntry, deleteLedgerEntry, listDonations, listLedgerEntriesByYear, updateLedgerEntry } from '@/lib/lab/labApi';
import { cashBook, cashBookTotals, carryForward } from '@/lib/lab/ledgerRules';
import type { Donation, LedgerEntry } from '@/lib/lab/labTypes';
import LedgerBook from './LedgerBook';
import { cashBookCsv } from './LedgerCsv';
import { draftOfEntry, draftIssues, emptyDraft, inputOfDraft } from './LedgerDraft';
import type { EntryDraft } from './LedgerDraft';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerNotes from './LedgerNotes';
import LedgerPaste from './LedgerPaste';
import LedgerSummary from './LedgerSummary';
import { downloadCsv } from './FinanceFormat';
import FinanceMoneyField from './FinanceMoneyField';
import { MAX_LEDGER_AMOUNT } from '@/lib/lab/ledgerRules';
import { dedupeById, useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

type View = 'book' | 'paste' | 'summary';

const openingKey = (year: number) => `carev.lab.ledger.opening.${year}`;

function readOpening(year: number): number {
  const n = Number(readStored(openingKey(year)));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** 오늘이 이 달이면 오늘, 아니면 그 달 1일 */
function defaultDate(month: string): string {
  const today = todayString();
  return today.startsWith(`${month}-`) ? today : `${month}-01`;
}

export default function LedgerLab() {
  const alive = useAlive();
  const notify = useNotify();
  const [view, setView] = useState<View>('book');
  const [month, setMonth] = useState(currentMonth());
  const year = Number(month.slice(0, 4));
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loadedYear, setLoadedYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donationNote, setDonationNote] = useState<string | null>(null);
  const [opening, setOpening] = useState(() => readOpening(year));
  const [draft, setDraft] = useState<EntryDraft>(() => emptyDraft(defaultDate(currentMonth())));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<LedgerEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    const [e, d1, d0] = await Promise.allSettled([listLedgerEntriesByYear(year), listDonations(year), listDonations(year - 1)]);
    if (!alive.current || n !== seq.current) return; // 늦게 온 응답은 버린다
    if (e.status === 'fulfilled') {
      setEntries(dedupeById(e.value));
      setLoadedYear(year);
    } else {
      setEntries([]);
      setLoadedYear(null);
      setError(errorText(e.reason, '장부를 불러오지 못했습니다'));
    }
    const list = [...(d1.status === 'fulfilled' ? d1.value : []), ...(d0.status === 'fulfilled' ? d0.value : [])];
    setDonations(dedupeById(list));
    setDonationNote(d1.status === 'rejected' || d0.status === 'rejected' ? '후원금 목록을 다 불러오지 못했습니다. 연결하려는 후원금이 보이지 않을 수 있습니다.' : null);
    setLoading(false);
  }, [year, alive]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  useEffect(() => {
    setOpening(readOpening(year));
  }, [year]);

  const changeOpening = (value: number | null) => {
    const v = value ?? 0;
    setOpening(v);
    writeStored(openingKey(year), String(v));
  };

  const changeMonth = (m: string) => {
    setMonth(m);
    // 새로 적는 중이면 날짜를 그 달로 옮긴다(고치는 중인 줄은 그대로 둔다)
    setDraft((d) => (d.id === null ? { ...d, date: defaultDate(m) } : d));
  };

  const book = useMemo(() => {
    const monthOpening = carryForward(entries, month, opening);
    const rows = cashBook(entries, month, monthOpening);
    return { rows, totals: cashBookTotals(rows, monthOpening) };
  }, [entries, month, opening]);
  const entryById = useMemo(() => new Map(entries.map((x) => [x.id, x])), [entries]);

  const save = async () => {
    if (savingRef.current) return;
    const issues = draftIssues(draft);
    if (issues.length > 0) {
      setSaveError(issues[0]);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = inputOfDraft(draft);
      const saved = draft.id === null ? await createLedgerEntry(input) : await updateLedgerEntry(draft.id, input);
      if (!alive.current) return;
      // 저장한 줄이 다른 해로 옮겨 갔으면 이 해 목록에서는 뺀다
      setEntries((cur) => {
        const rest = cur.filter((x) => x.id !== saved.id);
        return saved.entryDate.startsWith(`${year}-`) ? [...rest, saved] : rest;
      });
      notify(draft.id === null ? '장부에 적었습니다' : '장부 줄을 고쳤습니다', 'success');
      // 같은 날 여러 건을 빨리 넣도록 날짜·수입/지출은 두고 나머지를 비운다
      setDraft(emptyDraft(draft.date, draft.direction));
      setTimeout(() => descriptionRef.current?.focus(), 0);
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '장부에 기록하지 못했습니다'));
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const edit = (entry: LedgerEntry) => {
    setDraft(draftOfEntry(entry));
    setSaveError(null);
    setTimeout(() => descriptionRef.current?.focus(), 0);
  };

  const remove = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteLedgerEntry(toDelete.id);
      if (!alive.current) return;
      const id = toDelete.id;
      setEntries((cur) => cur.filter((x) => x.id !== id));
      setDraft((d) => (d.id === id ? emptyDraft(d.date, d.direction) : d));
      notify('장부 줄을 삭제했습니다', 'success');
      setToDelete(null);
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '장부 기록을 삭제하지 못했습니다'), 'error');
        setToDelete(null);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const onPasted = (saved: LedgerEntry[]) =>
    setEntries((cur) => {
      const ids = new Set(saved.map((x) => x.id));
      return [...cur.filter((x) => !ids.has(x.id)), ...saved.filter((x) => x.entryDate.startsWith(`${year}-`))];
    });

  const ready = loadedYear === year;

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <SegmentedControl label="장부 보기" value={view} onChange={(v) => setView(v as View)}>
          <SegmentedControlItem value="book" label="현금출납부" />
          <SegmentedControlItem value="paste" label="붙여넣기" />
          <SegmentedControlItem value="summary" label="연간 요약" />
        </SegmentedControl>
        <MonthStepper value={month} onChange={changeMonth} isDisabled={saving} />
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {loading && !ready ? (
        <Loading size="section" label="장부를 불러오는 중..." />
      ) : (
        <>
          <div hidden={view !== 'book'}>
            <div className={styles.stack}>
            <LedgerEntryForm
              draft={draft}
              onChange={setDraft}
              donations={donations}
              donationNote={donationNote}
              saving={saving}
              error={saveError}
              onSave={() => void save()}
              onCancel={() => {
                setDraft(emptyDraft(draft.date, draft.direction));
                setSaveError(null);
              }}
              descriptionRef={descriptionRef}
            />
            <Card padding={4}>
              <div className={styles.stackTight}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text type="label">{monthLabel(month)} 현금출납부</Text>
                  <span className={styles.spacer} />
                  <Button label="CSV 내려받기" variant="secondary" isDisabled={!ready} onClick={() => downloadCsv(`현금출납부_${month}.csv`, cashBookCsv(book.rows, book.totals, entryById))} />
                </HStack>
                <FinanceMoneyField
                  label={`${year}년 연초 이월 잔액 (원)`}
                  value={opening === 0 ? null : opening}
                  onChange={changeOpening}
                  max={MAX_LEDGER_AMOUNT}
                  placeholder="0"
                  description="장부를 쓰기 시작할 때의 현금 잔액. 이 브라우저에만 저장되며, 1월 이월과 이후 잔액 계산에 쓰입니다"
                />
                <LedgerBook rows={book.rows} totals={book.totals} entryById={entryById} isBusy={saving || deleting} onEdit={edit} onDelete={setToDelete} />
                <SupportText>잔액은 연초 이월 잔액에 날짜순으로 수입을 더하고 지출을 빼서 계산합니다. 같은 날은 입력한 순서입니다.</SupportText>
              </div>
            </Card>
            </div>
          </div>
          <div hidden={view !== 'paste'}>
            <LedgerPaste year={year} fallbackDate={defaultDate(month)} existing={entries} onSaved={onPasted} />
          </div>
          <div hidden={view !== 'summary'}>
            <Card padding={4}>
              <LedgerSummary year={year} entries={entries} />
            </Card>
          </div>
        </>
      )}

      <LedgerNotes />

      <LabConfirm
        isOpen={toDelete !== null}
        title="이 장부 줄을 삭제할까요?"
        description={toDelete ? `${toDelete.entryDate} ${toDelete.description} ${toDelete.amount.toLocaleString('ko-KR')}원 — 삭제하면 되돌릴 수 없습니다.` : ''}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
