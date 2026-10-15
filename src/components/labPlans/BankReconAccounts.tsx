'use client';

/**
 * 통장 목록 — 이름·용도·은행·계좌 끝 4자리·시작 잔액·시작일. 추가·고치기·삭제.
 * 계좌번호 전체는 받지 않는다(끝 4자리만). 월말 잔액 기록이 있는 통장은 서버가 삭제를 막으므로, 그때는 쓰지 않음으로 바꾸게 안내한다.
 */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText, todayString } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { createBankAccount, deleteBankAccount, updateBankAccount } from '@/lib/lab/labApi';
import type { BankAccount, BankAccountPurpose } from '@/lib/lab/labTypes';
import { MAX_ACCOUNT_NAME, MAX_BANK_NAME, accountIssues, draftOfAccount, emptyAccountDraft, inputOfAccount } from './BankReconDraft';
import type { AccountDraft } from './BankReconDraft';
import { PURPOSE_OPTIONS, cleanWonText, purposeName, tailText, wonText } from './BankReconFormat';
import styles from './labPlans.module.css';

interface Props {
  accounts: BankAccount[];
  onSaved: (account: BankAccount) => void;
  onDeleted: (id: number) => void;
}

export default function BankReconAccounts({ accounts, onSaved, onDeleted }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const [draft, setDraft] = useState<AccountDraft>(() => emptyAccountDraft(todayString()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<BankAccount | null>(null);
  // 통장이 있으면 추가 칸은 접어 둔다(고치기·'통장 추가'를 누르면 연다)
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const savingRef = useRef(false);
  const set = (patch: Partial<AccountDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const issues = accountIssues(draft);
  const editing = draft.id !== null;

  const save = async () => {
    if (savingRef.current || issues.length > 0) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const input = inputOfAccount(draft);
      const saved = draft.id === null ? await createBankAccount(input) : await updateBankAccount(draft.id, input);
      if (!alive.current) return;
      onSaved(saved);
      notify(draft.id === null ? '통장을 추가했습니다' : '통장을 고쳤습니다', 'success');
      setDraft(emptyAccountDraft(todayString()));
      setFormOpen(false);
    } catch (e) {
      if (alive.current) setError(errorText(e, '통장을 저장하지 못했습니다'));
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete || deleting) return;
    const target = toDelete;
    setDeleting(true);
    try {
      await deleteBankAccount(target.id);
      if (!alive.current) return;
      onDeleted(target.id);
      if (draft.id === target.id) setDraft(emptyAccountDraft(todayString()));
      notify('통장을 삭제했습니다', 'success');
    } catch (e) {
      if (alive.current) notify(`${errorText(e, '통장을 삭제하지 못했습니다')} 더 쓰지 않는 통장은 고치기에서 ‘사용 중’을 끄면 대사에서 빠집니다.`, 'error');
    } finally {
      if (alive.current) {
        setDeleting(false);
        setToDelete(null);
      }
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <div className={styles.toolbar}>
          <Text type="label">통장 목록</Text>
          <span className={styles.spacer} />
          {accounts.length > 0 && !formOpen && !editing && <Button label="통장 추가" variant="secondary" size="sm" onClick={() => setFormOpen(true)} />}
        </div>
        {accounts.length === 0 ? (
          <SupportText>등록한 통장이 없습니다. 아래에서 운영 통장부터 추가해 주세요.</SupportText>
        ) : (
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.stackTable}`}>
              <thead>
                <tr>
                  <th scope="col">통장</th>
                  <th scope="col">용도</th>
                  <th scope="col" className={styles.num}>
                    시작 잔액
                  </th>
                  <th scope="col">상태</th>
                  <th scope="col">관리</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td data-label="통장" className={styles.wrap}>
                      {a.name} <Text type="supporting" color="secondary">{a.bankName} {tailText(a.accountTail)}</Text>
                    </td>
                    <td data-label="용도">{purposeName(a.purpose)}</td>
                    <td data-label="시작 잔액" className={styles.num}>
                      {wonText(a.openingBalance)} <Text type="supporting" color="secondary">{dotDate(a.openingDate)}부터</Text>
                    </td>
                    <td data-label="상태">{a.active ? <Chip tone="ok" label="사용 중" /> : <Chip tone="neutral" label="쓰지 않음" />}</td>
                    <td data-label="관리">
                      <HStack gap={2} wrap="wrap">
                        <Button
                          label="고치기"
                          size="sm"
                          variant="secondary"
                          isDisabled={saving || deleting}
                          onClick={() => {
                            setDraft(draftOfAccount(a));
                            setError(null);
                            setFormOpen(true);
                          }}
                        />
                        <Button label="삭제" size="sm" variant="ghost" isDisabled={saving || deleting} onClick={() => setToDelete(a)} />
                      </HStack>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(accounts.length === 0 || formOpen || editing) && (
          <VStack gap={3}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Text type="label">{editing ? '통장 고치기' : '통장 추가'}</Text>
              {editing && <Chip tone="warn" label="수정 중" />}
            </HStack>
            <div className={styles.fieldGrid}>
              <TextInput label="통장 이름" value={draft.name} onChange={(v) => set({ name: v.slice(0, MAX_ACCOUNT_NAME) })} placeholder="예: 운영 통장" isDisabled={saving} />
              <Selector
                label="용도"
                placeholder="용도 고르기"
                options={PURPOSE_OPTIONS}
                value={draft.purpose === '' ? undefined : draft.purpose}
                onChange={(v) => set({ purpose: v as BankAccountPurpose })}
                isDisabled={saving}
              />
              <TextInput label="은행 이름" value={draft.bankName} onChange={(v) => set({ bankName: v.slice(0, MAX_BANK_NAME) })} placeholder="예: 농협" isDisabled={saving} />
              <TextInput
                label="계좌번호 끝 4자리"
                value={draft.tail}
                onChange={(v) => set({ tail: v.replace(/\D/g, '').slice(0, 4) })}
                placeholder="예: 1234"
                description="전체 계좌번호는 받지 않습니다. 통장을 구분할 끝 4자리만 적어 주세요"
                isDisabled={saving}
              />
              <TextInput
                label="시작 잔액 (원)"
                value={draft.openingText}
                onChange={(v) => set({ openingText: cleanWonText(v) })}
                placeholder="예: 12,500,000 (마이너스는 -)"
                description="아래 시작일 기준 통장 잔액. 이 날짜 이후 장부 기록부터 대사합니다"
                isDisabled={saving}
              />
              <LabDateInput label="시작일" value={draft.openingDate} onChange={(v) => set({ openingDate: v })} />
            </div>
            <CheckboxInput label="사용 중 (끄면 대사에서 뺍니다)" value={draft.active} onChange={(v) => set({ active: v })} isDisabled={saving} />
            {draft.name !== '' && issues.length > 0 && (
              <VStack gap={1}>
                {issues.map((m) => (
                  <SupportText key={m} tone="warn">
                    {m}
                  </SupportText>
                ))}
              </VStack>
            )}
            {error && <ErrorBanner message={error} />}
            <HStack gap={2} hAlign="end" wrap="wrap">
              {(editing || accounts.length > 0) && (
                <Button
                  label={editing ? '고치기 취소' : '닫기'}
                  variant="ghost"
                  isDisabled={saving}
                  onClick={() => {
                    setDraft(emptyAccountDraft(todayString()));
                    setError(null);
                    setFormOpen(false);
                  }}
                />
              )}
              <Button label={editing ? '고친 내용 저장' : '통장 추가'} variant="primary" isLoading={saving} isDisabled={saving || issues.length > 0} onClick={() => void save()} />
            </HStack>
          </VStack>
        )}
      </VStack>

      <LabConfirm
        isOpen={toDelete !== null}
        title="이 통장을 삭제할까요?"
        description={toDelete ? `${toDelete.name} (${toDelete.bankName} ${tailText(toDelete.accountTail)}) — 월말 잔액 기록이 있으면 삭제할 수 없습니다. 삭제하면 되돌릴 수 없습니다.` : ''}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
