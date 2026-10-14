'use client';

/**
 * 보호자 월간 안내 한 통 — 어르신 한 명 · 한 달.
 * 순서: 사실 모으기(화면에 먼저 보여 줌) → AI 초안(말투 고르기, 제안일 뿐) → 이름 채운 본문 고치기 → 문자 길이 → 복사·인쇄 → 저장 → 보냄 표시.
 * 보낸 안내는 읽기만 되고, 보냄 표시를 풀어야 고칠 수 있다. AI에는 이름이 없는 사실 묶음만 간다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Loading } from '@/components/Loading';
import { aiDraftGuardianNotice, deleteGuardianNotice, saveGuardianNotice } from '@/lib/lab/labApi';
import type { GuardianNotice } from '@/lib/lab/labTypes';
import { buildNoticeFacts, fillName, numbersNotInFacts, smsBytes, smsKind } from '@/lib/lab/guardianNotice';
import { AiChip, Chip, ErrorBanner, LabConfirm, NumField, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, defaultPersonName, errorText, monthLabel, writeStored } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { NOTICE_BODY_MAX, NOTICE_FACTS_MAX, NOTICE_TITLE_MAX, parseFacts, validateNotice } from './GuardianNoticeDraft';
import GuardianNoticeFactsView from './GuardianNoticeFactsView';
import GuardianNoticeSend from './GuardianNoticeSend';
import GuardianNoticeSheet from './GuardianNoticeSheet';
import { useNoticeSources } from './GuardianNoticeSources';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  elder: LabElder;
  month: string;
  notice: GuardianNotice | null;
  /** 출결에서 센 그 달 출석일. 출결을 못 읽었으면 null — 직접 적게 한다 */
  countedDays: number | null;
  onChanged: (notice: GuardianNotice) => void;
  onDeleted: () => void;
  onBack: () => void;
}

const KIND_TEXT = { SMS: '단문(SMS)', LMS: '장문(LMS)', TOO_LONG: '너무 깁니다' } as const;

