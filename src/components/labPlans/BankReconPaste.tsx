'use client';

/**
 * 통장 거래 붙여넣기 → 읽기(parseStatementText) → 그 달 장부와 맞추기(matchStatement) → 세 목록.
 * 통장 거래 글(적요·금액·잔액)은 이 브라우저 안에서만 쓰고 서버·AI로 보내지 않는다(장부에 넣을 때 고른 줄의 날짜·금액·적요만 장부로 저장된다).
 * 짝짓기 결과는 읽은 줄과 장부로부터 매번 다시 계산하므로 "장부에 넣기" 뒤에는 저절로 다시 맞춰진다.
 */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Chip, SupportText, useNotify } from '@/components/lab/LabUi';
import { dotDate, monthLabel } from '@/components/lab/labFormat';
import { accountLabel } from '@/lib/lab/ledgerRules';
import { parseStatementText } from '@/lib/lab/bankRules';
import type { StatementLine } from '@/lib/lab/bankRules';
import type { LedgerEntry } from '@/lib/lab/labTypes';
import BankReconAddEntry from './BankReconAddEntry';
import { TOLERANCE_DAYS } from './BankReconMatch';
import type { MatchView } from './BankReconMatch';
import { signedWonText, wonText } from './BankReconFormat';
import styles from './labPlans.module.css';
import bank from './bankRecon.module.css';

interface Props {
  month: string;
  match: MatchView | null;
  ledgerReady: boolean;
  onParsed: (lines: StatementLine[]) => void;
  onEntrySaved: (entry: LedgerEntry) => void;
}

const MAX_TEXT = 200_000;

