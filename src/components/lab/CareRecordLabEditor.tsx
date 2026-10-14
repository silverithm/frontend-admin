'use client';

/**
 * 급여제공기록 하루치 편집기 — 어르신 한 명 · 하루.
 * 메모를 적고 "AI로 정리"를 누르면 여덟 칸에 제안이 들어온다. 제안은 언제나 고칠 수 있고, 저장 버튼을 눌러야만 저장된다.
 * 형식적 문구("특이사항 없음" 등)는 입력하는 동안 바로 짚어 준다 — 저장을 막지는 않는다(현장 판단이 우선).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { aiStructureCareNote, deleteCareRecord, saveCareRecord } from '@/lib/lab/labApi';
import { findVaguePhrases } from '@/lib/lab/careRecordQuality';
import type { CareRecord, CareRecordInput, CareRecordTextField, CareRecordWarning } from '@/lib/lab/labTypes';
import CareRecordLabImport from './CareRecordLabImport';
import { AiChip, Chip, ErrorBanner, LabConfirm, SupportText, useNotify } from './LabUi';
import { PROVIDER_KEY, dateLabel, defaultPersonName, errorText, writeStored } from './labFormat';
import styles from './lab.module.css';

interface FieldSpec {
  key: CareRecordTextField;
  label: string;
  rows: number;
  max: number;
}

// 칸 순서는 현장 기록지의 순서를 따른다
export const CARE_FIELDS: readonly FieldSpec[] = [
  { key: 'physical', label: '신체활동 지원', rows: 3, max: 2000 },
  { key: 'cognitive', label: '인지 지원', rows: 3, max: 2000 },
  { key: 'meal', label: '식사', rows: 2, max: 200 },
  { key: 'toilet', label: '배설(화장실)', rows: 2, max: 200 },
  { key: 'bath', label: '목욕', rows: 2, max: 200 },
  { key: 'nursing', label: '간호·처치', rows: 2, max: 2000 },
  { key: 'training', label: '기능회복훈련', rows: 3, max: 2000 },
  { key: 'specialNote', label: '특이사항', rows: 3, max: 2000 },
];

type Fields = Record<CareRecordTextField, string>;

interface Draft {
  fields: Fields;
  /** AI가 채웠고 아직 사람이 손대지 않은 칸 */
  ai: Partial<Record<CareRecordTextField, true>>;
  memo: string;
  provider: string;
  aiUsed: boolean;
  aiWarnings: CareRecordWarning[];
  aiKept: number;
}

function emptyFields(): Fields {
  return { physical: '', cognitive: '', meal: '', toilet: '', bath: '', nursing: '', training: '', specialNote: '' };
}

function draftFromRecord(record: CareRecord | null): Draft {
  const fields = emptyFields();
  if (record) for (const f of CARE_FIELDS) fields[f.key] = record[f.key] ?? '';
  return {
    fields,
    ai: {},
    memo: record?.rawNote ?? '',
    provider: record?.providerName ?? defaultPersonName(),
    aiUsed: false,
    aiWarnings: [],
    aiKept: 0,
  };
}

function snapshot(d: Draft): string {
  return JSON.stringify([d.fields, d.memo, d.provider]);
}

const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

interface CareRecordEditorProps {
  elderId: number;
  elderName: string;
  date: string;
  record: CareRecord | null;
  onSaved: (record: CareRecord) => void;
  onDeleted: (recordId: number) => void;
  onDirtyChange: (dirty: boolean) => void;
  onBack: () => void;
}

