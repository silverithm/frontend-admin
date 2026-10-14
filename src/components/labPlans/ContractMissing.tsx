'use client';

/** 진행 중인 계약이 없는 어르신 — "계약 등록"으로 새 계약 편집기를 연다. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { LabElder } from '@/components/lab/useLabElders';
import { gradeText } from './ContractFormat';
import six from './labPlans6.module.css';

interface Props {
  elders: LabElder[];
  isBusy: boolean;
  onRegister: (elder: LabElder) => void;
}

export default function ContractMissing({ elders, isBusy, onRegister }: Props) {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">계약 없는 어르신 ({elders.length}명)</Text>
        {elders.length === 0 ? (
          <Text type="supporting" color="secondary">
            모든 어르신에게 진행 중인 계약이 있습니다.
          </Text>
        ) : (
          <ul className={six.plainList}>
            {elders.map((e) => (
              <li key={e.id} className={six.plainRow}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text type="body">{e.name}</Text>
                  {e.careGrade && (
                    <Text type="supporting" color="secondary">
                      {gradeText(e.careGrade)}
                    </Text>
                  )}
                </HStack>
                <Button label="계약 등록" size="sm" variant="secondary" isDisabled={isBusy} onClick={() => onRegister(e)} />
              </li>
            ))}
          </ul>
        )}
      </VStack>
    </Card>
  );
}
