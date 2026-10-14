'use client';

/**
 * 어르신 욕구 메모 → 필요한 자원의 "종류와 찾는 방법" 제안(aiSuggestResources). 제안일 뿐이며 저장되지 않는다.
 * 기관 이름·전화번호는 AI가 알려 주지 않는다 — 직원이 직접 확인해 적는다.
 */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { AiChip, Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { resourceTypeLabel } from '@/lib/lab/communityRules';
import { aiSuggestResources } from '@/lib/lab/labApi';
import type { ResourceSuggestion, ResourceType } from '@/lib/lab/labTypes';
import styles from './labPlans.module.css';

interface Props {
  /** 제안한 자원 종류를 연계 양식에 옮긴다 */
  onUse: (type: ResourceType) => void;
}

export default function CommunityResourceAi({ onUse }: Props) {
  const alive = useAlive();
  const [needs, setNeeds] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ResourceSuggestion[] | null>(null);
  const busy = useRef(false);

  const run = async () => {
    if (busy.current || needs.trim() === '') return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await aiSuggestResources({ needs: needs.trim() });
      if (!alive.current) return;
      setSuggestions(result.suggestions);
    } catch (err) {
      if (alive.current) {
        setSuggestions(null);
        setError(errorText(err, 'AI가 자원 종류를 제안하지 못했습니다. 잠시 뒤 다시 시도해 주세요'));
      }
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">어르신 욕구로 자원 종류 찾기</Text>
          <AiChip />
        </HStack>
        <TextArea
          label="어르신의 필요(욕구) 메모"
          description="어떤 도움이 필요한지 적으면 알맞은 자원의 종류와 찾는 방법을 제안합니다."
          placeholder="예: 혼자 사시고 최근 기억력이 떨어져 걱정됨. 겨울 난방비 부담이 큼."
          value={needs}
          onChange={setNeeds}
          rows={3}
          maxLength={2000}
          isDisabled={loading}
        />
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Button label="AI로 자원 종류 제안받기" variant="secondary" isLoading={loading} isDisabled={loading || needs.trim() === ''} onClick={() => void run()} />
          <Text type="supporting" color="secondary">
            이름·연락처는 메모에 적지 마세요. 메모만 AI로 보내고, 결과는 제안일 뿐 저장되지 않습니다.
          </Text>
        </HStack>
        {error && <ErrorBanner message={error} />}
        {suggestions !== null && !error && (
          <div className={styles.suggestBox}>
            <VStack gap={2}>
              {suggestions.length === 0 ? (
                <Text type="supporting" color="secondary">
                  제안할 자원을 찾지 못했습니다. 메모를 조금 더 구체적으로 적어 보세요.
                </Text>
              ) : (
                suggestions.map((s, i) => (
                  <div key={`${s.resourceType}-${i}`} className={styles.rowCard}>
                    <VStack gap={1}>
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Chip tone="info" label={resourceTypeLabel(s.resourceType)} />
                        <Button label="이 종류로 양식 채우기" size="sm" variant="secondary" onClick={() => onUse(s.resourceType)} />
                      </HStack>
                      <Text type="body">{s.reason}</Text>
                      <Text type="supporting" color="secondary">
                        찾는 방법: {s.howTo}
                      </Text>
                    </VStack>
                  </div>
                ))
              )}
              <SupportText tone="warn">기관 이름과 전화번호는 AI가 알려 주지 않습니다. 직원이 직접 확인한 뒤 위 양식에 적어 주세요.</SupportText>
            </VStack>
          </div>
        )}
      </VStack>
    </Card>
  );
}
