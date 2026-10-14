'use client';

/**
 * 입소 상담 편집기 — 문의일·신청 어르신·문의한 분·관계·연락처(동의일 필수)·등급·희망 요일·욕구·경로·상태·거절 사유·다음 연락일·상담자.
 * 상태를 ‘계약 완료’로 하면 기존 어르신 목록에서 한 분을 연결한다(어르신 등록은 어르신 관리에서 먼저).
 */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import type { LabElder } from '@/components/lab/useLabElders';
import { DECLINE_LAW_NOTE, DECLINE_REASONS, INTAKE_CARE_GRADES, INTAKE_RELATIONS, INTAKE_SOURCES, INTAKE_STATUSES, NO_CONSENT_MESSAGE } from '@/lib/lab/intakeRules';
import type { IntakeCareGrade, IntakeDeclineReason, IntakeRelation, IntakeSource, IntakeStatus } from '@/lib/lab/labTypes';
import { MAX_DAYS, MAX_DECLINE_NOTE, MAX_NAME, MAX_NEEDS, intakeBlockers, sanitizePhone } from './IntakeDraft';
import type { IntakeDraft } from './IntakeDraft';
import IntakeNoteAi from './IntakeNoteAi';
import styles from './labPlans.module.css';

const NONE = '__none';
const withNone = (list: ReadonlyArray<{ value: string; label: string }>) => [{ value: NONE, label: '선택 안 함' }, ...list];