export default function GuardianNoticeEditor({ elder, month, notice: initial, countedDays, onChanged, onDeleted, onBack }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [notice, setNotice] = useState<GuardianNotice | null>(initial);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [baseline, setBaseline] = useState({ title: initial?.title ?? '', body: initial?.body ?? '' });
  const [aiUsed, setAiUsed] = useState(initial?.aiAssisted ?? false);
  const [tone, setTone] = useState<'WARM' | 'BRIEF'>('WARM');
  const [writer, setWriter] = useState(() => initial?.writerName || defaultPersonName());
  const [days, setDays] = useState<number | null>(countedDays);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<{ title: string; body: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isSent = notice?.status === 'SENT';
  const { sources, loading, error, reload } = useNoticeSources(elder.id, month, !isSent);

  const facts = useMemo(() => {
    if (!sources || days === null) return null;
    return buildNoticeFacts({ elderlyId: elder.id, month, attendanceDays: days, ...sources });
  }, [sources, days, elder.id, month]);
  const shownFacts = facts ?? (isSent ? parseFacts(notice?.facts ?? null) : null);

  const dirty = !isSent && (title !== baseline.title || body !== baseline.body);
  const bytes = smsBytes(fillName(body, elder.name));
  const kind = smsKind(fillName(body, elder.name));
  const strayNumbers = useMemo(() => (aiUsed && body.trim() !== '' && facts ? numbersNotInFacts(fillName(body, elder.name), facts) : []), [aiUsed, body, facts, elder.name]);

  const applyDraft = (d: { title: string; body: string }) => {
    setTitle(d.title.slice(0, NOTICE_TITLE_MAX));
    setBody(fillName(d.body, elder.name).slice(0, NOTICE_BODY_MAX));
    setAiUsed(true);
    setPendingDraft(null);
  };

  const runDraft = async () => {
    if (!facts || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await aiDraftGuardianNotice({ month, facts, tone });
      if (!alive.current) return;
      // 직접 쓴 글이 있으면 덮어쓰기 전에 확인한다
      if (body.trim() !== '') setPendingDraft({ title: r.title, body: r.body });
      else applyDraft({ title: r.title, body: r.body });
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 초안을 만들지 못했습니다. 잠시 뒤 다시 눌러 주세요'));
    } finally {
      if (alive.current) setAiLoading(false);
    }
  };

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(fillName(body, elder.name));
      notify('안내 본문을 복사했습니다', 'success');
    } catch {
      notify('복사하지 못했습니다. 글을 직접 선택해 복사해 주세요', 'error');
    }
  };

  const save = async () => {
    if (saving || isSent) return;
    const problem = validateNotice(title, body, writer);
    if (problem) {
      setSaveError(problem);
      return;
    }
    const factsJson = facts ? JSON.stringify(facts) : notice?.facts ?? null;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveGuardianNotice({
        elderlyId: elder.id,
        noticeMonth: month,
        title: title.trim(),
        body: fillName(body, elder.name).trim(),
        facts: factsJson !== null && factsJson.length <= NOTICE_FACTS_MAX ? factsJson : null,
        sentOn: null,
        method: null,
        recipient: null,
        writerName: writer.trim(),
        aiAssisted: aiUsed,
      });
      writeStored(PROVIDER_KEY, writer.trim());
      onChanged(saved);
      if (!alive.current) return;
      setNotice(saved);
      setTitle(saved.title);
      setBody(saved.body);
      setBaseline({ title: saved.title, body: saved.body });
      notify('안내를 저장했습니다', 'success');
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '보호자 안내를 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!notice || deleting) return;
    setDeleting(true);
    try {
      await deleteGuardianNotice(notice.id);
      notify('안내를 삭제했습니다', 'success');
      onDeleted();
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setSaveError(errorText(e, '보호자 안내를 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              {elder.name}
            </Text>
            <Text type="supporting" color="secondary">
              {monthLabel(month)} 보호자 안내
            </Text>
          </VStack>
          <HStack gap={2} vAlign="center" wrap="wrap">
            {notice ? <Chip tone={isSent ? 'ok' : 'warn'} label={isSent ? '보냄' : '초안'} /> : <Chip tone="neutral" label="아직 없음" />}
            {dirty && <Chip tone="warn" label="저장 전" />}
            <span className={styles.onlyNarrow}>
              <Button label="목록으로" variant="ghost" onClick={onBack} />
            </span>
          </HStack>
        </HStack>

        {!isSent && (
          <VStack gap={2}>
            <Text type="label">1. 이 달의 사실</Text>
            {loading && <Loading size="inline" label="이 달의 기록을 모으는 중..." />}
            {error && <ErrorBanner message={error} onRetry={() => void reload()} />}
            <div style={{ maxWidth: 220 }}>
              <NumField
                label="출석일 (일)"
                value={days}
                onChange={setDays}
                max={31}
                grouped={false}
                description={countedDays === null ? '출결을 불러오지 못했습니다. 직접 적어 주세요.' : '출결에서 센 값입니다. 다르면 고쳐 주세요.'}
              />
            </div>
          </VStack>
        )}
        {shownFacts ? (
          <div className={styles.suggestBox}>
            <VStack gap={2}>
              <Text type="supporting" color="secondary">
                {isSent ? '보낼 때 모은 사실입니다.' : 'AI 초안은 아래 사실만 근거로 씁니다. 틀린 것이 있으면 원본 기록을 고친 뒤 다시 모아 주세요.'}
              </Text>
              <GuardianNoticeFactsView facts={shownFacts} />
              {!isSent && (
                <div>
                  <Button label="사실 다시 모으기" size="sm" variant="ghost" isDisabled={loading} onClick={() => void reload()} />
                </div>
              )}
            </VStack>
          </div>
        ) : (
          !isSent && !loading && !error && days === null && <SupportText>출석일을 적으면 사실 요약이 만들어집니다.</SupportText>
        )}

        {!isSent && (
          <VStack gap={2}>
            <Text type="label">2. AI 초안</Text>
            <HStack gap={3} vAlign="center" wrap="wrap">
              <SegmentedControl label="말투" value={tone} onChange={(v) => v && setTone(v as 'WARM' | 'BRIEF')}>
                <SegmentedControlItem value="WARM" label="따뜻하게" />
                <SegmentedControlItem value="BRIEF" label="짧게" />
              </SegmentedControl>
              <Button label="AI 초안 만들기" variant="secondary" isLoading={aiLoading} isDisabled={!facts || aiLoading} onClick={() => void runDraft()} />
            </HStack>
            <SupportText>사실 요약만 AI로 보냅니다(이름 없음). 초안은 제안일 뿐이니 읽고 고친 뒤 저장해 주세요. 진단·치료 판단은 쓰지 않습니다.</SupportText>
            {aiError && <ErrorBanner message={aiError} />}
          </VStack>
        )}

        <VStack gap={2}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="label">{isSent ? '보낸 안내' : '3. 안내 글'}</Text>
            {aiUsed && !isSent && <AiChip />}
          </HStack>
          {isSent ? (
            <>
              <Text type="body" weight="medium">
                {notice?.title}
              </Text>
              <div className={styles.messageBox}>{notice?.body}</div>
            </>
          ) : (
            <>
              <TextInput label="제목" value={title} onChange={(v) => setTitle(v.slice(0, NOTICE_TITLE_MAX))} placeholder={`${monthLabel(month)} 어르신 소식`} />
              <TextArea label="본문" value={body} onChange={(v) => setBody(v.slice(0, NOTICE_BODY_MAX))} rows={12} maxLength={NOTICE_BODY_MAX} placeholder="AI 초안을 만들거나 직접 써 주세요. 어르신 이름은 자동으로 채워집니다." />
              <TextInput label="작성자" value={writer} onChange={(v) => setWriter(v.slice(0, 50))} />
            </>
          )}
          {strayNumbers.length > 0 && (
            <SupportText tone="warn">사실 요약에 없는 숫자({strayNumbers.join(', ')})가 본문에 있습니다. AI가 지어냈을 수 있으니 확인하고 고쳐 주세요.</SupportText>
          )}
          {body.trim() !== '' || isSent ? (
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Chip tone={kind === 'TOO_LONG' ? 'danger' : kind === 'LMS' ? 'info' : 'ok'} label={KIND_TEXT[kind]} />
              <Text type="supporting" color="secondary" hasTabularNumbers>
                문자로 보내면 약 {smsBytes(fillName(isSent ? notice?.body ?? '' : body, elder.name)).toLocaleString('ko-KR')}바이트 (단문 90바이트, 장문 2,000바이트까지)
              </Text>
            </HStack>
          ) : null}
          {kind === 'TOO_LONG' && bytes > 0 && <SupportText tone="error">문자 한 통에 보내기엔 너무 깁니다. 본문을 줄여 주세요.</SupportText>}
        </VStack>

        {saveError && <ErrorBanner message={saveError} />}

        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <HStack gap={1} wrap="wrap">
              <Button label="본문 복사" variant="ghost" isDisabled={(isSent ? notice?.body ?? '' : body).trim() === ''} onClick={() => void copyBody()} />
              <Button label="안내 인쇄" variant="ghost" isDisabled={(isSent ? notice?.body ?? '' : body).trim() === ''} onClick={() => window.print()} />
              {notice && !isSent && <Button label="안내 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}
            </HStack>
            {!isSent && <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving || (!dirty && !!notice)} onClick={() => void save()} />}
          </HStack>
        </div>

        {notice && (
          <GuardianNoticeSend
            key={notice.status}
            notice={notice}
            dirty={dirty}
            onChanged={(n) => {
              setNotice(n);
              setTitle(n.title);
              setBody(n.body);
              setBaseline({ title: n.title, body: n.body });
              onChanged(n);
            }}
          />
        )}
      </VStack>

      <GuardianNoticeSheet title={isSent ? notice?.title ?? '' : title} body={fillName(isSent ? notice?.body ?? '' : body, elder.name)} elderName={elder.name} month={month} writer={isSent ? notice?.writerName ?? '' : writer} />

      <LabConfirm
        isOpen={pendingDraft !== null}
        title="지금 쓴 글을 AI 초안으로 바꿀까요?"
        description="제목과 본문이 AI 초안으로 바뀌고, 지금 쓴 글은 사라집니다."
        actionLabel="초안으로 바꾸기"
        onConfirm={() => pendingDraft && applyDraft(pendingDraft)}
        onClose={() => setPendingDraft(null)}
      />
      <LabConfirm
        isOpen={confirmDelete}
        title="이 안내를 삭제할까요?"
        description={`${elder.name} 어르신의 ${monthLabel(month)} 안내 초안이 지워지며 되돌릴 수 없습니다.`}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </Card>
  );
}
