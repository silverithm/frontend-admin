'use client';

/** 이름 맞추기 — 확정된 줄은 칩으로, 애매한 줄은 후보를 골라 연결한다. 후보가 없으면 전체 어르신에서 직접 고른다. */
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, SupportText } from '@/components/lab/LabUi';
import type { LabElder } from '@/components/lab/useLabElders';
import type { ClaimMatch, ClaimRow } from '@/lib/lab/claimRules';
import { bandShort } from './ClaimCheckFormat';
import styles from './labPlans.module.css';

export interface MatchedLine {
  match: ClaimMatch<ClaimRow>;
  /** 최종 연결된 어르신(자동 확정이거나 직접 고른 것). 없으면 null */
  elderlyId: number | null;
  /** 같은 어르신이 앞 줄에 이미 있어 이 줄은 대조에서 뺀다 */
  duplicate: boolean;
}

interface Props {
  lines: MatchedLine[];
  elders: LabElder[];
  onPick: (raw: string, elderlyId: number | null) => void;
}

export default function ClaimCheckMatch({ lines, elders, onPick }: Props) {
  if (lines.length === 0) return null;
  const nameOf = (id: number) => elders.find((e) => e.id === id)?.name ?? '(알 수 없는 어르신)';
  const open = lines.filter((l) => l.elderlyId === null).length;
  const dup = lines.filter((l) => l.duplicate).length;
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">3. 어르신 맞추기 ({lines.length}줄)</Text>
        <SupportText>이름이 어르신 이름과 같으면 자동으로 연결합니다. 글자가 조금 다르면 성과 글자 수가 같은 어르신을 후보로 보여 드립니다. 연결하지 않은 줄은 대조에서 빠집니다.</SupportText>
        <div className={styles.tableScroll}>
          <table className={`${styles.table} ${styles.stackTable}`}>
            <thead>
              <tr>
                <th scope="col">붙여 넣은 이름</th>
                <th scope="col">일수</th>
                <th scope="col">구간</th>
                <th scope="col">연결할 어르신</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const options = (l.match.candidates.length > 0 ? elders.filter((e) => l.match.candidates.includes(e.id)) : elders).map((e) => ({ value: String(e.id), label: e.name }));
                const auto = l.match.elderlyId !== null;
                return (
                  <tr key={`${l.match.row.raw}-${i}`} data-tone={l.elderlyId === null || l.duplicate ? 'warn' : undefined}>
                    <td data-label="붙여 넣은 이름">{l.match.row.name}</td>
                    <td data-label="일수">{l.match.row.days}일</td>
                    <td data-label="구간">{bandShort(l.match.row.band)}</td>
                    <td data-label="연결할 어르신" className={styles.wrap}>
                      {auto ? (
                        <>
                          <Chip tone="ok" label={`확정 — ${nameOf(l.match.elderlyId as number)}`} />
                          {l.duplicate && <Chip tone="warn" label="같은 어르신이 앞에 있어 뺌" />}
                        </>
                      ) : (
                        <VStack gap={1}>
                          <Selector
                            label={l.match.candidates.length > 0 ? '후보 고르기' : '직접 고르기'}
                            isLabelHidden
                            placeholder={l.match.candidates.length > 0 ? '후보 고르기' : '어르신 고르기'}
                            hasSearch
                            searchPlaceholder="찾기"
                            options={options}
                            value={l.elderlyId === null ? undefined : String(l.elderlyId)}
                            onChange={(v) => onPick(l.match.row.raw, v === null ? null : Number(v))}
                          />
                          {l.duplicate && <Chip tone="warn" label="같은 어르신이 앞에 있어 뺌" />}
                          {l.elderlyId === null && (
                            <Text type="supporting" color="secondary">
                              {l.match.candidates.length > 0 ? '비슷한 이름의 후보가 있습니다' : '맞는 어르신이 없습니다. 고르지 않으면 대조에서 빠집니다'}
                            </Text>
                          )}
                        </VStack>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(open > 0 || dup > 0) && (
          <SupportText tone="warn">
            {open > 0 && `연결하지 않은 줄 ${open}개`}
            {open > 0 && dup > 0 && ', '}
            {dup > 0 && `같은 어르신이 겹친 줄 ${dup}개`}는 대조와 저장에서 빠집니다.
          </SupportText>
        )}
      </VStack>
    </Card>
  );
}