interface Props {
  draft: IntakeDraft;
  onChange: (patch: (d: IntakeDraft) => IntakeDraft) => void;
  elders: LabElder[];
  eldersLoading: boolean;
  eldersError: string | null;
  /** 고치는 상담에 연결된 어르신 이름(목록에 없을 때 보여 줄 용도) */
  linkedName: string | null;
  today: string;
  saving: boolean;
  deleting: boolean;
  dirty: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export default function IntakeEditor({ draft, onChange, elders, eldersLoading, eldersError, linkedName, today, saving, deleting, dirty, error, onSave, onCancel, onDelete }: Props) {
  const set = (p: Partial<IntakeDraft>) => onChange((d) => ({ ...d, ...p }));
  const editing = draft.id !== null;
  const blockers = intakeBlockers(draft);
  const busy = saving || deleting;
  const needsConsent = draft.contactPhone.trim() !== '' && draft.consentOn === '';
  const elderOptions = elders.map((e) => ({ value: String(e.id), label: e.name }));
  if (draft.elderlyId !== null && !elders.some((e) => e.id === draft.elderlyId)) elderOptions.unshift({ value: String(draft.elderlyId), label: linkedName ?? '연결된 어르신' });

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{editing ? '상담 고치기' : '새 상담 기록'}</Text>
          {dirty && <Chip tone="warn" label="저장하지 않은 변경" />}
          {draft.aiAssisted && <Chip tone="info" label="AI 제안 반영" />}
        </HStack>

        <div className={styles.fieldGrid}>
          <LabDateInput label="문의일" value={draft.inquiryDate} onChange={(v) => set({ inquiryDate: v })} max={today} />
          <TextInput label="신청 어르신 이름" value={draft.applicantName} onChange={(v) => set({ applicantName: v.slice(0, MAX_NAME) })} isDisabled={busy} placeholder="이용을 원하는 어르신" />
          <Selector
            label="경로"
            placeholder="고르기"
            options={INTAKE_SOURCES as unknown as Array<{ value: string; label: string }>}
            value={draft.source}
            onChange={(v) => v && set({ source: v as IntakeSource })}
            isDisabled={busy}
          />
        </div>

        <div className={styles.fieldGrid}>
          <TextInput label="문의한 분 (선택)" value={draft.contactName} onChange={(v) => set({ contactName: v.slice(0, MAX_NAME) })} isDisabled={busy} placeholder="전화한 보호자 등" />
          <Selector
            label="신청 어르신과의 관계 (선택)"
            placeholder="고르기"
            options={withNone(INTAKE_RELATIONS)}
            value={draft.relation === '' ? NONE : draft.relation}
            onChange={(v) => set({ relation: v === null || v === NONE ? '' : (v as IntakeRelation) })}
            isDisabled={busy}
          />
          <TextInput label="연락처 (선택)" value={draft.contactPhone} onChange={(v) => set({ contactPhone: sanitizePhone(v) })} isDisabled={busy} placeholder="예: 010-1234-5678" />
        </div>

        <VStack gap={1}>
          <LabDateInput label={needsConsent ? '개인정보 수집·이용 동의일 (연락처를 쓰면 꼭 필요)' : '개인정보 수집·이용 동의일 (연락처를 쓸 때)'} value={draft.consentOn} onChange={(v) => set({ consentOn: v })} max={today} />
          <SupportText tone={needsConsent ? 'warn' : undefined}>
            {needsConsent
              ? `${NO_CONSENT_MESSAGE}. 연락처를 받을 때 수집 목적·항목·보유 기간과 동의하지 않아도 된다는 점을 알리고 동의를 받은 날을 적어 주세요(개인정보 보호법 제15조).`
              : '연락처를 받으려면 수집 목적·항목·보유 기간을 알리고 동의를 받아야 합니다(개인정보 보호법 제15조). 동의를 받은 날을 여기에 적어야 연락처가 저장됩니다.'}
          </SupportText>
        </VStack>

        <div className={styles.fieldGrid}>
          <Selector
            label="장기요양 등급 (선택)"
            placeholder="고르기"
            options={withNone(INTAKE_CARE_GRADES)}
            value={draft.careGrade === '' ? NONE : draft.careGrade}
            onChange={(v) => set({ careGrade: v === null || v === NONE ? '' : (v as IntakeCareGrade) })}
            isDisabled={busy}
          />
          <TextInput label="희망 요일 (선택)" value={draft.desiredDays} onChange={(v) => set({ desiredDays: v.slice(0, MAX_DAYS) })} isDisabled={busy} placeholder="예: 월·수·금 오전" />
          <LabDateInput label="다음 연락일 (선택)" value={draft.nextContactOn} onChange={(v) => set({ nextContactOn: v })} />
        </div>

        <TextArea label="욕구·상황 (선택)" description="어르신이 원하는 것, 어려움, 건강 상태 등. 서버에 암호화해 저장합니다." value={draft.needs} onChange={(v) => set({ needs: v.slice(0, MAX_NEEDS) })} rows={4} maxLength={MAX_NEEDS} isDisabled={busy} />

        <IntakeNoteAi draft={draft} disabled={busy} onChange={onChange} />

        <div className={styles.fieldGrid}>
          <Selector
            label="상태"
            placeholder="고르기"
            options={INTAKE_STATUSES as unknown as Array<{ value: string; label: string }>}
            value={draft.status}
            onChange={(v) => v && set({ status: v as IntakeStatus })}
            isDisabled={busy}
          />
          <TextInput label="상담자" value={draft.counselorName} onChange={(v) => set({ counselorName: v.slice(0, MAX_NAME) })} isDisabled={busy} placeholder="상담한 직원 이름" />
        </div>

        {draft.status === 'DECLINED' && (
          <VStack gap={2}>
            <div className={styles.fieldGrid}>
              <Selector
                label="거절 사유"
                placeholder="사유 고르기"
                options={DECLINE_REASONS as unknown as Array<{ value: string; label: string }>}
                value={draft.declineReason === '' ? undefined : draft.declineReason}
                onChange={(v) => set({ declineReason: (v ?? '') as IntakeDeclineReason | '' })}
                isDisabled={busy}
              />
              <TextInput label="사유 메모 (선택)" value={draft.declineNote} onChange={(v) => set({ declineNote: v.slice(0, MAX_DECLINE_NOTE) })} isDisabled={busy} placeholder="예: 현재 정원 25명이 모두 찼습니다" />
            </div>
            <SupportText tone="warn">{DECLINE_LAW_NOTE}</SupportText>
          </VStack>
        )}

        {draft.status === 'CONTRACTED' && (
          <div className={styles.suggestBox}>
            <VStack gap={2}>
              <Selector
                label="연결할 어르신"
                placeholder={eldersLoading ? '어르신 목록을 불러오는 중...' : '어르신 고르기'}
                hasSearch
                searchPlaceholder="찾기"
                options={elderOptions}
                value={draft.elderlyId === null ? undefined : String(draft.elderlyId)}
                onChange={(v) => v && set({ elderlyId: Number(v) })}
                isDisabled={busy || eldersLoading}
              />
              {eldersError && <SupportText tone="warn">{eldersError}</SupportText>}
              <SupportText>어르신 등록은 기존 ‘어르신 관리’에서 먼저 해 주세요. 목록에 없으면 거기서 등록한 뒤 이 화면으로 돌아오면 됩니다.</SupportText>
              <SupportText>저장한 뒤 실험실의 ‘수급자 &gt; 계약·인정’ 메뉴에서 이 어르신의 계약서와 인정 유효기간을 이어서 등록해 주세요.</SupportText>
            </VStack>
          </div>
        )}
        {draft.status === 'WAITING' && <SupportText>대기로 저장하면 문의일이 이른 순서대로 대기 순번이 매겨집니다.</SupportText>}

        {blockers.length > 0 && (
          <VStack gap={1}>
            <Text type="label">저장하기 전에 확인해 주세요</Text>
            {blockers.map((m) => (
              <SupportText key={m} tone="warn">
                {m}
              </SupportText>
            ))}
          </VStack>
        )}
        {error && <ErrorBanner message={error} />}
        <HStack gap={2} hAlign="end" wrap="wrap">
          {editing && <Button label="이 상담 삭제" variant="ghost" isLoading={deleting} isDisabled={busy} onClick={onDelete} />}
          <Button label={editing ? '고치기 취소' : '비우기'} variant="ghost" isDisabled={busy} onClick={onCancel} />
          <Button label={editing ? '고친 내용 저장' : '상담 저장'} variant="primary" isLoading={saving} isDisabled={busy || blockers.length > 0 || (editing && !dirty)} onClick={onSave} />
        </HStack>
      </VStack>
    </Card>
  );
}
