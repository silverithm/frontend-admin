'use client';

/** 하루 제공시간 정의와 구간 계산기 — 가정 도착 시각과 다시 가정에 도착한 시각으로 청구 구간을 본다(고시 제16조·제31조·제32조). */
import { useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { TimeField } from '@/components/labRecords/RecordsUi';
import { bandOfMinutes, claimBandLabel } from '@/lib/lab/claimRules';
import { timeToMinutes } from '@/lib/lab/labDate';
import styles from './labPlans.module.css';
import six from './labPlans6.module.css';

export default function ClaimCheckBandCalc() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const a = timeToMinutes(start);
  const b = timeToMinutes(end);
  const minutes = a !== null && b !== null && b > a ? b - a : null;
  const band = minutes === null ? null : bandOfMinutes(minutes);
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">하루 제공시간과 구간 계산기</Text>
        <div className={six.bandBox}>
          <Text type="label">하루 제공시간은 이렇게 셉니다</Text>
          <SupportText>
            요양보호사 등이 수급자의 가정에 도착한 때부터, 급여를 제공한 뒤 다시 수급자의 가정에 도착한 때까지입니다. 송영 이동시간이 들어가므로 시설에 머문 시간보다 길어집니다(고시 제16조). 이 시간이 속한 구간으로 하루 급여비용이 정해집니다(고시 제31조).
          </SupportText>
          <SupportText>3시간 미만으로 제공한 날은 “3시간 이상 6시간 미만” 금액의 80%로 계산합니다(고시 제32조). 이동서비스비용은 별도이며 하루 한 번, 편도만 이용하면 50%입니다(고시 제34조).</SupportText>
        </div>
        <div className={styles.fieldGrid}>
          <TimeField label="가정 도착 시각 (처음)" value={start} onChange={setStart} />
          <TimeField label="다시 가정에 도착한 시각 (귀가)" value={end} onChange={setEnd} />
        </div>
        <HStack gap={2} vAlign="center" wrap="wrap">
          {minutes === null ? (
            <Text type="supporting" color="secondary">
              두 시각을 24시간제로 적으면 구간이 나옵니다. 자정을 넘기는 경우는 계산하지 않으니 직접 확인해 주세요.
            </Text>
          ) : (
            <>
              <Text type="body" hasTabularNumbers>
                {Math.floor(minutes / 60)}시간 {minutes % 60}분
              </Text>
              <Chip tone="info" label={band ? claimBandLabel(band) : '구간 없음'} />
              {band === 'under3' && <Chip tone="warn" label="3~6시간 금액의 80%" />}
            </>
          )}
        </HStack>
      </VStack>
    </Card>
  );
}
