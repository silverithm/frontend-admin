'use client';

/**
 * 위험도 평가 입력 — 욕창(Braden)·낙상(Morse).
 * "AI로 점수 제안"은 관찰 메모를 읽고 항목별 선택지를 미리 골라 주되, 근거를 항목 아래에 보여 줄 뿐이다.
 * 직원이 고르고 "평가 저장"을 눌러야 기록된다. 합계와 단계는 서버와 같은 규칙(scoreAssessment)으로 바로 계산한다.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { aiSuggestRiskScores, saveRiskAssessment } from '@/lib/lab/labApi';
import { RISK_ITEMS, RISK_KINDS, allowedValues, riskKindLabel, scoreAssessment } from '@/lib/lab/riskScales';
import type { RiskAssessment, RiskKind } from '@/lib/lab/labTypes';
import { AiChip, ErrorBanner, LabDateInput, SupportText, useNotify } from './LabUi';
import { RiskLevelChip } from './RiskParts';
import { PROVIDER_KEY, defaultPersonName, errorText, todayString, writeStored } from './labFormat';
import styles from './lab.module.css';

interface KindState {
  scores: Record<string, number>;
  /** AI가 고른 항목과 그 근거(사람이 바꾸면 지운다) */
  ai: Record<string, string>;
  aiUsed: boolean;
  observations: string;
}

const emptyKind = (): KindState => ({ scores: {}, ai: {}, aiUsed: false, observations: '' });

interface RiskAssessFormProps {
  elderId: number;
  initialKind: RiskKind;
  onSaved: (assessment: RiskAssessment) => void;
}

