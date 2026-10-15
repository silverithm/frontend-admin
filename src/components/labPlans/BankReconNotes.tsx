'use client';

/** 통장 대사 안내 — 근거 조항과 기관 관리 기준임을 밝힌다. */
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { SupportText } from '@/components/lab/LabUi';

export default function BankReconNotes() {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">통장 관리 안내</Text>
        <SupportText>재무·회계 규칙 제15조: 수입금은 받은 다음 날까지 금융기관에 입금하고, 수입금 예금통장은 회계(급여)별로 구분해 보관·관리합니다.</SupportText>
        <SupportText>제16조: 지출은 상용·소액경비를 빼고 예금통장, 전자거래 또는 신용카드로 합니다.</SupportText>
        <SupportText>제17조: 계좌로 받는 후원금은 기관 이름이 붙은 후원금 전용계좌로 받고, 후원금의 수입과 지출은 모두 그 계좌로 합니다(물품 후원은 제외).</SupportText>
        <SupportText>
          월말에 통장 잔액과 장부 잔액을 맞추라는 조항은 규칙에서 찾지 못했습니다. 이 화면의 월말 대사는 기관 관리 기준이며(대조 필요), 평가에서 통장 거래내역과 장부를 맞춰 보여야 할 때를 대비한 점검입니다.
        </SupportText>
        <SupportText>계좌번호는 끝 4자리만 저장하고, 붙여 넣은 통장 거래 글은 이 화면 안에서만 쓰며 서버나 AI로 보내지 않습니다.</SupportText>
      </VStack>
    </Card>
  );
}
