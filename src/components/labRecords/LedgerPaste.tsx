'use client';

/**
 * 카드·통장 내역 붙여넣기 → AI 계정 제안 → 고르거나 바꿔서 한 번에 저장.
 * 줄 해석(날짜·금액·수입/지출)은 이 브라우저에서 규칙으로 하고, 계정만 aiClassifyLedger가 제안한다(적요와 금액만 보내고 이름은 지운다).
 * AI 제안은 고치기 전까지 제안일 뿐이며 자동 저장하지 않는다. 사람이 고른 계정은 다음 제안이 덮어쓰지 않는다.
 */
import { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { AiChip, Chip, ErrorBanner, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { aiClassifyLedger, createLedgerEntry } from '@/lib/lab/labApi';
import { isAccountCode, ledgerEntryIssues } from '@/lib/lab/ledgerRules';
import type { LedgerDirection, LedgerEntry, LedgerEvidenceType } from '@/lib/lab/labTypes';
import { DIRECTION_LABEL, EVIDENCE_LABEL } from './LedgerDraft';
import { MAX_PASTE_LINES, parseLedgerPaste } from './LedgerPasteParse';
import { accountOptions, YMD_PATTERN } from './FinanceFormat';
import FinanceMoneyField from './FinanceMoneyField';
import { useAlive, useLatest } from './recordsFormat';
import styles from './labRecords.module.css';

const AI_CHUNK = 50;

interface PasteRow {
  key: number;
  include: boolean;
  date: string;
  direction: LedgerDirection;
  description: string;
  amount: number | null;
  accountCode: string;
  source: 'ai' | 'user' | null;
  reason: string;
  duplicate: boolean;
  error: string | null;
}

interface Props {
  /** 붙여 넣은 줄의 연도가 없을 때 쓰는 연도와 날짜 */
  year: number;
  fallbackDate: string;
  /** 이미 장부에 있는 줄(같은 날짜·금액·방향이면 "이미 있음"으로 표시) */
  existing: LedgerEntry[];
  onSaved: (entries: LedgerEntry[]) => void;
}

export default function LedgerPaste({ year, fallbackDate, existing, onSaved }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<PasteRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<LedgerEvidenceType | ''>('CARD');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const rowsRef = useLatest(rows);
  const aiRef = useRef(false);
  const savingRef = useRef(false);
  const aiSeq = useRef(0);
  const keyRef = useRef(0);

  const patch = (key: number, p: Partial<PasteRow>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p, error: null } : r)));

  const parse = () => {
    const result = parseLedgerPaste(text, year, fallbackDate);
    aiSeq.current += 1; // 이전 줄에 대한 AI 응답은 버린다
    const dupKey = (date: string, direction: string, amount: number) => `${date}|${direction}|${amount}`;
    const have = new Set(existing.map((e) => dupKey(e.entryDate, e.direction, e.amount)));
    setRows(
      result.lines.map((l) => {
        const duplicate = have.has(dupKey(l.date, l.direction, l.amount));
        return { key: ++keyRef.current, include: !duplicate, date: l.date, direction: l.direction, description: l.description, amount: l.amount, accountCode: '', source: null, reason: '', duplicate, error: null };
      }),
    );
    setAiError(null);
    setAiNote(null);
    setSaveError(null);
    const parts = [`${result.lines.length}줄을 읽었습니다`];
    if (result.skipped > 0) parts.push(`금액을 찾지 못한 ${result.skipped}줄은 건너뛰었습니다`);
    if (result.truncated > 0) parts.push(`${MAX_PASTE_LINES}줄을 넘는 ${result.truncated}줄은 잘랐습니다`);
    if (result.lines.length === 0) parts.push('날짜·금액이 있는 줄을 붙여 넣어 주세요');
    setNote(parts.join('. '));
  };

  const runAi = async () => {
    if (aiRef.current || savingRef.current) return;
    const targets = rowsRef.current.filter((r) => r.include && r.source !== 'user' && r.description.trim() !== '' && r.amount !== null && r.amount > 0);
    if (targets.length === 0) {
      setAiNote('계정을 제안할 줄이 없습니다. 적요가 있는 줄만 제안합니다.');
      return;
    }
    const n = ++aiSeq.current;
    aiRef.current = true;
    setAiLoading(true);
    setAiError(null);
    setAiNote(null);
    let applied = 0;
    let unknown = 0;
    try {
      for (let i = 0; i < targets.length; i += AI_CHUNK) {
        const chunk = targets.slice(i, i + AI_CHUNK);
        const result = await aiClassifyLedger({ lines: chunk.map((r) => ({ description: r.description, amount: r.amount ?? 0, direction: r.direction })) });
        if (!alive.current || n !== aiSeq.current) return; // 줄이 새로 해석됐거나 화면을 떠났으면 이 제안은 버린다
        // 응답이 도착한 시점의 최신 줄과 합친다 — 기다리는 동안 사람이 고른 계정과 바꾼 방향은 건드리지 않는다
        const byKey = new Map<number, { code: string; reason: string }>();
        for (const item of result.items) {
          const row = chunk[item.index];
          if (!row) continue;
          if (item.accountCode !== null && isAccountCode(row.direction, item.accountCode)) byKey.set(row.key, { code: item.accountCode, reason: item.reason });
          else unknown += 1;
        }
        const merged = rowsRef.current.map((r) => {
          const hit = byKey.get(r.key);
          const sent = chunk.find((c) => c.key === r.key);
          if (!hit || !sent || r.source === 'user' || r.direction !== sent.direction) return r;
          applied += 1;
          return { ...r, accountCode: hit.code, source: 'ai' as const, reason: hit.reason };
        });
        setRows(merged);
      }
      setAiNote(applied > 0 ? `${applied}줄에 계정을 제안했습니다${unknown > 0 ? `. ${unknown}줄은 알맞은 계정을 찾지 못했으니 직접 골라 주세요` : ''}. 읽어 보고 바꿔도 됩니다.` : '제안할 수 있는 계정이 없었습니다. 직접 골라 주세요.');
    } catch (e) {
      if (alive.current && n === aiSeq.current) setAiError(errorText(e, 'AI가 계정을 제안하지 못했습니다. 잠시 후 다시 시도하거나 직접 골라 주세요'));
    } finally {
      aiRef.current = false;
      if (alive.current) setAiLoading(false);
    }
  };

  const problems = useMemo(
    () =>
      rows.map((r) => {
        if (!r.include) return [] as string[];
        return ledgerEntryIssues({ entryDate: r.date, direction: r.direction, accountCode: r.accountCode, description: r.description, amount: r.amount ?? 0, counterparty: null });
      }),
    [rows],
  );
  const includedCount = rows.filter((r) => r.include).length;
  const readyCount = rows.filter((r, i) => r.include && problems[i].length === 0).length;

  const saveAll = async () => {
    if (savingRef.current || aiRef.current) return;
    const targets = rowsRef.current.filter((r) => r.include && ledgerEntryIssues({ entryDate: r.date, direction: r.direction, accountCode: r.accountCode, description: r.description, amount: r.amount ?? 0, counterparty: null }).length === 0);
    if (targets.length === 0) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    const savedEntries: LedgerEntry[] = [];
    const savedKeys = new Set<number>();
    const failed = new Map<number, string>();
    for (const r of targets) {
      if (!alive.current) break;
      try {
        const saved = await createLedgerEntry({
          entryDate: r.date,
          direction: r.direction,
          accountCode: r.accountCode,
          description: r.description.trim(),
          amount: r.amount ?? 0,
          counterparty: null,
          evidenceType: evidence === '' ? null : evidence,
          donationId: null,
          aiAssisted: r.source === 'ai',
        });
        savedEntries.push(saved);
        savedKeys.add(r.key);
      } catch (e) {
        failed.set(r.key, errorText(e, '저장하지 못했습니다'));
      }
    }
    savingRef.current = false;
    if (!alive.current) return;
    setSaving(false);
    // 저장된 줄은 목록에서 빼서 같은 줄을 두 번 저장하지 않게 한다
    setRows((cur) => cur.filter((r) => !savedKeys.has(r.key)).map((r) => (failed.has(r.key) ? { ...r, error: failed.get(r.key) ?? null } : r)));
    if (savedEntries.length > 0) {
      onSaved(savedEntries);
      notify(failed.size > 0 ? `${savedEntries.length}줄 저장, ${failed.size}줄은 저장하지 못했습니다` : `${savedEntries.length}줄을 장부에 저장했습니다`, failed.size > 0 ? 'error' : 'success');
    }
    if (failed.size > 0) setSaveError('저장하지 못한 줄은 아래에 남아 있습니다. 오류를 확인하고 다시 저장해 주세요');
  };

  return (
    <Card padding={0}>
      <Collapsible trigger={<Text type="label">카드·통장 내역 붙여넣기 · AI 계정 제안</Text>} defaultIsOpen={false}>
        <div style={{ padding: 'var(--spacing-4)' }}>
          <VStack gap={3}>
            <SupportText>
              카드 이용내역·통장 거래내역을 복사해 붙여 넣으세요(최대 {MAX_PASTE_LINES}줄). 날짜·금액은 이 브라우저에서 읽고, AI에는 적요와 금액만 보냅니다(이름은 지웁니다). AI 제안은 저장 전에 직접 확인하세요. 자동으로 저장하지 않습니다.
            </SupportText>
            <TextArea label="내역 붙여넣기" value={text} onChange={setText} rows={5} maxLength={20000} placeholder={'2026.10.03 한전 전기요금 -152,300\n2026-10-05 ○○마트 78,500원'} />
            <HStack gap={2} wrap="wrap" vAlign="center">
              <Button label="줄 읽기" variant="secondary" isDisabled={text.trim() === '' || saving || aiLoading} onClick={parse} />
              <Button label="AI 계정 제안 받기" variant="secondary" isLoading={aiLoading} isDisabled={rows.length === 0 || saving || aiLoading} onClick={() => void runAi()} />
              {note && <SupportText>{note}</SupportText>}
            </HStack>
            {aiError && <ErrorBanner message={aiError} />}
            {aiNote && !aiError && (
              <HStack gap={2} vAlign="center" wrap="wrap">
                <AiChip />
                <SupportText>{aiNote}</SupportText>
              </HStack>
            )}

            {rows.length > 0 && (
              <VStack gap={3}>
                <div className={styles.stackTight}>
                  {rows.map((r, i) => (
                    <div key={r.key} className={styles.suggestBox}>
                      <VStack gap={2}>
                        <HStack gap={2} vAlign="center" wrap="wrap">
                          <CheckboxInput label="저장" value={r.include} onChange={(v) => setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, include: v } : x)))} isDisabled={saving} />
                          {r.duplicate && <Chip tone="warn" label="같은 날짜·금액이 이미 있음" />}
                          {r.source === 'ai' && <AiChip />}
                          {r.source === 'user' && <Chip tone="neutral" label="직접 고름" />}
                        </HStack>
                        <div className={styles.fieldGridWide}>
                          <TextInput label="날짜" value={r.date} placeholder="YYYY-MM-DD" onChange={(v) => patch(r.key, { date: v.trim().slice(0, 10) })} isDisabled={saving || !r.include} status={r.include && !YMD_PATTERN.test(r.date) ? { type: 'error' } : undefined} />
                          <SegmentedControl
                            label="수입·지출"
                            value={r.direction}
                            onChange={(v) => patch(r.key, { direction: v as LedgerDirection, accountCode: '', source: null, reason: '' })}
                          >
                            <SegmentedControlItem value="EXPENSE" label={DIRECTION_LABEL.EXPENSE} />
                            <SegmentedControlItem value="INCOME" label={DIRECTION_LABEL.INCOME} />
                          </SegmentedControl>
                          <FinanceMoneyField label="금액 (원)" value={r.amount} onChange={(v) => patch(r.key, { amount: v })} max={10_000_000_000} isDisabled={saving || !r.include} />
                        </div>
                        <div className={styles.fieldGridWide}>
                          <TextInput label="적요" value={r.description} onChange={(v) => patch(r.key, { description: v.slice(0, 200) })} isDisabled={saving || !r.include} />
                          <Selector
                            label="계정"
                            placeholder="계정 고르기"
                            hasSearch
                            options={accountOptions(r.direction)}
                            value={r.accountCode}
                            onChange={(v) => patch(r.key, { accountCode: v, source: 'user', reason: '' })}
                            isDisabled={saving || !r.include}
                          />
                        </div>
                        {r.reason && r.source === 'ai' && <SupportText>AI 제안 이유: {r.reason}</SupportText>}
                        {r.include && problems[i].length > 0 && r.accountCode !== '' && <SupportText tone="warn">{problems[i].join(' · ')}</SupportText>}
                        {r.include && r.accountCode === '' && <SupportText tone="warn">계정을 골라 주세요</SupportText>}
                        {r.error && <ErrorBanner message={r.error} />}
                      </VStack>
                    </div>
                  ))}
                </div>
                <HStack gap={3} vAlign="end" wrap="wrap">
                  <Selector label="증빙 (모든 줄)" placeholder="증빙 없음" hasClear options={(Object.keys(EVIDENCE_LABEL) as LedgerEvidenceType[]).map((k) => ({ value: k, label: EVIDENCE_LABEL[k] }))} value={evidence === '' ? null : evidence} onChange={(v) => setEvidence((v ?? '') as LedgerEvidenceType | '')} />
                  <Button label={`고른 ${readyCount}줄 장부에 저장`} variant="primary" isLoading={saving} isDisabled={saving || aiLoading || readyCount === 0} onClick={() => void saveAll()} />
                  <SupportText>
                    {includedCount - readyCount > 0 ? `계정·금액 등을 확인해야 하는 ${includedCount - readyCount}줄은 저장되지 않습니다. ` : ''}
                    저장하지 않을 줄은 ‘저장’ 체크를 끄세요.
                  </SupportText>
                </HStack>
                {saveError && <ErrorBanner message={saveError} />}
              </VStack>
            )}
          </VStack>
        </div>
      </Collapsible>
    </Card>
  );
}