export default function RiskAssessForm({ elderId, initialKind, onSaved }: RiskAssessFormProps) {
  const notify = useNotify();
  const [kind, setKind] = useState<RiskKind>(initialKind);
  const [byKind, setByKind] = useState<Record<RiskKind, KindState>>({ BRADEN: emptyKind(), MORSE: emptyKind() });
  // AI 제안을 적용할 때 최신 상태를 setState 밖에서 읽기 위한 거울
  const byKindRef = useRef(byKind);
  useEffect(() => {
    byKindRef.current = byKind;
  }, [byKind]);
  const [assessedOn, setAssessedOn] = useState<string>(todayString());
  const [assessor, setAssessor] = useState(defaultPersonName);
  const [note, setNote] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const current = byKind[kind];
  const items = RISK_ITEMS[kind];
  const chosen = items.filter((i) => current.scores[i.key] !== undefined).length;
  const score = scoreAssessment(kind, current.scores);

  const patchKind = (k: RiskKind, fn: (s: KindState) => KindState) => setByKind((prev) => ({ ...prev, [k]: fn(prev[k]) }));

  const choose = (key: string, value: number) =>
    patchKind(kind, (s) => {
      const ai = { ...s.ai };
      delete ai[key]; // 사람이 고르면 더 이상 AI 제안이 아니다
      return { ...s, scores: { ...s.scores, [key]: value }, ai };
    });

  const runAi = async () => {
    const text = current.observations.trim();
    if (text === '' || aiLoading) return;
    const target = kind;
    setAiLoading(true);
    setAiError(null);
    setAiMessage(null);
    try {
      const result = await aiSuggestRiskScores(target, text);
      // 채울 항목은 setState 밖에서 계산한다. 예전에는 updater 안에서 셌는데, updater는 나중에 돌아서
      // 안내 문구를 고를 때 개수가 늘 0이었다 — 항목이 채워졌는데도 "고를 수 있는 항목이 없었다"고 떴다.
      const before = byKindRef.current[target];
      const scores = { ...before.scores };
      const ai = { ...before.ai };
      let applied = 0;
      for (const item of RISK_ITEMS[target]) {
        const suggestion = result.scores[item.key];
        if (!suggestion || !allowedValues(target, item.key).includes(suggestion.value)) continue;
        // 직원이 이미 고른 항목은 그대로 둔다
        if (scores[item.key] !== undefined && !ai[item.key]) continue;
        scores[item.key] = suggestion.value;
        ai[item.key] = suggestion.reason;
        applied += 1;
      }
      patchKind(target, (s) => ({ ...s, scores, ai, aiUsed: true }));
      setAiMessage(
        applied === 0
          ? '메모만으로는 고를 수 있는 항목이 없었습니다. 관찰 내용을 조금 더 적어 보세요.'
          : `${applied}개 항목을 제안했습니다. 근거를 읽고 확인한 뒤 저장해 주세요.`,
      );
    } catch (e) {
      setAiError(errorText(e, 'AI가 점수를 제안하지 못했습니다. 잠시 후 다시 시도해 주세요'));
    } finally {
      setAiLoading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    if (score.error !== undefined) {
      setSaveError(score.error);
      return;
    }
    if (assessor.trim() === '') {
      setSaveError('평가자 이름을 적어 주세요');
      return;
    }
    if (!assessedOn) {
      setSaveError('평가일을 골라 주세요');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveRiskAssessment({
        elderlyId: elderId,
        kind,
        scores: current.scores,
        assessedOn,
        assessorName: assessor.trim(),
        note: note.trim() === '' ? null : note.trim(),
        aiAssisted: current.aiUsed,
      });
      writeStored(PROVIDER_KEY, assessor.trim());
      patchKind(kind, () => emptyKind());
      setNote('');
      setAiMessage(null);
      notify(`${riskKindLabel(kind)} 평가를 저장했습니다 (${saved.total}점)`, 'success');
      onSaved(saved);
    } catch (e) {
      setSaveError(errorText(e, '위험도 평가를 저장하지 못했습니다'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack gap={4}>
      <SegmentedControl label="평가 도구" value={kind} onChange={(v) => { setKind(v as RiskKind); setAiMessage(null); setAiError(null); setSaveError(null); }} size="sm">
        {RISK_KINDS.map((k) => (
          <SegmentedControlItem key={k.id} value={k.id} label={k.label} />
        ))}
      </SegmentedControl>

      <VStack gap={2}>
        <TextArea
          label="관찰 메모"
          description="평소 모습을 적어 주세요. AI가 항목별 점수를 제안합니다. (어르신 이름은 적지 마세요)"
          placeholder={kind === 'BRADEN' ? '예: 말로 불편을 잘 표현하심. 하루 대부분 휠체어에 앉아 계시고, 기저귀를 하루 두 번 갈아 드림.' : '예: 지팡이를 짚고 걸으심. 걸음이 느리고 가끔 휘청임. 혼자 화장실에 가려 하심.'}
          value={current.observations}
          onChange={(v) => patchKind(kind, (s) => ({ ...s, observations: v }))}
          rows={3}
          maxLength={2000}
        />
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Button label="AI로 점수 제안" variant="secondary" isLoading={aiLoading} isDisabled={aiLoading || current.observations.trim() === ''} onClick={() => void runAi()} />
          {aiMessage && <SupportText>{aiMessage}</SupportText>}
        </HStack>
        {aiError && <ErrorBanner message={aiError} />}
      </VStack>

      <div className={styles.fieldGridWide}>
        {items.map((item) => (
          <VStack gap={1} key={item.key}>
            <RadioList
              label={item.label}
              description={item.question}
              value={current.scores[item.key] === undefined ? '' : String(current.scores[item.key])}
              onChange={(v) => choose(item.key, Number(v))}
              size="sm"
            >
              {item.options.map((o) => (
                <RadioListItem key={o.value} value={String(o.value)} label={`${o.label} · ${o.value}점`} description={o.hint} />
              ))}
            </RadioList>
            {current.ai[item.key] !== undefined && (
              <div className={styles.suggestBox}>
                <HStack gap={2} vAlign="start" wrap="wrap">
                  <AiChip />
                  <SupportText>확인 후 저장 — {current.ai[item.key]}</SupportText>
                </HStack>
              </div>
            )}
          </VStack>
        ))}
      </div>

      <div className={styles.fieldGrid}>
        <LabDateInput label="평가일" value={assessedOn} onChange={setAssessedOn} max={todayString()} isRequired />
        <TextInput label="평가자" value={assessor} onChange={(v) => setAssessor(v.slice(0, 50))} isRequired />
      </div>
      <TextArea label="메모" isOptional value={note} onChange={setNote} rows={2} maxLength={1000} />

      <div className={styles.stickyBar}>
        <VStack gap={2}>
          {saveError && <ErrorBanner message={saveError} />}
          <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
            <HStack gap={2} vAlign="center" wrap="wrap">
              {score.error === undefined ? (
                <>
                  <Text type="large" weight="bold" hasTabularNumbers>
                    합계 {score.total}점
                  </Text>
                  <RiskLevelChip level={score.riskLevel} />
                </>
              ) : (
                <Text type="body" color="secondary" hasTabularNumbers>
                  {chosen}/{items.length}개 항목 선택 · 모두 고르면 합계가 나옵니다
                </Text>
              )}
            </HStack>
            <Button label="평가 저장" variant="primary" isLoading={saving} isDisabled={saving || score.error !== undefined} onClick={() => void save()} />
          </HStack>
        </VStack>
      </div>
    </VStack>
  );
}
