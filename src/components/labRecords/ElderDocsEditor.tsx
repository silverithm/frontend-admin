'use client';

/** 서류 기록 한 건 쓰기·고치기 — 종류·제목·발급일·만료일·보관 위치·확인일·메모. 저장은 직원이 누른다. */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createElderDocument, updateElderDocument } from '@/lib/lab/labApi';
import { ELDER_DOC_TYPES } from '@/lib/lab/elderDocRules';
import type { ElderDocType, ElderDocument } from '@/lib/lab/labTypes';
import { ErrorBanner, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { DOC_LIMITS, docInput, docProblems, draftFromDoc, newDocDraft } from './ElderDocsDraft';
import type { DocDraft } from './ElderDocsDraft';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './ElderDocs.module.css';

interface Props {
  elderId: number;
  elderName: string;
  /** 새 기록이면 미리 골라 둘 종류 */
  docType: ElderDocType;
  doc: ElderDocument | null;
  onSaved: () => void;
  onClose: () => void;
}

export default function ElderDocsEditor({ elderId, elderName, docType, doc, onSaved, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [draft, setDraft] = useState<DocDraft>(() => (doc ? draftFromDoc(doc) : newDocDraft(docType)));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = useMemo(() => docProblems(draft), [draft]);
  const set = <K extends keyof DocDraft>(key: K, value: DocDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (saving) return;
    setSubmitted(true);
    if (problems.length > 0) {
      setError('아래 빨간 안내를 확인해 주세요');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = docInput(elderId, draft);
      if (doc) await updateElderDocument(doc.id, input);
      else await createElderDocument(input);
      notify(doc ? '서류 기록을 고쳤습니다' : '서류 기록을 추가했습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) setError(errorText(e, '서류 기록을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  return (
    <div className={own.formBox}>
      <VStack gap={3}>
        <Text type="label">{doc ? `${elderName} 어르신 서류 고치기` : `${elderName} 어르신 서류 기록 추가`}</Text>
        <SupportText tone="warn">제목·보관 위치에 개인정보(주민등록번호·연락처·주소 등)를 적지 마세요. 이 칸은 암호화되지 않습니다.</SupportText>
        <div className={styles.fieldGridWide}>
          <Selector
            label="서류 종류"
            placeholder="종류 고르기"
            options={ELDER_DOC_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            value={draft.docType}
            onChange={(v) => v && set('docType', v as ElderDocType)}
          />
          <TextInput label="제목" placeholder="예: 급여계약서 2026년 갱신분" value={draft.title} onChange={(v) => set('title', v.slice(0, DOC_LIMITS.title))} />
        </div>
        <div className={styles.fieldGridWide}>
          <LabDateInput label="발급일 (선택)" value={draft.issuedOn} onChange={(v) => set('issuedOn', v)} />
          <LabDateInput label="만료일 (선택)" value={draft.expiresOn} onChange={(v) => set('expiresOn', v)} />
        </div>
        <div className={styles.fieldGridWide}>
          <TextInput label="보관 위치 (선택)" placeholder="예: 사무실 서류함 2번 칸" value={draft.location} onChange={(v) => set('location', v.slice(0, DOC_LIMITS.location))} />
          <LabDateInput label="확인일 (선택)" value={draft.checkedOn} onChange={(v) => set('checkedOn', v)} />
        </div>
        <TextArea label="메모 (선택)" placeholder="예: 갱신 시기에 보호자에게 안내" value={draft.note} onChange={(v) => set('note', v.slice(0, DOC_LIMITS.note))} rows={2} maxLength={DOC_LIMITS.note} />
        <HStack gap={2}>
          {draft.expiresOn !== '' && <Button label="만료일 비우기" variant="ghost" onClick={() => set('expiresOn', '')} />}
          {draft.issuedOn !== '' && <Button label="발급일 비우기" variant="ghost" onClick={() => set('issuedOn', '')} />}
          {draft.checkedOn !== '' && <Button label="확인일 비우기" variant="ghost" onClick={() => set('checkedOn', '')} />}
        </HStack>
        {submitted && problems.length > 0 && (
          <div className={styles.errorText}>
            <ul style={{ margin: 0, paddingInlineStart: 'var(--spacing-4)' }}>
              {problems.map((p) => (
                <li key={p}>
                  <Text type="supporting" color="inherit">
                    {p}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <ErrorBanner message={error} />}
        <HStack gap={2} hAlign="end" wrap="wrap">
          <Button label="취소" variant="ghost" isDisabled={saving} onClick={onClose} />
          <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
        </HStack>
      </VStack>
    </div>
  );
}
