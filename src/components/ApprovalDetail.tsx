'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiCheck, FiXCircle, FiDownload, FiEye } from 'react-icons/fi';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Banner } from '@astryxdesign/core/Banner';
import { TextArea } from '@astryxdesign/core/TextArea';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { ApprovalRequest, ApprovalStatus } from '@/types/approval';
import { FormSchema } from '@/types/formSchema';
import FormDataViewer from './approval/FormDataViewer';
import DocumentViewerModal from './DocumentViewerModal';

interface ApprovalDetailProps {
  approval: ApprovalRequest;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  templateSchema?: FormSchema;
}

export default function ApprovalDetail({
  approval,
  onApprove,
  onReject,
  onDelete,
  onClose,
  templateSchema,
}: ApprovalDetailProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showAttachmentViewer, setShowAttachmentViewer] = useState(false);

  const getStatusVariant = (status: ApprovalStatus): 'success' | 'warning' | 'error' | 'neutral' => {
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
      // S3 URL인 경우 상대 경로로 변환
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

  const infoBoxStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
  const attachmentButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 12,
  };

  const isPendingActions = approval.status === 'PENDING' && !showRejectForm;
  const isDefaultActions = !isPendingActions && !showRejectForm;

  const footerContent = (isPendingActions || isDefaultActions) ? (
    <LayoutFooter hasDivider>
      {isPendingActions ? (
        <HStack gap={2} hAlign="end">
          <Button
            label="반려"
            variant="ghost"
            icon={<Icon icon={FiXCircle} size="sm" />}
            onClick={() => setShowRejectForm(true)}
          />
          <Button
            label="승인"
            variant="primary"
            icon={<Icon icon={FiCheck} size="sm" />}
            onClick={() => onApprove(approval.id)}
          />
        </HStack>
      ) : (
        <HStack gap={2} hAlign="between">
          {onDelete ? (
            <Button label="삭제" variant="ghost" onClick={() => onDelete(approval.id)} />
          ) : (
            <span />
          )}
          <Button label="닫기" variant="primary" onClick={onClose} />
        </HStack>
      )}
    </LayoutFooter>
  ) : null;

  return (
    <>
      <Dialog
        isOpen
        onOpenChange={(open) => { if (!open) onClose(); }}
        purpose="form"
        width={512}
        maxHeight="90vh"
      >
        <Layout
          header={<DialogHeader title={approval.title} onOpenChange={(open) => { if (!open) onClose(); }} />}
          content={
            <LayoutContent>
              <VStack gap={5}>
                {/* 상태 및 템플릿 */}
                <HStack gap={2} vAlign="center">
                  <Badge variant={getStatusVariant(approval.status)} label={getStatusText(approval.status)} />
                  <Text type="supporting">{approval.templateName}</Text>
                </HStack>

                {/* 기안 정보 */}
                <div style={infoBoxStyle}>
                  <Card variant="muted" padding={3}>
                    <VStack gap={1}>
                      <Text type="supporting">기안자</Text>
                      <Text type="body" weight="semibold">{approval.requesterName}</Text>
                    </VStack>
                  </Card>
                  <Card variant="muted" padding={3}>
                    <VStack gap={1}>
                      <Text type="supporting">기안일시</Text>
                      <Text type="body" weight="semibold">
                        {format(new Date(approval.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                      </Text>
                    </VStack>
                  </Card>
                  {approval.processedAt && (
                    <>
                      <Card variant="muted" padding={3}>
                        <VStack gap={1}>
                          <Text type="supporting">처리자</Text>
                          <Text type="body" weight="semibold">{approval.processedByName || '-'}</Text>
                        </VStack>
                      </Card>
                      <Card variant="muted" padding={3}>
                        <VStack gap={1}>
                          <Text type="supporting">처리일시</Text>
                          <Text type="body" weight="semibold">
                            {format(new Date(approval.processedAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                          </Text>
                        </VStack>
                      </Card>
                    </>
                  )}
                </div>

                {/* 기안 내용 */}
                {approval.formData && Object.keys(approval.formData).length > 0 && (
                  <VStack gap={3}>
                    <Text type="label" weight="semibold">기안 내용</Text>
                    <FormDataViewer
                      formData={approval.formData}
                      schema={templateSchema}
                    />
                  </VStack>
                )}

                {/* 첨부파일 - 단일 필드 (백엔드 구조에 맞춤) */}
                {approval.attachmentUrl && (
                  <VStack gap={2}>
                    <Text type="label" weight="semibold">첨부파일</Text>
                    <Card padding={0}>
                      <HStack gap={0} vAlign="stretch">
                        <button
                          onClick={() => setShowAttachmentViewer(true)}
                          style={{ ...attachmentButtonStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', minWidth: 0 }}
                        >
                          <Icon icon={FiEye} color="accent" size="md" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text type="body" weight="medium" maxLines={1}>{approval.attachmentFileName || '첨부파일'}</Text>
                          </div>
                          <Text type="supporting">
                            {((approval.attachmentFileSize || 0) / 1024).toFixed(1)}KB
                          </Text>
                        </button>
                        <button
                          onClick={() => handleDownloadAttachment(approval.attachmentUrl!, approval.attachmentFileName || '첨부파일')}
                          aria-label="첨부파일 다운로드"
                          style={{ ...attachmentButtonStyle, borderLeft: '1px solid var(--color-border, #e5e7eb)' }}
                        >
                          <Icon icon={FiDownload} color="secondary" size="md" />
                        </button>
                      </HStack>
                    </Card>
                    <Text type="supporting">파일명을 클릭하면 다운로드 없이 바로 볼 수 있습니다</Text>
                  </VStack>
                )}

                {/* 반려 사유 */}
                {approval.status === 'REJECTED' && approval.rejectReason && (
                  <Banner
                    status="error"
                    title="반려 사유"
                    description={<span style={{ whiteSpace: 'pre-wrap' }}>{approval.rejectReason}</span>}
                  />
                )}

                {/* 반려 사유 입력 폼 */}
                {showRejectForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <Card variant="red" padding={4}>
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
                            isDisabled={!rejectReason.trim()}
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
          footer={footerContent}
        />
      </Dialog>

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