export default function BankReconPaste({ month, match, ledgerReady, onParsed, onEntrySaved }: Props) {
  const notify = useNotify();
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const year = Number(month.slice(0, 4));

  const read = () => {
    const lines = parseStatementText(text, year);
    onParsed(lines);
    setAdding(null);
    setNote(lines.length === 0 ? '읽을 수 있는 거래가 없습니다. 날짜가 맨 앞에 있는 줄(예: 2026-10-05 또는 10/05)을 붙여 넣어 주세요.' : `${lines.length}줄을 읽었습니다.`);
  };

  const clear = () => {
    setText('');
    setNote(null);
    setAdding(null);
    onParsed([]);
  };

  const hasMatch = match !== null && (match.inMonthCount > 0 || match.matched.length > 0);

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">{monthLabel(month)} 통장 거래 맞추기</Text>
        <SupportText>
          인터넷뱅킹에서 거래내역을 엑셀로 받아 날짜·적요·입금·출금·잔액 칸을 복사해 붙여 넣으세요. 이 글은 이 화면 안에서만 쓰며 서버나 AI로 보내지 않습니다. 날짜는 {TOLERANCE_DAYS}일 안의 차이까지 같은 거래로 봅니다.
        </SupportText>
        <TextArea label="통장 거래 붙여넣기" value={text} onChange={(v) => setText(v.slice(0, MAX_TEXT))} rows={6} placeholder={'2026-10-05\t전기요금\t\t152,300\t8,450,000\n2026-10-10\t본인부담금 입금\t263,760\t\t8,713,760'} />
        <HStack gap={2} wrap="wrap" vAlign="center">
          <Button label="거래 읽고 맞추기" variant="primary" isDisabled={text.trim() === ''} onClick={read} />
          <Button label="지우기" variant="ghost" isDisabled={text === '' && match === null} onClick={clear} />
          {note && <SupportText>{note}</SupportText>}
        </HStack>

        {!ledgerReady && match !== null && <SupportText tone="warn">회계 장부를 읽지 못해 이 달 장부 기록이 비어 있습니다. 다시 불러온 뒤 맞춰 주세요.</SupportText>}

        {match !== null && !hasMatch && match.outsideCount > 0 && (
          <SupportText tone="warn">읽은 거래가 모두 {monthLabel(month)}이 아닌 날짜입니다. 위에서 달을 바꾸거나 붙여 넣은 내역을 확인해 주세요.</SupportText>
        )}

        {match !== null && hasMatch && (
          <VStack gap={4}>
            <div className={styles.toolbar}>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  이 달 통장 거래
                </Text>
                <Text type="label" hasTabularNumbers>
                  {match.inMonthCount}건
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  입금 합
                </Text>
                <Text type="label" hasTabularNumbers>
                  {wonText(match.depositSum)}
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  출금 합
                </Text>
                <Text type="label" hasTabularNumbers>
                  {wonText(match.withdrawSum)}
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  맞춘 거래
                </Text>
                <Text type="label" hasTabularNumbers>
                  {match.matched.length}건
                </Text>
              </div>
            </div>
            {match.outsideCount > 0 && <SupportText tone="warn">이 달({monthLabel(month)})이 아닌 날짜의 {match.outsideCount}줄은 맞추지 않고 건너뛰었습니다.</SupportText>}

            <VStack gap={2}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="label">장부에 없는 통장 거래</Text>
                <Chip tone={match.unmatchedLines.length > 0 ? 'danger' : 'ok'} label={`${match.unmatchedLines.length}건`} />
              </HStack>
              {match.unmatchedLines.length === 0 ? (
                <SupportText>장부에 빠진 통장 거래가 없습니다.</SupportText>
              ) : (
                <div className={bank.rowList}>
                  {match.unmatchedLines.map(({ index, line }) => (
                    <div key={index} className={styles.rowCard}>
                      <VStack gap={2}>
                        <HStack gap={3} vAlign="center" wrap="wrap">
                          <Text type="supporting" color="secondary" hasTabularNumbers>
                            {dotDate(line.date)}
                          </Text>
                          <Text type="body">{line.description || '(적요 없음)'}</Text>
                          <span className={line.amount < 0 ? styles.dangerText : styles.okText}>
                            <Text type="label" color="inherit" hasTabularNumbers>
                              {signedWonText(line.amount)}
                            </Text>
                          </span>
                          <span className={styles.spacer} />
                          {adding !== index && <Button label="장부에 넣기" size="sm" variant="secondary" onClick={() => setAdding(index)} />}
                        </HStack>
                        {adding === index && (
                          <BankReconAddEntry
                            line={line}
                            onCancel={() => setAdding(null)}
                            onSaved={(entry) => {
                              onEntrySaved(entry);
                              setAdding(null);
                              notify('장부에 넣고 다시 맞췄습니다', 'success');
                            }}
                          />
                        )}
                      </VStack>
                    </div>
                  ))}
                </div>
              )}
            </VStack>

            <VStack gap={2}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="label">통장에 없는 장부 기록</Text>
                <Chip tone={match.unmatchedEntries.length > 0 ? 'warn' : 'ok'} label={`${match.unmatchedEntries.length}건`} />
              </HStack>
              {match.unmatchedEntries.length === 0 ? (
                <SupportText>통장에서 확인되지 않은 장부 기록이 없습니다.</SupportText>
              ) : (
                <>
                  <div className={styles.tableScroll}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">날짜</th>
                          <th scope="col">계정</th>
                          <th scope="col">적요</th>
                          <th scope="col" className={styles.num}>
                            금액
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {match.unmatchedEntries.map((e) => (
                          <tr key={e.id}>
                            <td>{dotDate(e.entryDate)}</td>
                            <td>{accountLabel(e.direction, e.accountCode)}</td>
                            <td className={styles.wrap}>{e.description}</td>
                            <td className={styles.num}>{signedWonText(e.direction === 'INCOME' ? e.amount : -e.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <SupportText>현금 거래나 카드 대금 결제 전 기록은 통장에 없는 것이 정상입니다. 통장에서 나간 거래라면 날짜·금액이 장부와 맞는지 확인해 주세요.</SupportText>
                </>
              )}
            </VStack>

            <VStack gap={2}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="label">맞춘 거래</Text>
                <Chip tone="ok" label={`${match.matched.length}건`} />
              </HStack>
              {match.matched.length === 0 ? (
                <SupportText>아직 장부와 맞춘 거래가 없습니다.</SupportText>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">통장 날짜</th>
                        <th scope="col">통장 적요</th>
                        <th scope="col" className={styles.num}>
                          금액
                        </th>
                        <th scope="col">장부 날짜</th>
                        <th scope="col">장부 적요</th>
                      </tr>
                    </thead>
                    <tbody>
                      {match.matched.map(({ line, entry }) => (
                        <tr key={entry.id}>
                          <td>{dotDate(line.date)}</td>
                          <td className={styles.wrap}>{line.description}</td>
                          <td className={styles.num}>{signedWonText(line.amount)}</td>
                          <td>{dotDate(entry.entryDate)}</td>
                          <td className={styles.wrap}>{entry.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </VStack>
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
