'use client';

/** 보냄 표시 — 보낸 날·방법·받는 분을 남긴다. 보낸 안내는 풀어야 고칠 수 있다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { markGuardianNoticeSent, markGuardianNoticeUnsent } from '@/lib/lab/labApi';
import type { GuardianNotice, GuardianNoticeMethod } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText, todayString } from '@/components/lab/labFormat';
import { NOTICE_METHODS, noticeMethodLabel } from './GuardianNoticeDraft';
import { useAlive } from './recordsFormat';

interface Props {
  notice: GuardianNotice;
  /** 저장하지 않은 수정이 있으면 먼저 저장해야 보냄 표시를 할 수 있다 */
  dirty: boolean;
  onChanged: (notice: GuardianNotice) => void;
}

export default function GuardianNoticeSend({ notice, dirty, onChanged }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [sentOn, setSentOn] = useState(todayString);
  const [method, setMethod] = useState<GuardianNoticeMethod>('SMS');
  const [recipient, setRecipient] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmUnsent, setConfirmUnsent] = useState(false);

  const markSent = async () => {
    if (busy) return;
    if (sentOn === '' || sentOn > todayString()) {
      setError('보낸 날을 오늘 이전으로 골라 주세요');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await markGuardianNoticeSent(notice.id, { sentOn, method, recipient: recipient.trim() === '' ? null : recipient.trim() });
      notify('보냄으로 표시했습니다', 'success');
      onChanged(updated);
    } catch (e) {
      if (alive.current) setError(errorText(e, '보냄으로 표시하지 못했습니다'));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const markUnsent = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await markGuardianNoticeUnsent(notice.id);
      notify('보냄 표시를 풀었습니다. 이제 고칠 수 있습니다', 'success');
      onChanged(updated);
    } catch (e) {
      if (alive.current) setError(errorText(e, '보냄 표시를 풀지 못했습니다'));
    } finally {
      if (alive.current) {
        setBusy(false);
        setConfirmUnsent(false);
      }
    }
  };

  if (notice.status === 'SENT') {
    return (
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Chip tone="ok" label="보냄" />
          <Text type="supporting">
            {notice.sentOn ? dotDate(notice.sentOn) : ''} {noticeMethodLabel(notice.method)}
            {notice.recipient ? ` · 받는 분 ${notice.recipient}` : ''}
          </Text>
        </HStack>
        <SupportText>보낸 안내는 고칠 수 없습니다. 고치려면 먼저 보냄 표시를 풀어 주세요.</SupportText>
        {error && <ErrorBanner message={error} />}
        <div>
          <Button label="보냄 표시 풀기" variant="secondary" isDisabled={busy} onClick={() => setConfirmUnsent(true)} />
        </div>
        <LabConfirm
          isOpen={confirmUnsent}
          title="보냄 표시를 풀까요?"
          description="풀면 초안으로 돌아가 본문을 고칠 수 있습니다. 보낸 날·방법·받는 분 기록은 지워집니다."
          actionLabel="보냄 표시 풀기"
          isLoading={busy}
          onConfirm={() => void markUnsent()}
          onClose={() => setConfirmUnsent(false)}
        />
      </VStack>
    );
  }

  return (
    <VStack gap={2}>
      <Text type="label">보냄 표시</Text>
      <SupportText>문자·카카오톡·인쇄 등으로 실제로 보낸 뒤 눌러 주세요. 제공 대장(일자·방법·받는 분)으로 평가 때 확인할 수 있습니다.</SupportText>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--spacing-3)', alignItems: 'start' }}>
        <LabDateInput label="보낸 날" value={sentOn} onChange={setSentOn} max={todayString()} />
        <Selector label="방법" options={NOTICE_METHODS.map((m) => ({ value: m.value, label: m.label }))} value={method} onChange={(v) => v && setMethod(v as GuardianNoticeMethod)} />
        <TextInput label="받는 분 (선택)" value={recipient} onChange={(v) => setRecipient(v.slice(0, 50))} placeholder="예: 큰아드님" />
      </div>
      {error && <ErrorBanner message={error} />}
      <div>
        <Button label="보냄으로 표시" variant="primary" isLoading={busy} isDisabled={busy || dirty} onClick={() => void markSent()} />
        {dirty && (
          <div>
            <SupportText tone="warn">고친 내용을 먼저 저장해야 보냄으로 표시할 수 있습니다.</SupportText>
          </div>
        )}
      </div>
    </VStack>
  );
}
