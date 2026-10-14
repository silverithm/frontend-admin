'use client';

/**
 * 청구서 편집 줄의 "계약 정보로 채우기" — 그 어르신의 진행 중 계약에 적힌 등급과 감경 구분을 청구서에 옮긴다.
 * 값이 다르면 무엇이 어떻게 바뀌는지 먼저 보여 주고, 직원이 "바꾸기"를 눌러야 반영한다. 반영해도 저장은 따로 누른다.
 */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { ElderContract } from '@/lib/lab/labTypes';
import { SupportText } from './LabUi';
import { applyContractFill, contractFillChanges } from './copayContracts';
import type { CopayContractsState } from './copayContracts';
import type { CopayDraft } from './copayDraft';
import styles from './lab.module.css';

interface CopayContractFillProps {
  elderId: number;
  draft: CopayDraft;
  contracts: CopayContractsState;
  onChange: (next: CopayDraft) => void;
}

export default function CopayContractFill({ elderId, draft, contracts, onChange }: CopayContractFillProps) {
  const [preview, setPreview] = useState<ElderContract | null>(null);
  const [sameNote, setSameNote] = useState(false);

  if (contracts.isLoading && contracts.byElder === null) return <SupportText>진행 중 계약을 불러오는 중...</SupportText>;
  if (contracts.byElder === null) {
    return (
      <HStack gap={2} vAlign="center" wrap="wrap">
        <SupportText tone="error">{contracts.error ?? '계약 정보를 불러오지 못했습니다'}</SupportText>
        <Button label="다시 불러오기" size="sm" variant="ghost" onClick={contracts.reload} />
      </HStack>
    );
  }
  const contract = contracts.byElder.get(elderId) ?? null;
  if (!contract) return <SupportText>진행 중 계약 없음 — 수급자 묶음의 ‘계약·인정’에서 계약을 먼저 등록하면 등급과 감경 구분을 채울 수 있어요.</SupportText>;

  const changes = contractFillChanges(draft, contract);
  const start = () => {
    if (changes.length === 0) {
      setPreview(null);
      setSameNote(true);
      return;
    }
    setSameNote(false);
    setPreview(contract);
  };

  // 미리 보기를 연 뒤 초안이 바뀌어 차이가 사라졌으면 보여 줄 것이 없다
  if (preview && changes.length > 0) {
    return (
      <div className={styles.suggestBox}>
        <VStack gap={2}>
          <Text type="label">계약 정보로 이렇게 바뀝니다</Text>
          <VStack gap={1}>
            {changes.map((c) => (
              <Text key={c.field} type="body">
                {c.field}: {c.from} → {c.to}
              </Text>
            ))}
          </VStack>
          <HStack gap={2} wrap="wrap">
            <Button
              label="바꾸기"
              size="sm"
              variant="primary"
              onClick={() => {
                onChange(applyContractFill(draft, preview));
                setPreview(null);
              }}
            />
            <Button label="취소" size="sm" variant="ghost" onClick={() => setPreview(null)} />
          </HStack>
          <SupportText>바꾼 뒤 아래 ‘청구서 저장’을 눌러야 저장됩니다.</SupportText>
        </VStack>
      </div>
    );
  }

  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      <Button label="계약 정보로 채우기" size="sm" variant="secondary" onClick={start} />
      <SupportText>{sameNote && changes.length === 0 ? '이미 진행 중 계약의 등급·감경 구분과 같습니다.' : '진행 중 계약의 등급과 감경 구분을 가져옵니다.'}</SupportText>
    </HStack>
  );
}
