'use client';

/**
 * 통장 대사 — 통장 목록, 달별 월말 잔액 대사, 통장 거래 붙여넣기 맞추기, 후원금 전용계좌 점검, 대사표 인쇄.
 * 기본 달은 지난달이다: 월말 잔액은 달이 끝나야 통장에서 확인되고, 통장 거래내역도 보통 달이 지난 뒤 정리하기 때문이다.
 * 장부는 통장별 구분이 없으므로 가장 이른 통장 시작일부터 선택한 달까지의 해마다 장부를 받아(listLedgerEntriesByYear) 한꺼번에 계산한다.
 * 통장 거래 글은 이 화면에서만 쓰고 AI로 보내지 않는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/lab/LabUi';
import MonthBar from './BankReconMonthBar';
import { currentMonth, errorText, shiftMonth } from '@/components/lab/labFormat';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { listBankAccounts, listBankStatements, listDonations, listLedgerEntriesByYear } from '@/lib/lab/labApi';
import type { StatementLine } from '@/lib/lab/bankRules';
import type { BankAccount, BankStatement, Donation, LedgerEntry } from '@/lib/lab/labTypes';
import BankReconAccounts from './BankReconAccounts';
import { reconView, yearsToLoad } from './BankReconBook';
import BankReconDonation from './BankReconDonation';
import { buildMatch } from './BankReconMatch';
import BankReconMonth from './BankReconMonth';
import BankReconNotes from './BankReconNotes';
import BankReconPaste from './BankReconPaste';
import BankReconPrint from './BankReconPrint';
import styles from './labPlans.module.css';

/** 선택한 달 기본값: 지난달 */
const defaultMonth = () => shiftMonth(currentMonth(), -1);

