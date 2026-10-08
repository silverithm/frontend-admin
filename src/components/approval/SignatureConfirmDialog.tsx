'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Banner } from '@astryxdesign/core/Banner';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Loading } from '@/components/Loading';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { APPROVAL_COMMENT_MAX_LENGTH, normalizeApprovalComment } from '@/lib/approvalComment';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { getMySignature } from '@/lib/apiService';
import SignatureCanvas, { SignatureCanvasHandle } from './SignatureCanvas';

type SignatureMode = 'registered' | 'draw';

interface SignatureConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  isProcessing?: boolean;
  onClose: () => void;
  /** 선택 의견 입력칸 표시 여부. 결재선 없는 옛 문서는 서버가 저장하지 않으므로 false */
  showComment?: boolean;
  /** 확정. 등록 서명 사용 시 signatureBase64는 undefined (서버가 자동 사용), 의견이 비면 comment도 undefined */
  onConfirm: (signatureBase64?: string, comment?: string) => void;
}

/**
 * 승인 시 서명 확인 다이얼로그.
 * 등록된 서명이 있으면 미리보기 후 그대로 날인, 없거나 원하면 즉석에서 그린다.
 */
export default function SignatureConfirmDialog({
  isOpen,
  title = '결재 승인',
  isProcessing = false,
  showComment = true,
  onClose,
  onConfirm,
}: SignatureConfirmDialogProps) {
  const canvasRef = useRef<SignatureCanvasHandle>(null);
  const [mode, setMode] = useState<SignatureMode>('registered');
  const [registeredUrl, setRegisteredUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canvasEmpty, setCanvasEmpty] = useState(true);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setComment('');
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const response = await getMySignature();
        if (cancelled) return;
        const url = response?.signatureUrl ?? null;
        setRegisteredUrl(url);
        setMode(url ? 'registered' : 'draw');
      } catch (error) {
        console.error('등록 서명 조회 실패:', error);
        if (!cancelled) {
          setRegisteredUrl(null);
          setMode('draw');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleConfirm = () => {
    const trimmedComment = showComment ? normalizeApprovalComment(comment) : undefined;
    if (mode === 'draw') {
      const dataUrl = canvasRef.current?.toDataURL();
      if (!dataUrl) return;
      onConfirm(dataUrl, trimmedComment);
      return;
    }
    // 등록 서명: 서버가 자동으로 사용하므로 base64 전송 불필요
    onConfirm(undefined, trimmedComment);
  };

  const confirmDisabled =
    isProcessing ||
    isLoading ||
    (mode === 'draw' && canvasEmpty) ||
    (mode === 'registered' && !registeredUrl);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      purpose="form"
      width={420}
    >
      <Layout
        header={<DialogHeader title={title} onOpenChange={(open) => { if (!open) onClose(); }} />}
        content={
          <LayoutContent>
            {isLoading ? (
              <Loading size="inline" label="서명을 불러오는 중..." />
            ) : (
              <VStack gap={3}>
                <Text type="supporting" color="secondary">
                  승인과 함께 결재란에 서명이 날인됩니다.
                </Text>

                {registeredUrl ? (
                  <SegmentedControl
                    value={mode}
                    onChange={(value) => setMode(value as SignatureMode)}
                    label="서명 방식"
                  >
                    <SegmentedControlItem value="registered" label="등록된 서명 사용" />
                    <SegmentedControlItem value="draw" label="직접 그리기" />
                  </SegmentedControl>
                ) : (
                  <Banner
                    status="info"
                    title="등록된 서명이 없습니다."
                    description="이번에는 직접 그려 승인하세요. 서명을 등록해두면 다음부터 바로 승인할 수 있습니다."
                  />
                )}

                {mode === 'registered' && registeredUrl ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 120,
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-inner)',
                      background: 'var(--color-on-accent)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={registeredUrl}
                      alt="등록된 서명"
                      style={{ maxWidth: '70%', maxHeight: '85%', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <SignatureCanvas ref={canvasRef} width={340} onChange={(isEmpty) => setCanvasEmpty(isEmpty)} />
                )}

                {showComment && (
                  <TextArea
                    label="의견"
                    isOptional
                    value={comment}
                    onChange={(value) => setComment(value)}
                    placeholder="결재 기록에 남길 의견이 있으면 적어주세요"
                    rows={3}
                    maxLength={APPROVAL_COMMENT_MAX_LENGTH}
                    isDisabled={isProcessing}
                  />
                )}
              </VStack>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="취소" variant="ghost" isDisabled={isProcessing} onClick={onClose} />
              <Button
                label={isProcessing ? '승인 중...' : '서명하고 승인'}
                variant="primary"
                isLoading={isProcessing}
                isDisabled={confirmDisabled}
                onClick={handleConfirm}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
