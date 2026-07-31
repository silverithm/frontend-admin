'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ApprovalRequest, ApprovalStatus } from '@/types/approval';
import { FormSchema } from '@/types/formSchema';
import { FiCheck, FiXCircle, FiDownload } from 'react-icons/fi';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Card } from '@astryxdesign/core/Card';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { TextArea } from '@astryxdesign/core/TextArea';
import { getApprovalRequesterId } from '@/lib/apiService';
import OfficialDocument from './approval/OfficialDocument';
import SignatureConfirmDialog from './approval/SignatureConfirmDialog';
import DocumentViewerModal from './DocumentViewerModal';

interface ApprovalDetailProps {
  approval: ApprovalRequest;
  onApprove: (id: string, options?: { signatureBase64?: string }) => void;
  onReject: (id: string, reason: string) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  templateSchema?: FormSchema;
  isProcessing?: boolean;
}

export default function ApprovalDetail({
  approval,
  onApprove,
  onReject,
  onDelete,
  onClose,
  templateSchema,
  isProcessing = false,
}: ApprovalDetailProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showAttachmentViewer, setShowAttachmentViewer] = useState(false);
  const [showSignatureConfirm, setShowSignatureConfirm] = useState(false);
  const [myApproverId, setMyApproverId] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    setMyApproverId(getApprovalRequesterId());
    setCompanyName(
      localStorage.getItem('companyName') || localStorage.getItem('organizationName') || ''
    );
  }, []);

  const getStatusVariant = (
    status: ApprovalStatus
  ): 'success' | 'warning' | 'error' | 'neutral' => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'REJECTED':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const getStatusText = (status: ApprovalStatus) => {
    switch (status) {
      case 'APPROVED': return '승인됨';
      case 'PENDING': return '진행중';
      case 'REJECTED': return '반려됨';
      default: return status;
    }
  };

  // 결재선 차례 판단: 결재선 없는 legacy 문서는 서버 인가에 맡기고 기존처럼 노출
  const hasLine = !!approval.approvalLine && approval.approvalLine.length > 0;
  const currentStep = hasLine
    ? approval.approvalLine!.find((step) => step.status === 'PENDING')
    : undefined;
  const isMyTurn = !hasLine || (currentStep ? currentStep.approverId === myApproverId : false);
  const canAct = approval.status === 'PENDING' && isMyTurn;

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    onReject(approval.id, rejectReason);
  };

  // S3 URL에서 상대 경로 추출 (carev/ 이후 부분)
  const extractRelativePath = (url: string): string => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      // https://bucket.s3.region.amazonaws.com/carev/attachments/file.pdf -> attachments/file.pdf
      const match = url.match(/\/carev\/(.+)$/);
      if (match) return match[1];
    }
    return url;
  };

  // 첨부파일 다운로드
  const handleDownloadAttachment = async (fileUrl: string, fileName: string) => {
    try {
      const relativePath = extractRelativePath(fileUrl);

      const downloadUrl = `/api/v1/files/download?path=${encodeURIComponent(relativePath)}&fileName=${encodeURIComponent(fileName)}`;
      const token = localStorage.getItem('authToken');

      const response = await fetch(downloadUrl, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error('파일 다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('파일 다운로드 실패:', error);
      alert('파일 다운로드에 실패했습니다.');
    }
  };

  return (
    <>
      <Dialog
        isOpen
        onOpenChange={(open) => { if (!open) onClose(); }}
        purpose="form"
        width={880}
        maxHeight="92vh"
      >
        <Layout
          header={
            <DialogHeader
              title={approval.title}
              subtitle={approval.templateName}
              onOpenChange={(open) => { if (!open) onClose(); }}
              endContent={
                <Badge
                  variant={getStatusVariant(approval.status)}
                  label={getStatusText(approval.status)}
                />
              }
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                {/* 결재 차례 안내 */}
                {approval.status === 'PENDING' && hasLine && !isMyTurn && currentStep && (
                  <Banner
                    status="info"
                    title={`현재 ${currentStep.approverName}님의 결재 차례입니다.`}
                    description="본인 차례가 되면 승인/반려 버튼이 활성화됩니다."
                  />
                )}

                {/* 공문 본문 */}
                <div
                  style={{
                    background: 'var(--color-background-muted)',
                    padding: 'var(--spacing-4)',
                    borderRadius: 'var(--radius-inner)',
                    overflowX: 'auto',
                  }}
                >
                  <OfficialDocument
                    approval={approval}
                    schema={templateSchema}
                    companyName={companyName}
                    onOpenAttachment={
                      approval.attachmentUrl ? () => setShowAttachmentViewer(true) : undefined
                    }
                  />
                </div>

                {/* 첨부 다운로드 보조 액션 */}
                {approval.attachmentUrl && (
                  <HStack gap={2} vAlign="center" hAlign="end">
                    <Text type="supporting" color="secondary">
                      {approval.attachmentFileName || '첨부파일'} ({((approval.attachmentFileSize || 0) / 1024).toFixed(1)}KB)
                    </Text>
                    <Button
                      label="첨부파일 다운로드"
                      isIconOnly
                      variant="ghost"
                      size="sm"
                      icon={<Icon icon={FiDownload} size="sm" />}
                      onClick={() => handleDownloadAttachment(approval.attachmentUrl!, approval.attachmentFileName || '첨부파일')}
                    />
                  </HStack>
                )}

                {/* 반려 사유 입력 폼 */}
                {showRejectForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Card variant="muted" padding={3}>
                      <VStack gap={3}>
                        <Text type="label" weight="semibold" color="accent">반려 사유 입력</Text>
                        <TextArea
                          label="반려 사유"
                          isLabelHidden
                          value={rejectReason}
                          onChange={(value) => setRejectReason(value)}
                          placeholder="반려 사유를 입력해주세요"
                          rows={3}
                        />
                        <HStack gap={2} hAlign="end">
                          <Button
                            label="취소"
                            variant="ghost"
                            onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                          />
                          <Button
                            label="반려 확정"
                            variant="destructive"
                            isDisabled={!rejectReason.trim() || isProcessing}
                            onClick={handleReject}
                          />
                        </HStack>
                      </VStack>
                    </Card>
                  </motion.div>
                )}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              {approval.status === 'PENDING' && !showRejectForm ? (
                <HStack gap={2} hAlign="end">
                  <Button
                    label="반려"
                    variant="secondary"
                    icon={<Icon icon={FiXCircle} size="sm" />}
                    isDisabled={!canAct || isProcessing}
                    onClick={() => setShowRejectForm(true)}
                  />
                  <Button
                    label="승인"
                    variant="primary"
                    icon={<Icon icon={FiCheck} size="sm" />}
                    isDisabled={!canAct || isProcessing}
                    onClick={() => setShowSignatureConfirm(true)}
                  />
                </HStack>
              ) : (
                !showRejectForm && (
                  <HStack gap={2} hAlign="between" vAlign="center">
                    {onDelete ? (
                      <Button
                        label="삭제"
                        variant="destructive"
                        onClick={() => onDelete(approval.id)}
                      />
                    ) : (
                      <span />
                    )}
                    <Button
                      label="닫기"
                      variant="primary"
                      onClick={onClose}
                    />
                  </HStack>
                )
              )}
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 승인 서명 확인 */}
      <SignatureConfirmDialog
        isOpen={showSignatureConfirm}
        isProcessing={isProcessing}
        onClose={() => setShowSignatureConfirm(false)}
        onConfirm={(signatureBase64) => {
          setShowSignatureConfirm(false);
          onApprove(approval.id, signatureBase64 ? { signatureBase64 } : undefined);
        }}
      />

      {/* 첨부파일 문서 뷰어 */}
      {showAttachmentViewer && approval.attachmentUrl && (
        <DocumentViewerModal
          fileUrl={approval.attachmentUrl}
          fileName={approval.attachmentFileName || '첨부파일'}
          onClose={() => setShowAttachmentViewer(false)}
        />
      )}
    </>
  );
}
