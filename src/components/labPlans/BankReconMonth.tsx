'use client';

/**
 * 월말 잔액 대사 — 통장마다 그 달 마지막 날의 통장 잔액을 적어 저장하면, 장부 월말 잔액과 통장 합계의 차이를 보여 준다.
 * 차이는 저장한 잔액으로만 계산한다(입력 중인 값은 계산에 쓰지 않는다). 모든 통장의 잔액이 있어야 대사한다.
 */
import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, SupportText, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText, monthLabel } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { deleteBankStatement, saveBankStatement } from '@/lib/lab/labApi';
import type { BankStatement } from '@/lib/lab/labTypes';
import type { ReconView } from './BankReconBook';
import { cleanWonText, parseWonText, purposeName, signedWonText, tailText, wonInputText, wonText } from './BankReconFormat';
import styles from './labPlans.module.css';
import bank from './bankRecon.module.css';

interface Props {
  month: string;
  view: ReconView;
  /** 그 달의 월말 잔액 기록 */
  statements: BankStatement[];
  /** 장부를 못 읽었으면 대사하지 않는다 */
  ledgerReady: boolean;
  printDisabled: boolean;
  onSaved: (statement: BankStatement) => void;
  onDeleted: (id: number) => void;
  onPrint: () => void;
}

