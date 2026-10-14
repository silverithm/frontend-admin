'use client';

/** 한 번에 기록한 뒤 — 어르신별 반응을 따로 적는다. 어르신마다 저장하고, 건너뛰어도 된다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { updateRehabSession } from '@/lib/lab/labApi';
import type { RehabSession } from '@/lib/lab/labTypes';
import { rehabKindLabel } from '@/lib/lab/rehabRules';
import { Chip, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { REHAB_TEXT_MAX, inputWithReaction } from './RehabDraft';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface RowProps {
  session: RehabSession;
  aiReaction: string;
  onSaved: (s: RehabSession) => void;
}

function ReactionRow({ session, aiReaction, onSaved }: RowProps) {
  const notify = useNotify();
  const alive = useAlive();
  const [text, setText] = useState(session.reaction ?? '');
  const [savedText, setSavedText] = useState(session.reaction ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiMark, setAiMark] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateRehabSession(session.id, inputWithReaction(session, text));
      if (!alive.current) return;
      setSavedText(text.trim());
      onSaved(updated);
      notify(`${session.elderlyName} 어르신 반응을 저장했습니다`, 'success');
    } catch (e) {
      if (alive.current) setError(errorText(e, '반응을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const dirty = text.trim() !== savedText.trim();
  return (
    <div className={styles.rowBlock}>
      <VStack gap={2}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <Text type="body" weight="medium">
            {session.elderlyName}
          </Text>
          {savedText.trim() !== '' && !dirty && <Chip tone="ok" label="저장됨" />}
        </HStack>
        <TextArea
          label={`${session.elderlyName} 반응${aiMark ? ' (선택) · AI 제안' : ' (선택)'}`}
          isLabelHidden
          value={text}
          onChange={(v) => {
            setAiMark(false);
            setText(v.slice(0, REHAB_TEXT_MAX.reaction));
          }}
          rows={2}
          maxLength={REHAB_TEXT_MAX.reaction}
          placeholder="이 어르신의 반응 — 참여도, 표정, 불편 호소 등"
        />
        {error && <SupportText tone="error">{error}</SupportText>}
        <HStack gap={2} wrap="wrap">
          {aiReaction !== '' && text.trim() === '' && (
            <Button
              label="AI 제안 반응 넣기"
              variant="ghost"
              onClick={() => {
                setText(aiReaction.slice(0, REHAB_TEXT_MAX.reaction));
                setAiMark(true);
              }}
            />
          )}
          <Button label="저장" variant="secondary" isLoading={saving} isDisabled={saving || !dirty} onClick={() => void save()} />
        </HStack>
      </VStack>
    </div>
  );
}

interface Props {
  sessions: RehabSession[];
  aiReaction: string;
  onSessionSaved: (s: RehabSession) => void;
  onDone: () => void;
}

export default function RehabReactionPanel({ sessions, aiReaction, onSessionSaved, onDone }: Props) {
  const first = sessions[0];
  return (
    <Card padding={0}>
      <div className={styles.rowBlock}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              어르신별 반응 적기
            </Text>
            <Text type="supporting" color="secondary">
              {sessions.length}명을 기록했습니다{first ? ` · ${rehabKindLabel(first.kind)} ${first.minutes}분` : ''}. 반응은 어르신마다 따로 적어 저장하세요. 건너뛰어도 됩니다.
            </Text>
          </VStack>
          <Button label="완료" variant="primary" onClick={onDone} />
        </HStack>
      </div>
      {aiReaction !== '' && (
        <div className={styles.rowBlock}>
          <SupportText>AI가 메모에서 뽑은 반응: {aiReaction} — 해당하는 어르신에게만 “AI 제안 반응 넣기”를 누르세요.</SupportText>
        </div>
      )}
      {sessions.map((s) => (
        <ReactionRow key={s.id} session={s} aiReaction={aiReaction} onSaved={onSessionSaved} />
      ))}
    </Card>
  );
}
