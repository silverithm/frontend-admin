'use client';

/**
 * 퇴소 연계기록지 편집기 — 어르신·퇴소일·사유, 사실 모으기 → AI 초안 → 고침, 제공대장 네 칸, 평가 확인 항목.
 * AI는 모은 사실만 근거로 심신기능 상태·제공한 급여·퇴소 후 계획의 초안을 제안한다. 직접 쓴 칸은 덮어쓰지 않는다.
 */
import { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { AiChip, Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { dotDate, errorText } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { mergeAiSuggestions, useAlive, useLatest } from '@/components/labRecords/recordsFormat';
import { aiDraftDischargeReferral } from '@/lib/lab/labApi';
import { DISCHARGE_REASONS, PROVIDED_METHODS, referralCompliance } from '@/lib/lab/dischargeRules';
import type { DischargeFacts, DischargeReason, ElderContract, LtcCareGrade, ReferralProvidedMethod } from '@/lib/lab/labTypes';
import { gradeOrDefault } from './ContractDraft';
import { GRADE_OPTIONS } from './ContractFormat';
import {
  MAX_PERSON_NAME,
  MAX_REFERRAL_COUNSEL,
  MAX_REFERRAL_FUNCTIONAL,
  MAX_REFERRAL_PLAN,
  MAX_REFERRAL_SERVICES,
  referralIssues,
  threeMonthsBefore,
} from './ContractReferralDraft';
import type { ReferralDraft } from './ContractReferralDraft';
import ContractReferralFacts from './ContractReferralFacts';
import { collectDischargeFacts } from './ContractReferralSources';
import styles from './labPlans.module.css';

type AiKey = 'functionalStatus' | 'servicesProvided' | 'afterPlan';
const AI_MAX: Record<AiKey, number> = { functionalStatus: MAX_REFERRAL_FUNCTIONAL, servicesProvided: MAX_REFERRAL_SERVICES, afterPlan: MAX_REFERRAL_PLAN };
const FACT_MONTHS = 3;

interface Props {
  draft: ReferralDraft;
  onChange: (next: ReferralDraft) => void;
  elders: LabElder[];
  eldersLoading: boolean;
  fallbackElderName: string | null;
  /** 모든 계약(연결 고르기용) */
  contracts: ElderContract[];
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}

const orNull = (t: string) => (t.trim() === '' ? null : t.trim());

export default function ContractReferralEditor({ draft, onChange, elders, eldersLoading, fallbackElderName, contracts, saving, error, onSave, onCancel }: Props) {
  const alive = useAlive();
  const latest = useLatest(draft);
  const set = (patch: Partial<ReferralDraft>) => onChange({ ...draft, ...patch });
  const editing = draft.id !== null;
  const issues = referralIssues(draft);
  const touched = draft.elderlyId !== null && draft.dischargeOn !== '';

  const [marks, setMarks] = useState<Partial<Record<AiKey, true>>>({});
  const marksRef = useLatest(marks);
  const [collected, setCollected] = useState<{ key: string; facts: DischargeFacts; from: string } | null>(null);
  const [gathering, setGathering] = useState(false);
  const [gatherError, setGatherError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const busy = useRef(false);

  const factKey = `${draft.elderlyId ?? ''}|${draft.dischargeOn}`;
  const facts = collected && collected.key === factKey ? collected : null;
  const from = threeMonthsBefore(draft.dischargeOn);

  const elderOptions = useMemo(() => {
    const list = elders.map((e) => ({ value: String(e.id), label: e.name }));
    if (draft.elderlyId !== null && !elders.some((e) => e.id === draft.elderlyId)) list.push({ value: String(draft.elderlyId), label: fallbackElderName ?? '(목록에 없는 어르신)' });
    return list;
  }, [elders, draft.elderlyId, fallbackElderName]);

  const NONE = 'NONE';
  const contractOptions = useMemo(() => {
    const mine = contracts.filter((c) => c.elderlyId === draft.elderlyId).sort((a, b) => (a.contractStart < b.contractStart ? 1 : -1));
    return [
      { value: NONE, label: '연결 안 함' },
      ...mine.map((c) => ({ value: String(c.id), label: `${dotDate(c.contractStart)} ~ ${c.contractEnd ? dotDate(c.contractEnd) : ''} (${c.status === 'ENDED' ? '종료' : '진행 중'})` })),
    ];
  }, [contracts, draft.elderlyId]);

  const setText = (key: 'functionalStatus' | 'servicesProvided' | 'afterPlan', value: string) => {
    if (marks[key]) setMarks((m) => ({ ...m, [key]: undefined }));
    set({ [key]: value.slice(0, AI_MAX[key]) } as Partial<ReferralDraft>);
  };

  const gather = async () => {
    if (busy.current || draft.elderlyId === null || from === null || !draft.dischargeOn) return;
    busy.current = true;
    setGathering(true);
    setGatherError(null);
    setAiNote(null);
    const key = factKey;
    try {
      const result = await collectDischargeFacts(draft.elderlyId, from, draft.dischargeOn);
      if (!alive.current) return;
      setCollected({ key, facts: result.facts, from: result.from });
    } catch (err) {
      if (alive.current) {
        setCollected(null);
        setGatherError(errorText(err, '기록을 모으지 못했습니다. 잠시 뒤 다시 시도해 주세요'));
      }
    } finally {
      busy.current = false;
      if (alive.current) setGathering(false);
    }
  };

  const runAi = async () => {
    if (busy.current || !facts) return;
    busy.current = true;
    setAiLoading(true);
    setAiError(null);
    setAiNote(null);
    try {
      const result = await aiDraftDischargeReferral({ facts: facts.facts, reason: draft.reason, months: FACT_MONTHS });
      if (!alive.current) return;
      const current = latest.current;
      const merged = mergeAiSuggestions<AiKey>(
        { functionalStatus: current.functionalStatus, servicesProvided: current.servicesProvided, afterPlan: current.afterPlan },
        marksRef.current,
        result,
        AI_MAX,
      );
      setMarks(merged.ai);
      onChange({ ...current, ...merged.fields, aiAssisted: true });
      setAiNote(merged.kept > 0 ? `직접 쓴 ${merged.kept}칸은 그대로 두었습니다.` : '세 칸에 제안을 채웠습니다.');
    } catch (err) {
      if (alive.current) setAiError(errorText(err, 'AI가 초안을 만들지 못했습니다. 직접 적거나 잠시 뒤 다시 시도해 주세요'));
    } finally {
      busy.current = false;
      if (alive.current) setAiLoading(false);
    }
  };

  const compliance = referralCompliance({
    writtenOn: draft.writtenOn,
    dischargeOn: draft.dischargeOn,
    careGrade: draft.careGrade,
    functionalStatus: draft.functionalStatus,
    servicesProvided: draft.servicesProvided,
    afterPlan: draft.afterPlan,
    providedOn: orNull(draft.providedOn),
    providedMethod: draft.providedMethod === '' ? null : draft.providedMethod,
    providerName: orNull(draft.providerName),
    recipientName: orNull(draft.recipientName),
  });

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{editing ? '연계기록지 고치기' : '연계기록지 쓰기'}</Text>
          {editing && <Chip tone="warn" label="수정 중" />}
          {draft.aiAssisted && <AiChip label="AI 제안 참고" />}
        </HStack>

        <div className={styles.fieldGrid}>
          <Selector
            label="어르신"
            placeholder={eldersLoading ? '어르신 목록을 불러오는 중...' : '어르신 고르기'}
            hasSearch
            searchPlaceholder="찾기"
            options={elderOptions}
            value={draft.elderlyId === null ? undefined : String(draft.elderlyId)}
            onChange={(v) => {
              if (v === null) return;
              const elder = elders.find((e) => String(e.id) === v);
              set({ elderlyId: Number(v), contractId: null, careGrade: elder?.careGrade ? gradeOrDefault(elder.careGrade) : draft.careGrade });
            }}
            isDisabled={saving || editing}
          />
          <Selector
            label="연결할 계약 (선택)"
            placeholder="고르기"
            options={contractOptions}
            value={draft.contractId === null ? NONE : String(draft.contractId)}
            onChange={(v) => {
              if (v === null) return;
              if (v === NONE) {
                set({ contractId: null });
                return;
              }
              const c = contracts.find((x) => String(x.id) === v);
              if (c) set({ contractId: c.id, careGrade: c.careGrade, dischargeOn: draft.dischargeOn === '' && c.contractEnd ? c.contractEnd : draft.dischargeOn });
            }}
            isDisabled={saving || draft.elderlyId === null}
          />
          <LabDateInput label="퇴소일 (계약 종료일)" value={draft.dischargeOn} onChange={(v) => set({ dischargeOn: v })} />
        </div>
        <div className={styles.fieldGrid}>
          <Selector
            label="퇴소 사유"
            placeholder="고르기"
            options={DISCHARGE_REASONS as unknown as Array<{ value: string; label: string }>}
            value={draft.reason}
            onChange={(v) => v && set({ reason: v as DischargeReason })}
            isDisabled={saving}
          />
          <LabDateInput label="작성일" value={draft.writtenOn} onChange={(v) => set({ writtenOn: v })} />
          <Selector placeholder="고르기" label="장기요양 등급 (계약에서 채움)" options={GRADE_OPTIONS} value={draft.careGrade} onChange={(v) => v && set({ careGrade: v as LtcCareGrade })} isDisabled={saving} />
        </div>
        <SupportText>사망했거나 퇴소 없이 입원만 한 경우에는 연계기록지를 쓰지 않아 사유에 없습니다. 입원 뒤 계약을 해지하고 퇴소했다면 “입원 후 퇴소”를 고르세요.</SupportText>

        <div className={styles.suggestBox}>
          <VStack gap={2}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Text type="label">1. 사실 모으기</Text>
            </HStack>
            <SupportText>
              퇴소일 앞 {FACT_MONTHS}개월({from ? `${dotDate(from)} ~ ${dotDate(draft.dischargeOn)}` : '퇴소일을 고르면 기간이 나옵니다'})의 급여제공기록·간호일지·프로그램·기능회복훈련·사고·목욕 기록을 읽어 요약합니다. 이름은 들어가지 않습니다.
            </SupportText>
            <HStack gap={2} wrap="wrap">
              <Button label={facts ? '사실 다시 모으기' : '사실 모으기'} variant="secondary" isLoading={gathering} isDisabled={gathering || draft.elderlyId === null || from === null || saving} onClick={() => void gather()} />
            </HStack>
            {gatherError && <ErrorBanner message={gatherError} />}
            {facts && (
              <>
                <ContractReferralFacts facts={facts.facts} />
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Button label="AI 초안 만들기" variant="primary" isLoading={aiLoading} isDisabled={aiLoading || saving} onClick={() => void runAi()} />
                  <Text type="supporting" color="secondary">
                    위 사실만 근거로 세 칸의 초안을 제안합니다. 사실에 없는 진단·숫자는 적지 않도록 했지만 꼭 읽고 고쳐 주세요.
                  </Text>
                </HStack>
              </>
            )}
            {aiError && <ErrorBanner message={aiError} />}
            {aiNote && !aiError && (
              <HStack gap={2} vAlign="center" wrap="wrap">
                <AiChip />
                <Text type="supporting" color="secondary">
                  {aiNote} 읽어 보고 고친 뒤 저장해 주세요.
                </Text>
              </HStack>
            )}
          </VStack>
        </div>

        <TextArea
          label={`2. 심신기능 상태 ${marks.functionalStatus ? '(AI 제안)' : ''}`}
          placeholder="예: 보행은 지팡이를 쓰고 식사는 스스로 하심. 인지는 최근 기록에서 큰 변화 없음"
          value={draft.functionalStatus}
          onChange={(v) => setText('functionalStatus', v)}
          rows={4}
          maxLength={MAX_REFERRAL_FUNCTIONAL}
          isDisabled={saving}
        />
        <TextArea
          label={`제공한 급여 ${marks.servicesProvided ? '(AI 제안)' : ''}`}
          placeholder="예: 주야간보호(주 5일), 기능회복훈련, 프로그램 참여, 목욕"
          value={draft.servicesProvided}
          onChange={(v) => setText('servicesProvided', v)}
          rows={4}
          maxLength={MAX_REFERRAL_SERVICES}
          isDisabled={saving}
        />
        <TextArea
          label={`퇴소 후 서비스 이용계획·희망급여 ${marks.afterPlan ? '(AI 제안)' : ''}`}
          placeholder="예: 가까운 방문요양을 이용하고 싶어 하심. 상담한 내용과 희망 급여를 적기"
          value={draft.afterPlan}
          onChange={(v) => setText('afterPlan', v)}
          rows={3}
          maxLength={MAX_REFERRAL_PLAN}
          isDisabled={saving}
        />
        <TextArea
          label="종료 상담 메모 (선택)"
          description="퇴소 사유와 희망 급여를 본인(어려우면 보호자)과 상담한 내용"
          placeholder="예: 보호자와 전화로 상담함"
          value={draft.counselNote}
          onChange={(v) => set({ counselNote: v.slice(0, MAX_REFERRAL_COUNSEL) })}
          rows={2}
          maxLength={MAX_REFERRAL_COUNSEL}
          isDisabled={saving}
        />

        <VStack gap={2}>
          <Text type="label">3. 제공대장 (수급자나 보호자에게 드린 기록)</Text>
          <div className={styles.fieldGrid}>
            <LabDateInput label="제공일" value={draft.providedOn} onChange={(v) => set({ providedOn: v })} />
            <Selector
              label="제공 방법"
              placeholder="고르기"
              options={PROVIDED_METHODS as unknown as Array<{ value: string; label: string }>}
              value={draft.providedMethod === '' ? undefined : draft.providedMethod}
              onChange={(v) => set({ providedMethod: (v ?? '') as ReferralProvidedMethod | '' })}
              isDisabled={saving}
            />
            <TextInput label="제공자 (기관 담당자)" value={draft.providerName} onChange={(v) => set({ providerName: v.slice(0, MAX_PERSON_NAME) })} isDisabled={saving} />
            <TextInput label="수령자 (본인 또는 보호자)" value={draft.recipientName} onChange={(v) => set({ recipientName: v.slice(0, MAX_PERSON_NAME) })} isDisabled={saving} />
          </div>
          <SupportText>네 칸은 함께 적어야 저장됩니다. 아직 드리지 않았다면 모두 비워 두고 나중에 고치기로 채우세요. 수령자 이름은 서버에 암호화해 저장합니다.</SupportText>
        </VStack>

        <TextInput label="작성자" value={draft.writerName} onChange={(v) => set({ writerName: v.slice(0, MAX_PERSON_NAME) })} isDisabled={saving} />

        <VStack gap={1}>
          <Text type="label">평가 확인 (2026 평가 30 기준②)</Text>
          {compliance.map((c) => (
            <HStack key={c.code} gap={2} vAlign="start" wrap="wrap">
              <Chip tone={c.ok ? 'ok' : 'warn'} label={c.ok ? '충족' : '확인'} />
              <span className={styles.mutedText}>
                <Text type="supporting" color="secondary">
                  {c.message}
                </Text>
              </span>
            </HStack>
          ))}
          <SupportText>계약 종료일까지 수급자(보호자)에게 써서 드려야 하고, 사본과 제공대장으로 확인합니다. 작성일·제공일이 퇴소일보다 늦으면 상담기록지 등 관련 서류로 예외가 인정될 수 있습니다. 서식 번호는 공개 법령에 없어 기관 자체 서식입니다(공단 시행세칙 대조 필요).</SupportText>
        </VStack>

        {touched && issues.length > 0 && (
          <VStack gap={1}>
            {issues.map((m) => (
              <SupportText key={m} tone="warn">
                {m}
              </SupportText>
            ))}
          </VStack>
        )}
        {error && <ErrorBanner message={error} />}
        <HStack gap={2} hAlign="end" wrap="wrap">
          {(editing || touched) && <Button label={editing ? '고치기 취소' : '비우기'} variant="ghost" isDisabled={saving} onClick={onCancel} />}
          <Button label={editing ? '고친 내용 저장' : '연계기록지 저장'} variant="primary" isLoading={saving} isDisabled={saving || issues.length > 0} onClick={onSave} />
        </HStack>
      </VStack>
    </Card>
  );
}