export default function CareRecordLabEditor({ elderId, elderName, date, record, onSaved, onDeleted, onDirtyChange, onBack }: CareRecordEditorProps) {
  const notify = useNotify();
  const [draft, setDraft] = useState<Draft>(() => draftFromRecord(record));
  const [baseline, setBaseline] = useState(() => snapshot(draftFromRecord(record)));
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const dirty = snapshot(draft) !== baseline;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  // 편집기가 사라질 때(다른 어르신으로 이동) 저장 안 함 표시를 남기지 않는다
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const vague = useMemo(() => findVaguePhrases(draft.fields), [draft.fields]);
  const vagueByField = useMemo(() => {
    const map = new Map<string, typeof vague>();
    for (const v of vague) map.set(v.field, [...(map.get(v.field) ?? []), v]);
    return map;
  }, [vague]);

  const setField = (key: CareRecordTextField, value: string) => {
    setDraft((d) => {
      const ai = { ...d.ai };
      delete ai[key]; // 사람이 손댄 칸은 더 이상 AI 제안이 아니다
      return { ...d, fields: { ...d.fields, [key]: value }, ai };
    });
  };

  /** 다른 기록에서 가져온 문장을 칸 뒤에 덧붙인다. 이미 들어 있으면 건너뛰고, 칸 길이 제한을 넘기지 않는다. */
  const insertImported = (key: CareRecordTextField, text: string) => {
    const spec = CARE_FIELDS.find((f) => f.key === key);
    if (!spec) return;
    setDraft((d) => {
      const current = d.fields[key].trim();
      if (current.includes(text)) return d;
      const next = (current === '' ? text : `${current}\n${text}`).slice(0, spec.max);
      const ai = { ...d.ai };
      delete ai[key];
      return { ...d, fields: { ...d.fields, [key]: next }, ai };
    });
  };

  const runAi = async () => {
    const memo = draft.memo.trim();
    if (memo === '' || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiStructureCareNote(memo);
      if (!alive.current) return;
      setDraft((d) => {
        const fields = { ...d.fields };
        const ai = { ...d.ai };
        let kept = 0;
        for (const spec of CARE_FIELDS) {
          const suggested = (result[spec.key] ?? '').trim().slice(0, spec.max);
          if (suggested === '') continue;
          // 직접 쓴 칸은 덮어쓰지 않는다 — AI 제안은 비어 있거나 이전 제안일 때만 채운다
          if (fields[spec.key].trim() === '' || ai[spec.key]) {
            fields[spec.key] = suggested;
            ai[spec.key] = true;
          } else if (fields[spec.key].trim() !== suggested) {
            kept += 1;
          }
        }
        return { ...d, fields, ai, aiUsed: true, aiWarnings: result.warnings ?? [], aiKept: kept };
      });
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 메모를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요'));
    } finally {
      if (alive.current) setAiLoading(false);
    }
  };

  const applyRewrite = (w: CareRecordWarning) => {
    if (w.field === 'note') return;
    const field = w.field;
    setDraft((d) => {
      if (!d.fields[field].includes(w.phrase)) return d;
      const ai = { ...d.ai };
      delete ai[field];
      return { ...d, fields: { ...d.fields, [field]: d.fields[field].replace(w.phrase, w.suggestion) }, ai };
    });
  };

  const save = async () => {
    if (saving) return;
    const hasContent = CARE_FIELDS.some((f) => draft.fields[f.key].trim() !== '') || draft.memo.trim() !== '';
    if (!hasContent) {
      setSaveError('기록할 내용을 한 칸 이상 적어 주세요');
      return;
    }
    if (draft.provider.trim() === '') {
      setSaveError('제공자 이름을 적어 주세요');
      return;
    }
    const input: CareRecordInput = {
      elderlyId: elderId,
      recordDate: date,
      physical: orNull(draft.fields.physical),
      cognitive: orNull(draft.fields.cognitive),
      meal: orNull(draft.fields.meal),
      toilet: orNull(draft.fields.toilet),
      bath: orNull(draft.fields.bath),
      nursing: orNull(draft.fields.nursing),
      training: orNull(draft.fields.training),
      specialNote: orNull(draft.fields.specialNote),
      rawNote: orNull(draft.memo),
      providerName: orNull(draft.provider),
      aiAssisted: draft.aiUsed || (record?.aiAssisted ?? false),
    };
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveCareRecord(input);
      if (!alive.current) {
        onSaved(saved);
        return;
      }
      writeStored(PROVIDER_KEY, draft.provider.trim());
      setBaseline(snapshot(draft));
      onSaved(saved);
      const warnCount = findVaguePhrases(draft.fields).length;
      notify(warnCount > 0 ? `저장했습니다. 형식적인 문구가 ${warnCount}곳 있어요` : '저장했습니다', 'success');
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '급여제공기록을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!record || deleting) return;
    setDeleting(true);
    try {
      await deleteCareRecord(record.id);
      onDeleted(record.id);
      notify('기록을 삭제했습니다', 'success');
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setSaveError(errorText(e, '급여제공기록을 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const noteWarnings = draft.aiWarnings.filter((w) => w.field === 'note' && draft.memo.includes(w.phrase));

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              {elderName}
            </Text>
            <Text type="supporting" color="secondary">
              {dateLabel(date)} 기록
            </Text>
          </VStack>
          <HStack gap={2} vAlign="center">
            {record ? <Chip tone="ok" label="저장됨" /> : <Chip tone="neutral" label="기록 없음" />}
            {dirty && <Chip tone="warn" label="저장 전" />}
            <span className={styles.onlyNarrow}>
              <Button label="목록으로" size="sm" variant="ghost" onClick={onBack} />
            </span>
          </HStack>
        </HStack>

        <VStack gap={2}>
          <TextArea
            label="메모"
            description="오늘 있었던 일을 편하게 적어 주세요. 아래 칸은 AI가 나눠 정리해 줍니다."
            placeholder="예: 오전에 보행기로 복도를 두 바퀴 걸으셨다. 점심은 밥 한 공기와 국을 다 드셨고, 오후에 화장실을 두 번 다녀오셨다."
            value={draft.memo}
            onChange={(value) => setDraft((d) => ({ ...d, memo: value }))}
            rows={5}
            maxLength={2000}
          />
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Button
              label="AI로 정리"
              variant="secondary"
              isLoading={aiLoading}
              isDisabled={draft.memo.trim() === '' || aiLoading}
              onClick={() => void runAi()}
            />
            <Text type="supporting" color="secondary">
              어르신 이름과 연락처는 메모에 적지 마세요. 메모만 AI로 보내고, 결과는 제안일 뿐 저장되지 않습니다.
            </Text>
          </HStack>
          {aiError && <ErrorBanner message={aiError} />}
          {draft.aiUsed && !aiError && (
            <div className={styles.suggestBox}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <AiChip />
                  <Text type="supporting" color="secondary">
                    아래 칸에 제안을 채웠습니다. 읽어 보고 고친 뒤 저장해 주세요.
                  </Text>
                </HStack>
                {draft.aiKept > 0 && (
                  <SupportText>직접 쓰신 {draft.aiKept}칸은 그대로 두었습니다.</SupportText>
                )}
                {noteWarnings.map((w) => (
                  <SupportText key={`${w.phrase}-${w.suggestion}`} tone="warn">
                    메모의 ‘{w.phrase}’은(는) 모호합니다. {w.suggestion}
                  </SupportText>
                ))}
              </VStack>
            </div>
          )}
        </VStack>

        <CareRecordLabImport elderId={elderId} date={date} fields={draft.fields} onInsert={insertImported} />

        <div className={styles.fieldGridWide}>
          {CARE_FIELDS.map((spec) => {
            const live = vagueByField.get(spec.key) ?? [];
            const rewrites = draft.aiWarnings.filter((w) => w.field === spec.key && draft.fields[spec.key].includes(w.phrase));
            return (
              <VStack gap={1} key={spec.key}>
                <TextArea
                  label={draft.ai[spec.key] ? `${spec.label} · AI 제안` : spec.label}
                  value={draft.fields[spec.key]}
                  onChange={(value) => setField(spec.key, value)}
                  rows={spec.rows}
                  maxLength={spec.max}
                  status={live.length > 0 ? { type: 'warning' } : undefined}
                />
                {live.map((v) => (
                  <SupportText key={v.phrase} tone="warn">
                    ‘{v.phrase}’ — {v.hint}
                  </SupportText>
                ))}
                {rewrites.map((w) => (
                  <HStack key={`${w.phrase}-${w.suggestion}`} gap={2} vAlign="center" wrap="wrap">
                    <SupportText>AI 제안: {w.suggestion}</SupportText>
                    <Button label="이렇게 바꾸기" size="sm" variant="ghost" onClick={() => applyRewrite(w)} />
                  </HStack>
                ))}
              </VStack>
            );
          })}
        </div>

        <div className={styles.fieldGrid}>
          <TextInput
            label="제공자 이름"
            value={draft.provider}
            onChange={(value) => setDraft((d) => ({ ...d, provider: value.slice(0, 50) }))}
          />
        </div>

        {saveError && <ErrorBanner message={saveError} />}

        <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
          <div>
            {record && (
              <Button label="기록 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />
            )}
          </div>
          <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving || !dirty} onClick={() => void save()} />
        </HStack>
      </VStack>

      <LabConfirm
        isOpen={confirmDelete}
        title="이 기록을 삭제할까요?"
        description={`${elderName} 어르신의 ${dateLabel(date)} 기록이 지워지며 되돌릴 수 없습니다.`}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </Card>
  );
}
