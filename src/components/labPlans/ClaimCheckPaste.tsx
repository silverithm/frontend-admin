'use client';

/** 청구 내역 붙여넣기 칸 — 이름은 이 화면에서만 쓰고 밖으로 보내지 않는다는 안내와 읽은 결과 개수. */
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Chip, SupportText } from '@/components/lab/LabUi';

interface Props {
  text: string;
  onChange: (text: string) => void;
  /** 읽은 줄 수 */
  readCount: number;
  /** 글에서 내용이 있는 줄 수 */
  lineCount: number;
  isDisabled: boolean;
}

export const MAX_PASTE = 60000;

export default function ClaimCheckPaste({ text, onChange, readCount, lineCount, isDisabled }: Props) {
  const skipped = Math.max(0, lineCount - readCount);
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">2. 청구 내역 붙여넣기</Text>
        <TextArea
          label="청구 내역 붙여넣기"
          description="공단 청구·급여제공 내역에서 수급자 이름, 일수, 시간 구간이 있는 줄을 복사해 붙여 넣으세요"
          placeholder={'예:\n김영희\t20일\t8시간 이상~10시간 미만\n이철수\t18일\t6~8시간'}
          value={text}
          onChange={(v) => onChange(v.slice(0, MAX_PASTE))}
          rows={7}
          isDisabled={isDisabled}
        />
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Chip tone={readCount > 0 ? 'ok' : 'neutral'} label={`읽은 줄 ${readCount}`} />
          {skipped > 0 && <Chip tone="neutral" label={`건너뛴 줄 ${skipped}`} />}
        </HStack>
        <SupportText>
          탭·쉼표·공백으로 나뉜 글을 읽습니다. 일수는 “20일”이나 “20”, 구간은 “8시간 이상~10시간 미만”·“8~10”·“13시간 초과”·“3시간 미만”처럼 적힌 것을 읽고, 머리글과 합계 줄은 건너뜁니다.
        </SupportText>
        <SupportText>붙여 넣은 이름은 이 화면에서 어르신과 맞춰 볼 때만 쓰고, AI나 서버로 보내지 않습니다. 저장하는 것은 어르신 번호와 일수·구간·확인 사유뿐입니다.</SupportText>
      </VStack>
    </Card>
  );
}
