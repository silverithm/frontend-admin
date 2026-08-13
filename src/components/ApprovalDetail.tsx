'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ApprovalRequest, ApprovalStatus } from '@/types/approval';
import { FormSchema } from '@/types/formSchema';
import { FiCheck, FiXCircle, FiDownload, FiVolume2 } from 'react-icons/fi';
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
import { isAdminSession } from '@/lib/chatIdentity';
import OfficialDocument from './approval/OfficialDocument';
import SignatureConfirmDialog from './approval/SignatureConfirmDialog';
import ApprovalAnnounceDialog from './approval/ApprovalAnnounceDialog';
import DocumentViewerModal from './DocumentViewerModal';
import { useConfirm } from './ConfirmDialog';

interface ApprovalDetailProps {
  approval: ApprovalRequest;
  onApprove: (id: string, options?: { signatureBase64?: string; force?: boolean }) => void;
  onReject: (id: string, reason: string, options?: { force?: boolean }) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  templateSchema?: FormSchema;
  templateType?: string;
  isProcessing?: boolean;
}

export default function ApprovalDetail({
  approval,
  onApprove,
  onReject,
  onDelete,
  onClose,
  templateSchema,
  templateType,
  isProcessing = false,
}: ApprovalDetailProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showAttachmentViewer, setShowAttachmentViewer] = useState(false);
  const [showSignatureConfirm, setShowSignatureConfirm] = useState(false);
  /** 승인된 공문을 채팅방 공지로 올리는 창 */
  const [showAnnounceDialog, setShowAnnounceDialog] = useState(false);
  const [announceResult, setAnnounceResult] = useState('');
  /** 관리자 여부는 localStorage를 보므로 마운트 후에 정한다 (SSR 불일치 방지) */
  const [isAdmin, setIsAdmin] = useState(false);
  const [myApproverId, setMyApproverId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const { confirm, ConfirmContainer } = useConfirm();

  useEffect(() => {
    setIsAdmin(isAdminSession());
    setMyApproverId(getApprovalRequesterId());
    setCompanyName(
      localStorage.getItem('companyName') || localStorage.getItem('organizationName') || ''
    );
  }, []);

  // HWP 파일 양식으로 작성된 문서는 공문 프레임이 아니라 작성된 문서 파일 자체가 본문이다.
  // 템플릿이 삭제돼 타입을 알 수 없으면 "폼 데이터 없음 + 첨부 존재"를 같은 신호로 본다.
  const isFileDocument =
    templateType === 'file' ||
    (!templateSchema
      && (!approval.formData || Object.keys(approval.formData).length === 0)
      && !!approval.attachmentUrl);

  // HWP 양식 문서는 작성된 문서가 본문이므로 상세를 열자마자 뷰어를 바로 띄운다.
  // templateType은 상세 오픈 후 비동기로 도착하므로 값이 확정되는 시점에 1회만 연다.
  const autoOpenedViewerRef = useRef(false);
  useEffect(() => {
    if (isFileDocument && approval.attachmentUrl && !autoOpenedViewerRef.current) {
      autoOpenedViewerRef.current = true;
      setShowAttachmentViewer(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFileDocument, approval.attachmentUrl]);

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
  // 관리자 직권 처리(전결): 이 화면은 기관 관리자 전용이므로 내 차례가 아니어도 강제 처리 가능 (백엔드가 관리자 여부 재검증)
  const isForceMode = approval.status === 'PENDING' && hasLine && !isMyTurn;

  // 직권 승인 전 경고 — 건너뛰게 될 남은 결재 단계를 알려주고 확인받는다
  const confirmForceApprove = () => {
    const remaining = (approval.approvalLine || [])
      .filter((step) => step.status === 'PENDING' && step.approverId !== myApproverId)
      .map((step) => `${step.roleLabel === 'FINAL' ? '결재' : '검토'} ${step.approverName}`);
    return confirm({
      title: '직권 승인 (전결)',
      message: `아직 처리되지 않은 결재 단계가 남아 있습니다.\n남은 단계: ${remaining.join(' → ')}\n\n남은 단계를 건너뛰고 즉시 최종 승인합니다. 계속하시겠습니까?`,
      confirmText: '직권 승인',
      type: 'warning',
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    onReject(approval.id, rejectReason, isForceMode ? { force: true } : undefined);
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
                {announceResult && (
                  <Banner status="success" container="section" title={announceResult} />
                )}
                {/* 결재 차례 안내 */}
                {approval.status === 'PENDING' && hasLine && !isMyTurn && currentStep && (
                  <Banner
                    status="info"
                    title={`현재 ${currentStep.approverName}님의 결재 차례입니다.`}
                    description="관리자는 직권 승인(전결)으로 남은 검토 단계를 건너뛰고 즉시 처리할 수 있습니다."
                  />
                )}

                {/* 본문 — HWP 양식 문서는 작성된 파일이 본문이므로 공문 프레임 대신 문서 뷰어로 안내 */}
                {isFileDocument ? (
                  <Card variant="muted" padding={5}>
                    <VStack gap={3} hAlign="center">
                      <Text weight="semibold">HWP 양식으로 작성된 문서입니다</Text>
                      <Text type="supporting" color="secondary" justify="center">
                        {approval.templateName} · {approval.requesterName} 작성
                      </Text>
                      {approval.attachmentUrl ? (
                        <Button
                          label="문서 열어보기"
                          variant="primary"
                          onClick={() => setShowAttachmentViewer(true)}
                        />
                      ) : (
                        <Text type="supporting" color="secondary">
                          작성된 문서 파일을 찾을 수 없습니다.
                        </Text>
                      )}
                    </VStack>
                  </Card>
                ) : (
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
                )}

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
                    label={isForceMode ? '직권 반려' : '반려'}
                    variant="secondary"
                    icon={<Icon icon={FiXCircle} size="sm" />}
                    isDisabled={(!canAct && !isForceMode) || isProcessing}
                    onClick={() => setShowRejectForm(true)}
                  />
                  <Button
                    label={isForceMode ? '직권 승인 (전결)' : '승인'}
                    variant="primary"
                    icon={<Icon icon={FiCheck} size="sm" />}
                    isDisabled={(!canAct && !isForceMode) || isProcessing}
                    onClick={async () => {
                      if (isForceMode && !(await confirmForceApprove())) return;
                      setShowSignatureConfirm(true);
                    }}
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
                    <HStack gap={2}>
                      {/*
                        최종 승인된 공문만, 관리자에게만 보인다.
                        - 반려·진행중 문서가 방 공지로 붙으면 곤란하고
                        - 이 화면은 직원 탭에서도 쓰이는데 방 공지를 바꾸는 건 관리자 몫이다
                      */}
                      {approval.status === 'APPROVED' && isAdmin && (
                        <Button
                          label="채팅방에 공지 등록"
                          variant="secondary"
                          icon={<Icon icon={FiVolume2} size="sm" />}
                          onClick={() => setShowAnnounceDialog(true)}
                        />
                      )}
                      <Button
                        label="닫기"
                        variant="primary"
                        onClick={onClose}
                      />
                    </HStack>
                  </HStack>
                )
              )}
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 승인된 공문 → 채팅방 공지 */}
      {showAnnounceDialog && (
        <ApprovalAnnounceDialog
          approval={approval}
          onClose={() => setShowAnnounceDialog(false)}
          onDone={(roomNames) => {
            setAnnounceResult(`${roomNames.join(', ')}에 공지로 등록했습니다`);
            setTimeout(() => setAnnounceResult(''), 4000);
          }}
        />
      )}

      {/* 승인 서명 확인 */}
      <SignatureConfirmDialog
        isOpen={showSignatureConfirm}
        isProcessing={isProcessing}
        onClose={() => setShowSignatureConfirm(false)}
        onConfirm={(signatureBase64) => {
          setShowSignatureConfirm(false);
          onApprove(approval.id, {
            ...(signatureBase64 ? { signatureBase64 } : {}),
            ...(isForceMode ? { force: true } : {}),
          });
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

      {/* 직권 승인 경고 */}
      <ConfirmContainer />
    </>
  );
}
