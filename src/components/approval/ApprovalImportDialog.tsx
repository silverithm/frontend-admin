'use client';

import React, { useMemo, useRef, useState } from 'react';
import { FiFileText, FiUploadCloud } from 'react-icons/fi';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import ViewerSelector from '@/components/approval/ViewerSelector';
import { importApprovals, previewApprovalImport, uploadFileToServer } from '@/lib/apiService';
import {
  ApprovalImportPreview,
  ApprovalImportRow,
  ApprovalViewerEntry,
} from '@/types/approval';

interface ApprovalImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 등록이 끝나면 목록을 다시 읽게 한다 */
  onImported: () => void;
}

type Phase = 'select' | 'review' | 'done';

/** 한 번에 올리는 파일 수 — 수백 건을 동시에 던지면 브라우저와 서버가 함께 막힌다 */
const UPLOAD_BATCH = 4;

/**
 * 다른 시스템(이카운트 등)에서 결재가 끝난 문서를 옮겨 담는 화면.
 *
 * 색인(엑셀)을 먼저 읽어보고 무엇이 들어갈지 확인한 뒤 등록한다 —
 * 수백 건이 한 번에 들어가는 작업이라 되돌리기가 어렵기 때문이다.
 */
export default function ApprovalImportDialog({ isOpen, onClose, onImported }: ApprovalImportDialogProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [indexFile, setIndexFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [source, setSource] = useState('ECOUNT');
  const [viewers, setViewers] = useState<ApprovalViewerEntry[]>([]);
  const [preview, setPreview] = useState<ApprovalImportPreview | null>(null);
  const [result, setResult] = useState<ApprovalImportPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const indexInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const importableCount = useMemo(
    () => (preview ? preview.totalCount - preview.errorCount : 0),
    [preview],
  );

  const reset = () => {
    setPhase('select');
    setIndexFile(null);
    setDocumentFiles([]);
    setViewers([]);
    setPreview(null);
    setResult(null);
    setErrorMessage('');
    setProgress('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleReadIndex = async () => {
    if (!indexFile) return;

    setIsBusy(true);
    setErrorMessage('');
    try {
      const read = await previewApprovalImport(indexFile, documentFiles.map((file) => file.name));
      setPreview(read);
      setPhase('review');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '색인 파일을 읽지 못했습니다.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setIsBusy(true);
    setErrorMessage('');
    try {
      // 색인에 이름이 적힌 파일만 올린다 — 관계없는 파일까지 저장소에 쌓지 않는다
      const neededNames = new Set(preview.rows.flatMap((row) => row.fileNames));
      const targets = documentFiles.filter((file) => neededNames.has(file.name));

      const uploaded: Record<string, { filePath: string; fileSize?: number }> = {};
      for (let i = 0; i < targets.length; i += UPLOAD_BATCH) {
        const batch = targets.slice(i, i + UPLOAD_BATCH);
        setProgress(`문서 파일 올리는 중… (${Math.min(i + batch.length, targets.length)}/${targets.length})`);
        const results = await Promise.all(
          batch.map((file) => uploadFileToServer(file, { category: 'approvals' })),
        );
        results.forEach((result, index) => {
          uploaded[batch[index].name] = { filePath: result.filePath, fileSize: result.fileSize };
        });
      }

      setProgress('문서를 등록하는 중…');
      const response = await importApprovals({
        source: source.trim() || undefined,
        rows: preview.rows,
        files: uploaded,
        viewers: viewers.length > 0 ? viewers : undefined,
      });

      setResult(response.result);
      setPhase('done');
      onImported();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '문서 이관에 실패했습니다.');
    } finally {
      setIsBusy(false);
      setProgress('');
    }
  };

  const renderRow = (row: ApprovalImportRow) => {
    const hasError = row.errors.length > 0;
    return (
      <div
        key={row.rowNumber}
        style={{
          padding: 'var(--spacing-2) var(--spacing-3)',
          borderBottom: '1px solid var(--color-border)',
          background: hasError ? 'var(--color-background-error-muted, transparent)' : undefined,
        }}
      >
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="supporting" color="secondary">{row.rowNumber}행</Text>
          <Badge
            variant={hasError ? 'red' : row.status === 'REJECTED' ? 'yellow' : 'teal'}
            label={hasError ? '제외' : row.status === 'REJECTED' ? '반려' : '승인'}
          />
          <span style={{ flex: 1, minWidth: 160 }}>
            <Text weight="medium" maxLines={1}>{row.title || '(제목 없음)'}</Text>
          </span>
          <Text type="supporting" color="secondary">
            {[row.externalDocNumber, row.requesterName, row.draftedAt].filter(Boolean).join(' · ')}
          </Text>
        </HStack>

        {row.approvers.length > 0 && (
          <Text type="supporting" color="secondary">
            결재선: {row.approvers
              .map((approver) => `${approver.name}${approver.approvedAt ? ` (${approver.approvedAt})` : ''}`)
              .join(' → ')}
          </Text>
        )}

        {row.errors.map((message) => (
          <Text key={message} type="supporting" color="accent">· {message}</Text>
        ))}
        {row.warnings.map((message) => (
          <Text key={message} type="supporting" color="secondary">· {message}</Text>
        ))}
      </div>
    );
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => { if (!open) close(); }} purpose="form" width={900}>
      <Layout
        header={
          <DialogHeader
            title="과거 문서 이관"
            onOpenChange={(open) => { if (!open) close(); }}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              {errorMessage && <Banner status="error" title={errorMessage} />}

              {phase === 'select' && (
                <>
                  <Banner
                    status="info"
                    container="section"
                    title="결재가 끝난 문서를 보관용으로 옮겨 담습니다."
                    description="이관된 문서는 결재를 다시 진행하지 않습니다. 목록에서 검색·열람만 됩니다."
                  />

                  <VStack gap={2}>
                    <Text type="label" weight="medium">1. 색인 파일 (엑셀)</Text>
                    <Text type="supporting" color="secondary">
                      문서번호·제목·기안자·기안일·결재상태·결재자·결재일·첨부파일명이 열로 들어 있는 파일입니다.
                      열 이름은 저희가 알아서 맞춰봅니다.
                    </Text>
                    <input
                      ref={indexInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      style={{ display: 'none' }}
                      onChange={(event) => setIndexFile(event.target.files?.[0] ?? null)}
                    />
                    <div
                      className="carev-upload-dropzone"
                      onClick={() => indexInputRef.current?.click()}
                      style={{
                        padding: 'var(--spacing-5)',
                        border: '2px dashed var(--color-border)',
                        borderRadius: 'var(--radius-inner)',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      {indexFile ? (
                        <HStack gap={2} hAlign="center" vAlign="center">
                          <Icon icon={FiFileText} size="md" color="accent" />
                          <Text weight="medium">{indexFile.name}</Text>
                        </HStack>
                      ) : (
                        <VStack gap={1} hAlign="center">
                          <FiUploadCloud size={28} style={{ color: 'var(--color-icon-disabled)' }} />
                          <Text color="secondary">클릭해서 색인 엑셀을 고르세요</Text>
                        </VStack>
                      )}
                    </div>
                  </VStack>

                  <VStack gap={2}>
                    <Text type="label" weight="medium">2. 문서 파일 (선택)</Text>
                    <Text type="supporting" color="secondary">
                      기안서 PDF와 첨부파일을 한꺼번에 고르세요. 색인의 파일명과 이름이 같은 것끼리 붙습니다.
                    </Text>
                    <input
                      ref={filesInputRef}
                      type="file"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(event) => setDocumentFiles(Array.from(event.target.files ?? []))}
                    />
                    <HStack gap={2} vAlign="center">
                      <Button
                        label={documentFiles.length > 0 ? '다시 고르기' : '파일 고르기'}
                        variant="secondary"
                        size="sm"
                        onClick={() => filesInputRef.current?.click()}
                      />
                      {documentFiles.length > 0 && (
                        <Text type="supporting" color="secondary">{documentFiles.length}개 선택됨</Text>
                      )}
                    </HStack>
                  </VStack>

                  <TextInput
                    label="가져온 곳"
                    value={source}
                    onChange={setSource}
                    placeholder="예: ECOUNT"
                  />
                </>
              )}

              {phase === 'review' && preview && (
                <>
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Badge variant="teal" label={`등록 예정 ${importableCount}건`} />
                    {preview.errorCount > 0 && <Badge variant="red" label={`제외 ${preview.errorCount}건`} />}
                    <Text type="supporting" color="secondary">전체 {preview.totalCount}건</Text>
                  </HStack>

                  {preview.columnMappings && preview.columnMappings.length > 0 && (
                    <Card variant="muted" padding={3}>
                      <VStack gap={1}>
                        <Text type="supporting" weight="medium">이렇게 읽었습니다</Text>
                        <Text type="supporting" color="secondary">
                          {preview.columnMappings.map((mapping) => `${mapping.header} → ${mapping.field}`).join(' , ')}
                        </Text>
                        {preview.unmappedColumns && preview.unmappedColumns.length > 0 && (
                          <Text type="supporting" color="secondary">
                            알아보지 못한 열(무시됨): {preview.unmappedColumns.join(', ')}
                          </Text>
                        )}
                      </VStack>
                    </Card>
                  )}

                  {preview.missingFileNames && preview.missingFileNames.length > 0 && (
                    <Banner
                      status="warning"
                      container="section"
                      title={`색인에 적힌 파일 ${preview.missingFileNames.length}개가 아직 없습니다.`}
                      description={`문서는 등록되지만 파일 없이 들어갑니다: ${preview.missingFileNames.slice(0, 5).join(', ')}${preview.missingFileNames.length > 5 ? ' 외' : ''}`}
                    />
                  )}

                  <div
                    style={{
                      maxHeight: 320,
                      overflowY: 'auto',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-inner)',
                    }}
                  >
                    {preview.rows.map(renderRow)}
                  </div>

                  <ViewerSelector
                    value={viewers}
                    onChange={setViewers}
                    description="이관한 문서를 볼 수 있는 직책·직원입니다. 비워두면 기관 관리자만 봅니다."
                  />
                </>
              )}

              {phase === 'done' && result && (
                <>
                  <Banner
                    status="success"
                    title={`${result.totalCount - result.errorCount}건이 등록되었습니다.`}
                    description={result.errorCount > 0
                      ? `${result.errorCount}건은 문제가 있어 등록되지 않았습니다. 아래에서 확인하세요.`
                      : '결재함에서 검색해 확인할 수 있습니다.'}
                  />
                  {result.errorCount > 0 && (
                    <div
                      style={{
                        maxHeight: 280,
                        overflowY: 'auto',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-inner)',
                      }}
                    >
                      {result.rows.filter((row) => row.errors.length > 0).map(renderRow)}
                    </div>
                  )}
                </>
              )}

              {progress && <Text type="supporting" color="secondary">{progress}</Text>}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              {phase === 'select' && (
                <>
                  <Button label="취소" variant="ghost" onClick={close} isDisabled={isBusy} />
                  <Button
                    label="읽어보기"
                    variant="primary"
                    onClick={handleReadIndex}
                    isDisabled={!indexFile || isBusy}
                    isLoading={isBusy}
                  />
                </>
              )}
              {phase === 'review' && (
                <>
                  <Button label="뒤로" variant="ghost" onClick={() => setPhase('select')} isDisabled={isBusy} />
                  <Button
                    label={`${importableCount}건 등록`}
                    variant="primary"
                    onClick={handleImport}
                    isDisabled={importableCount === 0 || isBusy}
                    isLoading={isBusy}
                  />
                </>
              )}
              {phase === 'done' && <Button label="닫기" variant="primary" onClick={close} />}
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
