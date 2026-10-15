'use client';

/**
 * 별지 제15호서식의 영역 네 개(신체활동지원 · 인지관리 및 의사소통 · 건강 및 간호관리 · 기능회복훈련) 입력 칸.
 * 칸 이름과 순서는 서식을 그대로 따른다. 영역마다 실제로 서비스를 제공한 직원(작성자)을 고른다 — 유의사항 7.
 */
import { useState } from 'react';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { BATH_METHODS as FORM_BATH_METHODS, CARE_FORM_SECTIONS, MEAL_INTAKES, MEAL_KINDS } from '@/lib/lab/careRecordFormRules';
import type { AiFormKey } from '@/lib/lab/careRecordFormRules';
import type { CareFormBathMethod, CareFormMealIntake, CareFormMealKind, CareFormSectionKey, CareRecordFormView, LabStaff } from '@/lib/lab/labTypes';
import { Chip, NumField } from './LabUi';
import type { FormDraft } from './CareRecordLabFormDraft';
import styles from './labForm.module.css';

export interface SectionsProps {
  draft: FormDraft;
  onPatch: (patch: Partial<CareRecordFormView>) => void;
  staff: LabStaff[];
  staffError: string | null;
  isDisabled?: boolean;
}

/** 칸 이름 뒤에 AI 제안 표시를 붙인다(사람이 고치면 사라진다) */
const aiLabel = (draft: FormDraft, label: string, ...keys: AiFormKey[]) => (keys.some((k) => draft.aiKeys.includes(k)) ? `${label} · AI 제안` : label);

function parseTemperature(text: string): number | null {
  const n = Number(text);
  return text.trim() !== '' && Number.isFinite(n) && n >= 34 && n <= 42 ? Math.round(n * 10) / 10 : null;
}

/** 체온 — 34.0~42.0, 소수 첫째 자리. 칸 안의 글은 그대로 두고 읽을 수 있을 때만 값을 올린다. */
function TemperatureField({ label, value, onChange, isDisabled }: { label: string; value: number | null; onChange: (v: number | null) => void; isDisabled?: boolean }) {
  const [text, setText] = useState(value === null ? '' : value.toFixed(1));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    // 바깥 값(AI 제안·저장된 기록)이 바뀌었을 때만 칸 글자를 따라간다 — 치는 중인 글자는 그대로 둔다
    if (value !== parseTemperature(text)) setText(value === null ? '' : value.toFixed(1));
  }
  const bad = text.trim() !== '' && parseTemperature(text) === null;
  return (
    <TextInput
      label={label}
      value={text}
      placeholder="예: 36.5"
      isDisabled={isDisabled}
      onChange={(v) => {
        const t = v.replace(/[^0-9.]/g, '').slice(0, 4);
        setText(t);
        onChange(parseTemperature(t));
      }}
      status={bad ? { type: 'warning', message: '34.0~42.0 사이로 적어 주세요' } : undefined}
    />
  );
}

/** 직원 고르기 후보 — 퇴사 등으로 목록에 없는 사람이 저장돼 있어도 번호만 남지 않게 한 칸 더한다 */
export function staffOptionsOf(staff: LabStaff[], writers: Record<CareFormSectionKey, number | null>, names?: Record<CareFormSectionKey, string | null>) {
  const options = staff.map((s) => ({ value: String(s.id), label: s.position ? `${s.name} (${s.position})` : s.name }));
  for (const k of CARE_FORM_SECTIONS.map((x) => x.key)) {
    const id = writers[k];
    if (id !== null && !options.some((o) => o.value === String(id))) options.push({ value: String(id), label: names?.[k] ?? `직원 ${id}` });
  }
  return options;
}

