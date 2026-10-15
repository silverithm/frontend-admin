'use client';

/** 문서 편집 — 종류·제목·개정일·비치 장소·교육일·메모, 항목 체크리스트, AI 항목 점검. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import type { PolicyDocKind } from '@/lib/lab/labTypes';
import { MAX_LOCATION, MAX_NOTE, MAX_TITLE, policyBlockers } from './PolicyDocDraft';
import type { PolicyDraft } from './PolicyDocDraft';
import PolicyDocAi from './PolicyDocAi';
import PolicyDocChecklist from './PolicyDocChecklist';
import { GUIDE_NOS, KIND_OPTIONS, guideLabel, kindName } from './PolicyDocKinds';
import { PolicyKindNote } from './PolicyDocNotes';
import styles from './labPlans10.module.css';

interface Props {
  draft: PolicyDraft;
  onChange: (patch: (d: PolicyDraft) => PolicyDraft) => void;
  today: string;
  duplicate: boolean;
  dirty: boolean;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export default function PolicyDocEditor({ draft, onChange, today, duplicate, dirty, saving, deleting, error, onSave, onCancel, onDelete }: Props) {
  const editing = draft.id !== null;
  const busy = saving || deleting;
  const blockers = policyBlockers(draft, today, duplicate);
  const set = (p: Partial<PolicyDraft>) => onChange((d) => ({ ...d, ...p }));

  return (
    <VStack gap={4}>
      <Card padding={4}>
        <VStack gap={3}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="label">{editing ? `${kindName(draft.kind, draft.guideNo)} 고치기` : `${kindName(draft.kind, draft.guideNo)} 등록`}</Text>
            {dirty && <Chip tone="warn" label="저장하지 않은 변경" />}
          </HStack>

          <div className={styles.attendeeGrid}>
            <Selector
              label="종류"
              placeholder="종류 고르기"
              options={KIND_OPTIONS as unknown as Array<{ value: string; label: string }>}
              value={draft.kind}
              onChange={(v) => {
                if (!v) return;
                const kind = v as PolicyDocKind;
                const guideNo = kind === 'CARE_GUIDE' ? draft.guideNo ?? 1 : null;
                set({ kind, guideNo, title: draft.title.trim() === '' || draft.title === kindName(draft.kind, draft.guideNo) ? (kind === 'OTHER' ? '' : kindName(kind, guideNo)) : draft.title, checks: {}, ai: {} });
              }}
              isDisabled={busy || editing}
            />
            {draft.kind === 'CARE_GUIDE' && (
              <Selector
                label="급여제공지침 번호"
                placeholder="번호 고르기"
                options={GUIDE_NOS.map((n) => ({ value: String(n), label: guideLabel(n) }))}
                value={draft.guideNo === null ? undefined : String(draft.guideNo)}
                onChange={(v) => {
                  if (!v) return;
                  const guideNo = Number(v);
                  set({ guideNo, title: draft.title === kindName(draft.kind, draft.guideNo) ? kindName('CARE_GUIDE', guideNo) : draft.title, checks: {}, ai: {} });
                }}
                isDisabled={busy || editing}
              />
            )}
          </div>

          <TextInput label="문서 제목" placeholder="예: 햇살주야간보호센터 운영규정" value={draft.title} onChange={(v) => set({ title: v.slice(0, MAX_TITLE) })} isDisabled={busy} />
          <div className={styles.attendeeGrid}>
            <LabDateInput label="최근 개정일 (선택)" value={draft.revisedOn} max={today} onChange={(v) => set({ revisedOn: v })} />
            <LabDateInput label="직원 교육일 (선택)" value={draft.trainedOn} max={today} onChange={(v) => set({ trainedOn: v })} />
          </div>
          <TextInput label="비치 장소 (선택)" placeholder="예: 사무실 책장 2번 칸, 직원 휴게실 게시판" value={draft.location} onChange={(v) => set({ location: v.slice(0, MAX_LOCATION) })} isDisabled={busy} />
          <TextArea label="메모 (선택)" placeholder="예: 2027년 3월 수가 개정 때 함께 손볼 것" value={draft.note} onChange={(v) => set({ note: v.slice(0, MAX_NOTE) })} rows={2} maxLength={MAX_NOTE} isDisabled={busy} />

          <PolicyKindNote kind={draft.kind} guideNo={draft.guideNo} />

          <PolicyDocChecklist
            draft={draft}
            today={today}
            isDisabled={busy}
            onToggle={(key, on) =>
              onChange((d) => {
                const ai = { ...d.ai };
                delete ai[key];
                return { ...d, ai, checks: { ...d.checks, [key]: on } };
              })
            }
          />

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
            {editing && <Button label="이 문서 삭제" variant="ghost" isLoading={deleting} isDisabled={busy} onClick={onDelete} />}
            <Button label={editing ? '고치기 취소' : '비우기'} variant="ghost" isDisabled={busy} onClick={onCancel} />
            <Button label={editing ? '고친 내용 저장' : '문서 저장'} variant="primary" isLoading={saving} isDisabled={busy || blockers.length > 0 || (editing && !dirty)} onClick={onSave} />
          </HStack>
        </VStack>
      </Card>

      <PolicyDocAi
        key={`${draft.id ?? 'new'}-${draft.kind}-${draft.guideNo ?? 0}`}
        draft={draft}
        isDisabled={busy}
        onApply={(keys) =>
          onChange((d) => {
            const checks = { ...d.checks };
            const ai = { ...d.ai };
            for (const k of keys) {
              if (checks[k] !== true) {
                checks[k] = true;
                ai[k] = true;
              }
            }
            return { ...d, checks, ai };
          })
        }
      />
    </VStack>
  );
}