export default function BankReconLab() {
  const alive = useAlive();
  const [month, setMonth] = useState(defaultMonth);
  const year = Number(month.slice(0, 4));
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [statementsMonth, setStatementsMonth] = useState<string | null>(null);
  const [statementsError, setStatementsError] = useState<string | null>(null);
  const [byYear, setByYear] = useState<Record<number, LedgerEntry[]>>({});
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donationsYear, setDonationsYear] = useState<number | null>(null);
  const [donationsError, setDonationsError] = useState<string | null>(null);
  const [lines, setLines] = useState<StatementLine[] | null>(null);
  const [printKey, setPrintKey] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const byYearRef = useRef(byYear);
  byYearRef.current = byYear;

  // 통장 목록
  const loadAccounts = useCallback(async () => {
    setAccountsError(null);
    try {
      const list = await listBankAccounts();
      if (!alive.current) return;
      setAccounts(dedupeById(list));
      setAccountsLoaded(true);
    } catch (e) {
      if (alive.current) {
        setAccountsError(errorText(e, '통장 목록을 불러오지 못했습니다'));
        setAccountsLoaded(true);
      }
    }
  }, [alive]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts, reloadKey]);

  // 그 달 월말 잔액
  useEffect(() => {
    let stale = false;
    setStatementsError(null);
    listBankStatements({ month })
      .then((list) => {
        if (stale || !alive.current) return;
        setStatements(dedupeById(list));
        setStatementsMonth(month);
      })
      .catch((e) => {
        if (stale || !alive.current) return;
        setStatements([]);
        setStatementsMonth(null);
        setStatementsError(errorText(e, '통장 월말 잔액을 불러오지 못했습니다'));
      });
    return () => {
      stale = true;
    };
  }, [month, alive, reloadKey]);

  // 장부(통장 시작 연도부터 선택한 해까지)
  const neededYears = useMemo(() => yearsToLoad(accounts, month), [accounts, month]);
  const neededKey = neededYears.join(',');
  useEffect(() => {
    if (!accountsLoaded) return undefined;
    let stale = false;
    const missing = neededYears.filter((y) => byYearRef.current[y] === undefined);
    if (missing.length === 0) {
      setLedgerError(null);
      setLedgerLoading(false);
      return undefined;
    }
    setLedgerLoading(true);
    setLedgerError(null);
    Promise.allSettled(missing.map((y) => listLedgerEntriesByYear(y))).then((results) => {
      if (stale || !alive.current) return;
      const next: Record<number, LedgerEntry[]> = {};
      let failed: unknown = null;
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[missing[i]] = dedupeById(r.value);
        else failed = r.reason;
      });
      setByYear((cur) => ({ ...cur, ...next }));
      setLedgerError(failed === null ? null : errorText(failed, '회계 장부를 불러오지 못했습니다'));
      setLedgerLoading(false);
    });
    return () => {
      stale = true;
    };
    // neededKey는 neededYears의 요약이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsLoaded, neededKey, alive, reloadKey]);

  // 후원금(그 해)
  useEffect(() => {
    let stale = false;
    setDonationsError(null);
    listDonations(year)
      .then((list) => {
        if (stale || !alive.current) return;
        setDonations(dedupeById(list));
        setDonationsYear(year);
      })
      .catch((e) => {
        if (stale || !alive.current) return;
        setDonations([]);
        setDonationsYear(null);
        setDonationsError(errorText(e, '후원금 목록을 불러오지 못했습니다'));
      });
    return () => {
      stale = true;
    };
  }, [year, alive, reloadKey]);

  const ledgerReady = accountsLoaded && !ledgerLoading && neededYears.every((y) => byYear[y] !== undefined);
  const allEntries = useMemo(() => dedupeById(Object.values(byYear).flat()), [byYear]);
  const monthStatements = useMemo(() => (statementsMonth === month ? statements : []), [statementsMonth, month, statements]);
  const view = useMemo(() => reconView(accounts, monthStatements, ledgerReady ? allEntries : [], month), [accounts, monthStatements, ledgerReady, allEntries, month]);
  const match = useMemo(() => (lines === null || lines.length === 0 ? null : buildMatch(lines, allEntries, month)), [lines, allEntries, month]);

  const addEntry = (entry: LedgerEntry) => {
    const y = Number(entry.entryDate.slice(0, 4));
    setByYear((cur) => ({ ...cur, [y]: dedupeById([...(cur[y] ?? []), entry]) }));
  };

  const saveStatementsFor = (s: BankStatement) =>
    setStatements((cur) => [...cur.filter((x) => !(x.accountId === s.accountId && x.statementMonth === s.statementMonth)), s]);

  if (!accountsLoaded) return <Loading size="section" label="통장을 불러오는 중..." />;

  const yearEntries = byYear[year] ?? [];
  const anyError = accountsError ?? statementsError ?? ledgerError;

  return (
    <div className={styles.stack}>
      <MonthBar month={month} onChange={setMonth} />
      {anyError && <ErrorBanner message={anyError} onRetry={() => { setByYear({}); setReloadKey((k) => k + 1); }} />}
      {ledgerLoading && <Loading size="section" label="회계 장부를 불러오는 중..." />}

      <BankReconAccounts
        accounts={accounts}
        onSaved={(a) => setAccounts((cur) => [...cur.filter((x) => x.id !== a.id), a].sort((x, y) => x.id - y.id))}
        onDeleted={(id) => setAccounts((cur) => cur.filter((x) => x.id !== id))}
      />

      <BankReconMonth
        month={month}
        view={view}
        statements={monthStatements}
        ledgerReady={ledgerReady}
        printDisabled={!ledgerReady}
        onSaved={saveStatementsFor}
        onDeleted={(id) => setStatements((cur) => cur.filter((x) => x.id !== id))}
        onPrint={() => setPrintKey((k) => k + 1)}
      />

      <BankReconPaste month={month} match={match} ledgerReady={ledgerReady} onParsed={setLines} onEntrySaved={addEntry} />

      <BankReconDonation
        month={month}
        accounts={accounts}
        statements={monthStatements}
        entries={yearEntries}
        donations={donationsYear === year ? donations : []}
        loading={ledgerLoading || (donationsYear !== year && donationsError === null)}
        error={donationsError ?? (ledgerReady ? null : ledgerError)}
      />

      <BankReconNotes />

      <BankReconPrint month={month} view={view} statements={monthStatements} match={match} printKey={printKey} onReady={() => window.print()} />
    </div>
  );
}