function Section({ k, draft, warn, filled, staff, staffError, onPatch, isDisabled, children }: SectionsProps & { k: CareFormSectionKey; warn: boolean; filled: boolean; children: React.ReactNode }) {
  const title = CARE_FORM_SECTIONS.find((s) => s.key === k)?.label ?? k;
  const writerId = draft.form.writers[k];
  const options = staffOptionsOf(staff, draft.form.writers, draft.form.writerNames);
  return (
    <section className={`${styles.formSection} ${warn ? styles.formSectionWarn : ''}`} aria-label={title}>
      <div className={styles.formSectionTitle}>
        <Text type="label">{title}</Text>
        {filled && writerId === null && <Chip tone="warn" label="제공 직원 필요" />}
      </div>
      {children}
      <Selector
        label="제공 직원 (작성자)"
        placeholder="제공한 직원 고르기"
        hasSearch
        searchPlaceholder="찾기"
        hasClear
        options={options}
        value={writerId === null ? null : String(writerId)}
        onChange={(v) => onPatch({ writers: { ...draft.form.writers, [k]: v === null ? null : Number(v) } })}
        isDisabled={isDisabled}
        description={staffError ? undefined : '실제로 이 서비스를 제공한 직원이 서식의 작성자란에 서명합니다.'}
        status={staffError ? { type: 'warning', message: staffError } : undefined}
      />
    </section>
  );
}

function Check({ draft, k, label, onPatch, isDisabled }: { draft: FormDraft; k: 'washHelp' | 'mobilityHelp' | 'cogSupport' | 'commHelp' | 'emergency' | 'rehabPhysical' | 'rehabCogActivity' | 'rehabCogTraining' | 'rehabPtOt'; label: string; onPatch: (p: Partial<CareRecordFormView>) => void; isDisabled?: boolean }) {
  const ai = draft.aiKeys.includes(k as AiFormKey);
  const cog = k === 'rehabCogActivity' && draft.cogSuggested;
  return <CheckboxInput label={ai ? `${label} · AI 제안` : cog ? `${label} · 프로그램 일지 제안` : label} value={draft.form[k]} onChange={(on) => onPatch({ [k]: on })} isDisabled={isDisabled} />;
}

interface Warn {
  warn: Record<CareFormSectionKey, boolean>;
  filled: Record<CareFormSectionKey, boolean>;
}

