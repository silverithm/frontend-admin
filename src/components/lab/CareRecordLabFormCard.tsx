'use client';

/**
 * 급여제공기록 편집기의 접이식 "법정 서식 칸(별지 제15호)" — 이용 시각·송영, 영역 네 개의 체크·분·선택지, 영역별 제공 직원, 고시 사유.
 * 기존 서술 칸과 AI 정리는 그대로 두고, 이 카드는 같은 기록에 서식 칸을 더 적는 자리다. 칩은 접혀 있어도 보인다.
 */
import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { CARE_FORM_PROBLEM_LABEL, CARE_FORM_REASONS, CARE_FORM_SECTIONS, careRecordMinutes, sectionFilled } from '@/lib/lab/careRecordFormRules';
import type { CareRecordTexts } from '@/lib/lab/careRecordFormRules';
import type { CareFormSectionKey, CareRecordFormView, LabStaff } from '@/lib/lab/labTypes';
import { TimeField } from '@/components/labRecords/RecordsUi';
import { AiChip, Chip, SupportText } from './LabUi';
import { formChecks, patchForm, reasonContext, setReasonText, timeText, withCogSuggestion, withoutCogSuggestion } from './CareRecordLabFormDraft';
import type { FormContextInput, FormDraft } from './CareRecordLabFormDraft';
import CareRecordLabFormSections, { staffOptionsOf } from './CareRecordLabFormSections';
import { Selector } from '@astryxdesign/core/Selector';
import styles from './labForm.module.css';

function WrapChip({ tone, label }: { tone: 'warn' | 'danger'; label: string }) {
  return <span className={`${styles.wrapChip} ${tone === 'danger' ? styles.wrapChipDanger : styles.wrapChipWarn}`}>{label}</span>;
}

interface Props {
  draft: FormDraft;
  onDraft: (update: (d: FormDraft) => FormDraft) => void;
  texts: CareRecordTexts;
  context: FormContextInput;
  staff: LabStaff[];
  staffError: string | null;
  /** 그날 이 어르신이 참여한 인지활동형 프로그램(프로그램 일지)에서 낸 제안 */
  cogSuggestion: { rehabCogActivity: true; programNames: string | null; count: number } | null;
  programsError: string | null;
  defaultOpen: boolean;
  /** 값이 올라가면 카드를 펼친다(AI가 서식 칸을 채웠을 때) */
  openSignal: number;
  isDisabled?: boolean;
}

