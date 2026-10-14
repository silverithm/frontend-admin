'use client';

/**
 * 후원금 — 해를 고르고 받은 후원금을 적고, 어디에 얼마 썼는지(회계 장부의 연결된 지출)와 남은 금액을 본다.
 * 연도별 수입·사용 결과 보고서 인쇄와 CSV 내려받기가 있다. 후원자 이름은 기본으로 가려 보여 준다.
 * 사용액은 서버가 센 usedAmount가 기준이고, 사용 내역은 그 해와 다음 해 장부에서 연결된 지출을 찾아 보인다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { ErrorBanner, LabConfirm, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import { toCsv } from '@/lib/lab/copayBill';
import type { CsvHeader } from '@/lib/lab/copayBill';
import { createDonation, deleteDonation, listDonations, listLedgerEntriesByYear, updateDonation } from '@/lib/lab/labApi';
import type { Donation, LedgerEntry } from '@/lib/lab/labTypes';
import { DONOR_TYPE_LABEL, KIND_LABEL, donationIssues, draftOfDonation, emptyDonationDraft, inputOfDonationDraft } from './DonationDraft';
import type { DonationDraft } from './DonationDraft';
import DonationForm from './DonationForm';
import DonationList from './DonationList';
import DonationReport from './DonationReport';
import { downloadCsv, maskName, num } from './FinanceFormat';
import { dedupeById, useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface CsvRow {
  date: string;
  donor: string;
  donorType: string;
  kind: string;
  amount: number;
  goods: string;
  purpose: string;
  receipt: string;
  used: number;
  remaining: number;
}

const CSV_HEADERS: ReadonlyArray<CsvHeader<CsvRow>> = [
  { key: 'date', label: '받은 날짜' },
  { key: 'donor', label: '후원자' },
  { key: 'donorType', label: '후원자 구분' },
  { key: 'kind', label: '현금·물품' },
  { key: 'amount', label: '금액(원)' },
  { key: 'goods', label: '물품 설명' },
  { key: 'purpose', label: '지정 용도' },
  { key: 'receipt', label: '영수증 번호' },
  { key: 'used', label: '사용(원)' },
  { key: 'remaining', label: '남은 금액(원)' },
];

export default function DonationLab() {
  const alive = useAlive();
  const notify = useNotify();
  const thisYear = Number(todayString().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ledgerNote, setLedgerNote] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(false);
  const [draft, setDraft] = useState<DonationDraft>(() => emptyDonationDraft(todayString()));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Donation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [printKey, setPrintKey] = useState(0);
  const seq = useRef(0);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    // 쓴 지출은 후원금을 받은 해보다 나중 해 장부에 있을 수 있어 다음 해(올해까지)도 함께 본다
    const years = year < thisYear ? [year, year + 1] : [year];
    const [d, ...l] = await Promise.allSettled([listDonations(year), ...years.map((y) => listLedgerEntriesByYear(y))]);
    if (!alive.current || n !== seq.current) return; // 늦게 온 응답은 버린다
    if (d.status === 'fulfilled') setDonations(dedupeById(d.value));
    else {
      setDonations([]);
      setError(errorText(d.reason, '후원금을 불러오지 못했습니다'));
    }
    const ok = l.filter((x): x is PromiseFulfilledResult<LedgerEntry[]> => x.status === 'fulfilled');
    setEntries(dedupeById(ok.flatMap((x) => x.value)));
    setLedgerNote(ok.length < l.length ? '회계 장부를 다 불러오지 못해 사용 내역이 일부 비어 있을 수 있습니다. 사용 금액은 서버가 센 값입니다.' : null);
    setLoading(false);
  }, [year, thisYear, alive]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  const changeYear = (y: number) => {
    setYear(y);
    // 새로 적는 중이면 받은 날짜를 그 해로 옮긴다
    setDraft((d) => (d.id === null ? { ...d, receivedOn: y === thisYear ? todayString() : `${y}-12-31` } : d));
  };

  const sorted = useMemo(() => [...donations].sort((a, b) => (a.receivedOn < b.receivedOn ? 1 : a.receivedOn > b.receivedOn ? -1 : b.id - a.id)), [donations]);
  const totals = useMemo(() => {
    const amount = donations.reduce((s, d) => s + d.amount, 0);
    const used = donations.reduce((s, d) => s + d.usedAmount, 0);
    return { amount, used, remaining: amount - used };
  }, [donations]);

  const save = async () => {
    if (savingRef.current) return;
    const issues = donationIssues(draft);
    if (issues.length > 0) {
      setSaveError(issues[0]);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = inputOfDonationDraft(draft);
      const saved = draft.id === null ? await createDonation(input) : await updateDonation(draft.id, input);
      if (!alive.current) return;
      setDonations((cur) => {
        const rest = cur.filter((x) => x.id !== saved.id);
        // 다른 해로 옮겨 갔으면 이 해 목록에서는 뺀다
        return saved.receivedOn.startsWith(`${year}-`) ? [...rest, saved] : rest;
      });
      notify(draft.id === null ? '후원금을 기록했습니다' : '후원금을 고쳤습니다', 'success');
      setDraft(emptyDonationDraft(draft.receivedOn));
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '후원금을 기록하지 못했습니다'));
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteDonation(toDelete.id);
      if (!alive.current) return;
      const id = toDelete.id;
      setDonations((cur) => cur.filter((x) => x.id !== id));
      setDraft((d) => (d.id === id ? emptyDonationDraft(d.receivedOn) : d));
      notify('후원금을 삭제했습니다', 'success');
      setToDelete(null);
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '후원금을 삭제하지 못했습니다. 연결된 지출이 있으면 먼저 장부에서 연결을 풀어 주세요'), 'error');
        setToDelete(null);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const exportCsv = () => {
    const rows: CsvRow[] = sorted.map((d) => ({
      date: d.receivedOn,
      donor: showNames ? d.donorName : maskName(d.donorName),
      donorType: DONOR_TYPE_LABEL[d.donorType],
      kind: KIND_LABEL[d.kind],
      amount: d.amount,
      goods: d.goodsDescription ?? '',
      purpose: d.designatedPurpose ?? '',
      receipt: d.receiptNo ?? '',
      used: d.usedAmount,
      remaining: d.amount - d.usedAmount,
    }));
    downloadCsv(`후원금_${year}.csv`, toCsv(rows, CSV_HEADERS));
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <HStack gap={1} vAlign="center">
          <Button label="이전 해" variant="ghost" size="sm" isDisabled={saving} onClick={() => changeYear(year - 1)} />
          <Text type="label" hasTabularNumbers>
            {year}년
          </Text>
          <Button label="다음 해" variant="ghost" size="sm" isDisabled={saving || year >= thisYear} onClick={() => changeYear(year + 1)} />
        </HStack>
        <CheckboxInput label="후원자 이름 전체 보이기" value={showNames} onChange={setShowNames} />
        <span className={styles.spacer} />
        <Button label="CSV 내려받기" variant="secondary" isDisabled={loading || sorted.length === 0} onClick={exportCsv} />
        <Button label="사용 결과 보고서 인쇄" variant="primary" isDisabled={loading || sorted.length === 0} onClick={() => setPrintKey((k) => k + 1)} />
      </div>

      <DonationForm
        draft={draft}
        onChange={setDraft}
        saving={saving}
        error={saveError}
        onSave={() => void save()}
        onCancel={() => {
          setDraft(emptyDonationDraft(draft.receivedOn));
          setSaveError(null);
        }}
      />

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      <Card padding={4}>
        <div className={styles.stackTight}>
          <div className={styles.toolbar}>
            <div className={styles.statBox}>
              <Text type="supporting" color="secondary">
                {year}년 받은 후원금 ({donations.length}건)
              </Text>
              <Text type="label" hasTabularNumbers>
                {num(totals.amount)}원
              </Text>
            </div>
            <div className={styles.statBox}>
              <Text type="supporting" color="secondary">
                사용
              </Text>
              <Text type="label" hasTabularNumbers>
                {num(totals.used)}원
              </Text>
            </div>
            <div className={styles.statBox}>
              <Text type="supporting" color="secondary">
                남은 금액
              </Text>
              <Text type="label" hasTabularNumbers>
                {num(totals.remaining)}원
              </Text>
            </div>
          </div>
          {ledgerNote && <SupportText tone="warn">{ledgerNote}</SupportText>}
          {loading && donations.length === 0 ? (
            <Loading size="section" label="후원금을 불러오는 중..." />
          ) : (
            <DonationList
              donations={sorted}
              entries={entries}
              showNames={showNames}
              isBusy={saving || deleting}
              onEdit={(d) => {
                setDraft(draftOfDonation(d));
                setSaveError(null);
              }}
              onDelete={setToDelete}
            />
          )}
          <SupportText>후원금으로 쓴 지출은 회계 장부에서 “후원금 연결”을 골라 적으면 사용 금액과 남은 금액에 반영됩니다. 후원금 사용 결과의 공개·보고 기준은 관할 기관에 확인해 주세요(대조 필요).</SupportText>
        </div>
      </Card>

      <DonationReport year={year} donations={sorted} entries={entries} maskNames={!showNames} printKey={printKey} onReady={() => window.print()} />

      <LabConfirm
        isOpen={toDelete !== null}
        title="이 후원금을 삭제할까요?"
        description={toDelete ? `${toDelete.receivedOn} ${showNames ? toDelete.donorName : maskName(toDelete.donorName)} ${num(toDelete.amount)}원 — 삭제하면 되돌릴 수 없습니다.` : ''}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