export default function CareRecordLabFormSections(props: SectionsProps & Warn) {
  const { draft, onPatch, isDisabled, warn, filled } = props;
  const f = draft.form;
  const shared = { ...props };
  return (
    <>
      <Section {...shared} k="PHYSICAL" warn={warn.PHYSICAL} filled={filled.PHYSICAL}>
        <div className={styles.formChecks}>
          <Check draft={draft} k="washHelp" label="세면·구강청결·머리감기·몸단장·옷 갈아입기 도움" onPatch={onPatch} isDisabled={isDisabled} />
          <Check draft={draft} k="mobilityHelp" label="이동도움 및 신체기능 유지·증진" onPatch={onPatch} isDisabled={isDisabled} />
        </div>
        <div className={styles.formFields}>
          <NumField label={aiLabel(draft, '목욕 시간(분)', 'bathMinutes')} value={f.bathMinutes} onChange={(v) => onPatch({ bathMinutes: v })} max={180} grouped={false} isDisabled={isDisabled} />
          <Selector
            label={aiLabel(draft, '목욕 방법', 'bathMethod')}
            placeholder="고르기"
            hasClear
            options={FORM_BATH_METHODS.map((m) => ({ value: m.key, label: m.label }))}
            value={f.bathMethod}
            onChange={(v) => onPatch({ bathMethod: v as CareFormBathMethod | null })}
            isDisabled={isDisabled}
          />
          <Selector
            label={aiLabel(draft, '식사 종류', 'mealKind')}
            placeholder="고르기"
            hasClear
            options={MEAL_KINDS.map((m) => ({ value: m.key, label: m.label }))}
            value={f.mealKind}
            onChange={(v) => onPatch({ mealKind: v as CareFormMealKind | null })}
            isDisabled={isDisabled}
          />
          <Selector
            label={aiLabel(draft, '식사 섭취량', 'mealIntake')}
            placeholder="고르기"
            hasClear
            options={MEAL_INTAKES.map((m) => ({ value: m.key, label: m.label }))}
            value={f.mealIntake}
            onChange={(v) => onPatch({ mealIntake: v as CareFormMealIntake | null })}
            isDisabled={isDisabled}
          />
          <NumField label={aiLabel(draft, '화장실 이용(회)', 'toiletCount')} value={f.toiletCount} onChange={(v) => onPatch({ toiletCount: v })} max={30} grouped={false} description="소변·대변 총 횟수, 기저귀는 교환 횟수" isDisabled={isDisabled} />
        </div>
      </Section>

      <Section {...shared} k="COGNITIVE" warn={warn.COGNITIVE} filled={filled.COGNITIVE}>
        <div className={styles.formChecks}>
          <Check draft={draft} k="cogSupport" label="인지관리지원" onPatch={onPatch} isDisabled={isDisabled} />
          <Check draft={draft} k="commHelp" label="의사소통도움 등 말벗·격려" onPatch={onPatch} isDisabled={isDisabled} />
        </div>
      </Section>

      <Section {...shared} k="HEALTH" warn={warn.HEALTH} filled={filled.HEALTH}>
        <div className={styles.formFields}>
          <NumField label={aiLabel(draft, '혈압 수축기', 'bpSystolic')} value={f.bpSystolic} onChange={(v) => onPatch({ bpSystolic: v })} max={260} grouped={false} isDisabled={isDisabled} />
          <NumField label={aiLabel(draft, '혈압 이완기', 'bpDiastolic')} value={f.bpDiastolic} onChange={(v) => onPatch({ bpDiastolic: v })} max={160} grouped={false} isDisabled={isDisabled} />
          <TemperatureField label={aiLabel(draft, '체온(℃)', 'temperature')} value={f.temperature} onChange={(v) => onPatch({ temperature: v })} isDisabled={isDisabled} />
          <NumField label="건강관리(분)" value={f.healthCareMinutes} onChange={(v) => onPatch({ healthCareMinutes: v })} max={600} grouped={false} isDisabled={isDisabled} />
          <NumField label="간호관리(분)" value={f.nursingCareMinutes} onChange={(v) => onPatch({ nursingCareMinutes: v })} max={600} grouped={false} isDisabled={isDisabled} />
        </div>
        <div className={styles.formChecks}>
          <Check draft={draft} k="emergency" label="기타(응급서비스)" onPatch={onPatch} isDisabled={isDisabled} />
        </div>
      </Section>

      <Section {...shared} k="REHAB" warn={warn.REHAB} filled={filled.REHAB}>
        <TextInput
          label={draft.cogSuggested ? '신체·인지기능 향상 프로그램명 · 프로그램 일지 제안' : '신체·인지기능 향상 프로그램명'}
          description="프로그램을 한 날은 프로그램 이름을 적습니다(유의사항 5)."
          placeholder="예: 회상 놀이, 실내 걷기"
          value={f.programNames ?? ''}
          onChange={(v) => onPatch({ programNames: v === '' ? null : v.slice(0, 200) })}
          isDisabled={isDisabled}
        />
        <div className={styles.formChecks}>
          <Check draft={draft} k="rehabPhysical" label="신체기능·기본동작, 일상생활동작훈련" onPatch={onPatch} isDisabled={isDisabled} />
          <Check draft={draft} k="rehabCogActivity" label="인지활동형 프로그램" onPatch={onPatch} isDisabled={isDisabled} />
          <Check draft={draft} k="rehabCogTraining" label="인지기능 향상훈련" onPatch={onPatch} isDisabled={isDisabled} />
          <Check draft={draft} k="rehabPtOt" label="물리(작업)치료" onPatch={onPatch} isDisabled={isDisabled} />
        </div>
      </Section>
    </>
  );
}