export default function CareRecordLabFormCard({ draft, onDraft, texts, context, staff, staffError, cogSuggestion, programsError, defaultOpen, openSignal, isDisabled }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);
  const { form } = draft;
  const ctx = reasonContext(draft, context);
  const checks = formChecks(form, texts, ctx);
  const span = careRecordMinutes(form.startTime, form.endTime);
  const patch = (p: Partial<CareRecordFormView>) => onDraft((d) => patchForm(d, p));
  const filled = Object.fromEntries(CARE_FORM_SECTIONS.map((s) => [s.key, sectionFilled(form, texts, s.key)])) as Record<CareFormSectionKey, boolean>;
  const warn = Object.fromEntries(CARE_FORM_SECTIONS.map((s) => [s.key, checks.writers.includes(s.key)])) as Record<CareFormSectionKey, boolean>;
  const sectionName = (k: CareFormSectionKey) => CARE_FORM_SECTIONS.find((s) => s.key === k)?.label ?? k;
  const reasonShown = CARE_FORM_REASONS.filter((r) => checks.required.includes(r.key) || form.reasons.some((x) => x.kind === r.key));
  const writerIds = Object.values(form.writers);
  const sameWriter = writerIds.every((id) => id !== null && id === writerIds[0]) ? writerIds[0] : null;
  const needsCogReason = checks.required.includes('COG_PROGRAM_MISSED');

  return (
    <div className={styles.formBox}>
      <div className={styles.formHead}>
        <Button label={open ? '법정 서식 칸(별지 제15호) 접기' : '법정 서식 칸(별지 제15호) 펼치기'} variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)} />
        <div className={styles.formHeadChips}>
          {draft.aiKeys.length > 0 && <AiChip label={`AI 제안 ${draft.aiKeys.length}칸`} />}
          {checks.problems.map((p) => (
            <WrapChip key={p} tone="warn" label={CARE_FORM_PROBLEM_LABEL[p]} />
          ))}
          {checks.writers.length > 0 && <WrapChip tone="warn" label={`영역 제공 직원 서명 필요: ${checks.writers.map(sectionName).join('·')}`} />}
          {checks.reasons.length > 0 && <WrapChip tone="danger" label={`사유 기재 필요: ${checks.reasons.map((k) => CARE_FORM_REASONS.find((r) => r.key === k)?.label ?? k).join(' · ')}`} />}
          {checks.problems.length + checks.writers.length + checks.reasons.length === 0 && (draft.aiKeys.length > 0 || form.startTime !== null || filled.PHYSICAL || filled.COGNITIVE || filled.HEALTH || filled.REHAB) && <Chip tone="ok" label="서식 점검 통과" />}
        </div>
      </div>

      {open && (
        <>
          <SupportText>공단 서식(별지 제15호) 칸 그대로 적습니다. 위 서술 칸의 글은 영역별 특이사항으로 인쇄되고, 서식 칸은 비워 둬도 저장됩니다.</SupportText>

          <div className={styles.formFields}>
            <TimeField label="이용 시작 시각" value={timeText(form.startTime)} onChange={(v) => patch({ startTime: v === '' ? null : v })} />
            <TimeField label="이용 종료 시각" value={timeText(form.endTime)} onChange={(v) => patch({ endTime: v === '' ? null : v })} />
            <div aria-live="polite">
              {span ? (
                <Chip tone={span.over13h || span.crossesMidnight ? 'warn' : 'ok'} label={`총 ${span.minutes.toLocaleString('ko-KR')}분${span.crossesMidnight ? ' (다음 날까지)' : ''}`} />
              ) : (
                <SupportText>시각을 적으면 총 이용 시간을 계산합니다</SupportText>
              )}
            </div>
          </div>

          <div className={styles.formFields}>
            <CheckboxInput label="송영(이동서비스) 이용" value={form.transport} onChange={(on) => patch({ transport: on })} isDisabled={isDisabled} />
            {form.transport && (
              <TextInput label="차량번호" placeholder="예: 12가 3456" value={form.vehicleNo ?? ''} onChange={(v) => patch({ vehicleNo: v === '' ? null : v.slice(0, 20) })} isDisabled={isDisabled} />
            )}
          </div>

          {cogSuggestion && (
            <div className={styles.formHead}>
              {draft.cogSuggested ? (
                <>
                  <SupportText>그날 프로그램 일지에서 인지활동형 프로그램 {cogSuggestion.count}건 참여를 찾아 기능회복훈련 칸에 제안으로 넣었습니다.</SupportText>
                  <Button label="제안 빼기" size="sm" variant="ghost" onClick={() => onDraft(withoutCogSuggestion)} />
                </>
              ) : !form.rehabCogActivity ? (
                <Button label="프로그램 일지의 인지활동형 참여 넣기" size="sm" variant="ghost" onClick={() => onDraft((d) => withCogSuggestion(d, cogSuggestion))} />
              ) : null}
            </div>
          )}

          {staff.length > 0 && (
            <Selector
              label="네 영역 제공 직원을 한 번에 고르기"
              placeholder="한 직원이 모두 제공했을 때"
              hasSearch
              searchPlaceholder="찾기"
              hasClear
              options={staffOptionsOf(staff, form.writers, form.writerNames)}
              value={sameWriter === null ? null : String(sameWriter)}
              onChange={(v) => patch({ writers: { PHYSICAL: v === null ? null : Number(v), COGNITIVE: v === null ? null : Number(v), HEALTH: v === null ? null : Number(v), REHAB: v === null ? null : Number(v) } })}
              isDisabled={isDisabled}
            />
          )}

          <CareRecordLabFormSections draft={draft} onPatch={patch} staff={staff} staffError={staffError} isDisabled={isDisabled} warn={warn} filled={filled} />

          <CheckboxInput
            label="미이용일로 기록 (월 15일 이상 계약한 수급자가 본인 사정으로 이용하지 않은 날)"
            value={draft.unusedDay}
            onChange={(on) => onDraft((d) => ({ ...d, unusedDay: on }))}
            isDisabled={isDisabled}
          />

          {programsError && context.careGrade !== null && (
            <SupportText tone="warn">프로그램 일지를 불러오지 못해 인지활동형 점검을 건너뛰었습니다. {programsError}</SupportText>
          )}
          {needsCogReason && !form.reasons.some((r) => r.kind === 'COG_PROGRAM_MISSED') && (
            <SupportText tone="warn">5등급·인지지원 어르신인데 그날 60분 이상 인지활동형 프로그램 참여 기록이 없습니다. 예외로 급여비용을 산정하려면 사유를 적어 주세요(고시 제32조⑩⑪).</SupportText>
          )}

          {reasonShown.map((r) => (
            <div key={r.key} className={styles.formReason}>
              <TextArea
                label={`${r.label} (${r.basis})`}
                description="이 사유는 급여제공기록지에 적어야 합니다."
                value={form.reasons.find((x) => x.kind === r.key)?.text ?? ''}
                onChange={(v) => onDraft((d) => setReasonText(d, r.key, v))}
                rows={2}
                maxLength={300}
                status={checks.reasons.includes(r.key) ? { type: 'warning', message: '사유를 적어 주세요' } : undefined}
                isDisabled={isDisabled}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