export default function BankReconMonth({ month, view, statements, ledgerReady, printDisabled, onSaved, onDeleted, onPrint }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const stmtOf = (accountId: number) => statements.find((s) => s.accountId === accountId && s.statementMonth === month);

  // 달이 바뀌거나 저장된 값이 바뀌면 입력칸을 저장된 값으로 되돌린다(다른 통장을 저장해도 쓰는 중인 칸은 그대로 두려고 값의 요약으로 견준다)
  const signature = `${month}|${view.included.map((a) => a.id).join(',')}|${statements.map((s) => `${s.accountId}:${s.statementMonth}:${s.closingBalance}`).join(',')}`;
  useEffect(() => {
    const next: Record<number, string> = {};
    for (const a of view.included) {
      const s = statements.find((x) => x.accountId === a.id && x.statementMonth === month);
      next[a.id] = s ? wonInputText(s.closingBalance) : '';
    }
    setTexts(next);
    setErrors({});
    // 요약이 달라졌을 때만 다시 채운다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const saveOne = async (accountId: number) => {
    if (busyId !== null) return;
    const value = parseWonText(texts[accountId] ?? '');
    if (value === null) {
      setErrors((e) => ({ ...e, [accountId]: '월말 잔액을 100억 원 이내의 숫자로 적어 주세요(마이너스는 -)' }));
      return;
    }
    setBusyId(accountId);
    setErrors((e) => ({ ...e, [accountId]: '' }));
    try {
      const saved = await saveBankStatement({ accountId, statementMonth: month, closingBalance: value, note: stmtOf(accountId)?.note ?? null });
      if (!alive.current) return;
      onSaved(saved);
      notify('월말 잔액을 저장했습니다', 'success');
    } catch (e) {
      if (alive.current) setErrors((x) => ({ ...x, [accountId]: errorText(e, '월말 잔액을 저장하지 못했습니다') }));
    } finally {
      if (alive.current) setBusyId(null);
    }
  };

  const removeOne = async (statement: BankStatement) => {
    if (busyId !== null) return;
    setBusyId(statement.accountId);
    try {
      await deleteBankStatement(statement.id);
      if (!alive.current) return;
      onDeleted(statement.id);
      notify('월말 잔액 기록을 지웠습니다', 'success');
    } catch (e) {
      if (alive.current) setErrors((x) => ({ ...x, [statement.accountId]: errorText(e, '월말 잔액 기록을 지우지 못했습니다') }));
    } finally {
      if (alive.current) setBusyId(null);
    }
  };

  const r = view.result;
  const diffText = r === null ? '' : r.diff > 0 ? `통장이 장부보다 ${wonText(r.diff)} 많습니다` : `통장이 장부보다 ${wonText(-r.diff)} 적습니다`;

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <div className={styles.toolbar}>
          <Text type="label">{monthLabel(month)} 월말 잔액 대사</Text>
          <span className={styles.spacer} />
          <Button label="대사표 인쇄" variant="primary" isDisabled={printDisabled || r === null} onClick={onPrint} />
        </div>

        {view.included.length === 0 ? (
          <SupportText>이 달에 대사할 통장이 없습니다. 통장 목록에서 통장을 추가하거나, 시작일이 이 달보다 늦지 않은지 확인해 주세요.</SupportText>
        ) : (
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.stackTable}`}>
              <thead>
                <tr>
                  <th scope="col">통장</th>
                  <th scope="col">용도</th>
                  <th scope="col">월말 통장 잔액 (원)</th>
                  <th scope="col">관리</th>
                </tr>
              </thead>
              <tbody>
                {view.included.map((a) => {
                  const saved = stmtOf(a.id);
                  const text = texts[a.id] ?? '';
                  const changed = saved === undefined ? text !== '' : text.replace(/[,\s]/g, '') !== String(saved.closingBalance);
                  return (
                    <tr key={a.id}>
                      <td data-label="통장" className={styles.wrap}>
                        {a.name} <Text type="supporting" color="secondary">{a.bankName} {tailText(a.accountTail)}</Text>
                      </td>
                      <td data-label="용도">{purposeName(a.purpose)}</td>
                      <td data-label="월말 통장 잔액 (원)" className={bank.balanceCell}>
                        <TextInput
                          label={`${a.name} 월말 잔액`}
                          isLabelHidden
                          value={text}
                          onChange={(v) => setTexts((t) => ({ ...t, [a.id]: cleanWonText(v) }))}
                          placeholder="예: 8,450,000"
                          isDisabled={busyId !== null}
                          onEnter={() => void saveOne(a.id)}
                        />
                        {errors[a.id] ? <SupportText tone="error">{errors[a.id]}</SupportText> : null}
                      </td>
                      <td data-label="관리">
                        <div className={bank.rowActions}>
                          <Button label="월말 잔액 저장" size="sm" variant="secondary" isLoading={busyId === a.id} isDisabled={busyId !== null || !changed} onClick={() => void saveOne(a.id)} />
                          {saved ? <Chip tone="ok" label="저장됨" /> : <Chip tone="warn" label="입력 전" />}
                          {saved && <Button label="기록 지우기" size="sm" variant="ghost" isDisabled={busyId !== null} onClick={() => void removeOne(saved)} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {view.included.length > 0 && !ledgerReady && <ErrorBanner message="회계 장부를 읽지 못해 대사할 수 없습니다. 위의 다시 불러오기를 눌러 주세요" />}
        {view.included.length > 0 && ledgerReady && view.missing.length > 0 && (
          <SupportText tone="warn">월말 잔액을 아직 저장하지 않은 통장이 있어 대사하지 않습니다: {view.missing.map((a) => a.name).join(', ')}</SupportText>
        )}

        {r !== null && ledgerReady && (
          <div className={bank.diffBox} data-state={r.matched ? 'match' : 'diff'} role="status">
            <div className={styles.statBox}>
              <Text type="supporting" color="secondary">
                장부 월말 잔액
              </Text>
              <Text type="label" hasTabularNumbers>
                {wonText(r.bookClosing)}
              </Text>
            </div>
            <div className={styles.statBox}>
              <Text type="supporting" color="secondary">
                통장 합계
              </Text>
              <Text type="label" hasTabularNumbers>
                {wonText(r.bankClosing)}
              </Text>
            </div>
            <div className={styles.statBox}>
              <Text type="supporting" color="secondary">
                차이 (통장 − 장부)
              </Text>
              {r.matched ? (
                <span className={`${bank.diffNumber} ${styles.okText}`}>맞음</span>
              ) : (
                <span className={`${bank.diffNumber} ${styles.dangerText}`}>{signedWonText(r.diff)}</span>
              )}
            </div>
            {!r.matched && (
              <HStack gap={2} vAlign="center">
                <Chip tone="danger" label="차이 있음" />
                <SupportText>{diffText}. 아래 거래 붙여넣기로 빠진 거래를 찾아보세요.</SupportText>
              </HStack>
            )}
          </div>
        )}

        {view.included.length > 0 && ledgerReady && (
          <SupportText>
            장부 월말 잔액 = 통장 시작 잔액 합 {wonText(view.openingSum)} + {view.startDate ? dotDate(view.startDate) : ''} 이후 장부의 수입 − 지출(그 달 1일 이월 {wonText(view.monthOpening)}). 장부에는 통장 구분이 없어 사용 중인 통장 전체의 합과 견줍니다. 현금 거래나 통장을 거치지 않은 기록이 있으면 차이가 날 수 있습니다.
          </SupportText>
        )}
      </VStack>
    </Card>
  );
}
