'use client';

import React, { useMemo, useRef, useState } from 'react';
import { FiDownload, FiFileText, FiFolder, FiUploadCloud, FiX } from 'react-icons/fi';
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
import { IconButton } from '@astryxdesign/core/IconButton';
import { collectFromDataTransfer, collectFromFileList, PickedFile } from '@/lib/fileDrop';
import {
  downloadApprovalImportTemplate,
  importApprovals,
  previewApprovalImport,
  uploadFileToServer,
} from '@/lib/apiService';
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
  const [documentFiles, setDocumentFiles] = useState<PickedFile[]>([]);
  /** 같은 이름이라 목록에서 제외한 파일 수 — 색인은 파일명으로 짝을 맞추므로 이름이 유일해야 한다 */
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [source, setSource] = useState('ECOUNT');
  const [viewers, setViewers] = useState<ApprovalViewerEntry[]>([]);
  const [preview, setPreview] = useState<ApprovalImportPreview | null>(null);
  const [result, setResult] = useState<ApprovalImportPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const indexInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const importableCount = useMemo(
    () => (preview ? preview.totalCount - preview.errorCount : 0),
    [preview],
  );

  /** 파일 추가 — 색인이 파일명으로 짝을 맞추므로 같은 이름은 처음 것만 남긴다 */
  const addFiles = (incoming: PickedFile[]) => {
    setDocumentFiles((current) => {
      const seen = new Set(current.map((entry) => entry.file.name));
      const fresh: PickedFile[] = [];
      let skipped = 0;
      for (const entry of incoming) {
        if (seen.has(entry.file.name)) {
          skipped++;
          continue;
        }
        seen.add(entry.file.name);
        fresh.push(entry);
      }
      if (skipped > 0) setDuplicateCount((count) => count + skipped);
      return [...current, ...fresh];
    });
  };

  const removeFile = (name: string) => {
    setDocumentFiles((current) => current.filter((entry) => entry.file.name !== name));
  };

  /** 폴더에서 온 파일을 폴더별로 묶는다 — 무엇을 골랐는지 눈으로 확인하고 올리게 */
  const groupedFiles = useMemo(() => {
    const groups = new Map<string, PickedFile[]>();
    for (const entry of documentFiles) {
      const slash = entry.path.indexOf('/');
      const group = slash > 0 ? entry.path.slice(0, slash) : '';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(entry);
    }
    return Array.from(groups.entries());
  }, [documentFiles]);

  const reset = () => {
    setPhase('select');
    setIndexFile(null);
    setDocumentFiles([]);
    setDuplicateCount(0);
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
      const read = await previewApprovalImport(indexFile, documentFiles.map((entry) => entry.file.name));
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
      const targets = documentFiles.filter((entry) => neededNames.has(entry.file.name)).map((entry) => entry.file);

      const uploaded: Record<string, { filePath: string; fileSize?: number }> = {};
      for (let i = 0; i < targets.length; i += UPLOAD_BATCH) {
        const batch = targets.slice(i, i + UPLOAD_BATCH);
        setProgress(`문서 파일 올리는 중… (${Math.min(i + batch.length, targets.length)}/${targets.length})`);
        const results = await Promise.all(
          batch.map(async (file) => {
            try {
              return await uploadFileToServer(file, { category: 'approvals' });
            } catch (error) {
              // 수백 개 중 하나가 걸려도 어느 파일인지 알아야 고칠 수 있다
              const reason = error instanceof Error ? error.message : '업로드 실패';
              throw new Error(`"${file.name}" 업로드에 실패했습니다: ${reason}`);
            }
          }),
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
            title="대량 문서 업로드"
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
                    <HStack gap={2} vAlign="center" hAlign="between">
                      <Text type="label" weight="medium">1. 색인 파일 (엑셀)</Text>
                      <Button
                        label="양식 내려받기"
                        variant="secondary"
                        size="sm"
                        icon={<Icon icon={FiDownload} size="sm" />}
                        isDisabled={isBusy}
                        onClick={async () => {
                          try {
                            await downloadApprovalImportTemplate();
                          } catch (error) {
                            setErrorMessage(error instanceof Error ? error.message : '양식을 내려받지 못했습니다.');
                          }
                        }}
                      />
                    </HStack>
                    <Text type="supporting" color="secondary">
                      양식을 채워서 올리세요. 쓰던 시스템에서 내보낸 파일도 열 이름이 맞으면 그대로 올릴 수 있습니다.
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
                      기안서 PDF와 첨부파일을 끌어다 놓거나 골라주세요. 폴더째 넣어도 안의 파일을 전부 읽습니다.
                      색인의 파일명과 이름이 같은 것끼리 붙습니다.
                    </Text>
                    <input
                      ref={filesInputRef}
                      type="file"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        if (event.target.files) addFiles(collectFromFileList(event.target.files));
                        event.target.value = '';
                      }}
                    />
                    <input
                      ref={folderInputRef}
                      type="file"
                      // @ts-expect-error 비표준이지만 모든 주요 브라우저가 지원하는 폴더 선택
                      webkitdirectory=""
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        if (event.target.files) addFiles(collectFromFileList(event.target.files));
                        event.target.value = '';
                      }}
                    />
                    <div
                      onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={async (event) => {
                        event.preventDefault();
                        setIsDragOver(false);
                        addFiles(await collectFromDataTransfer(event.dataTransfer));
                      }}
                      style={{
                        padding: 'var(--spacing-4)',
                        border: `2px dashed ${isDragOver ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-inner)',
                        background: isDragOver ? 'var(--color-background-muted)' : undefined,
                        textAlign: 'center',
                      }}
                    >
                      <VStack gap={2} hAlign="center">
                        <FiUploadCloud size={24} style={{ color: 'var(--color-icon-disabled)' }} />
                        <Text type="supporting" color="secondary">여기로 파일이나 폴더를 끌어다 놓으세요</Text>
                        <HStack gap={2}>
                          <Button
                            label="파일 고르기"
                            variant="secondary"
                            size="sm"
                            onClick={() => filesInputRef.current?.click()}
                          />
                          <Button
                            label="폴더 고르기"
                            variant="secondary"
                            size="sm"
                            icon={<Icon icon={FiFolder} size="sm" />}
                            onClick={() => folderInputRef.current?.click()}
                          />
                        </HStack>
                      </VStack>
                    </div>

                    {duplicateCount > 0 && (
                      <Text type="supporting" color="secondary">
                        같은 이름이라 제외한 파일 {duplicateCount}개 — 색인은 파일명으로 짝을 맞추므로 이름이 겹치면 처음 것만 씁니다.
                      </Text>
                    )}

                    {/* 골라진 파일 전체 목록 — 폴더별로 묶어 눈으로 확인하고 올린다 */}
                    {documentFiles.length > 0 && (
                      <VStack gap={1}>
                        <HStack gap={2} vAlign="center" hAlign="between">
                          <Text type="supporting" weight="medium">선택된 파일 {documentFiles.length}개</Text>
                          <Button
                            label="모두 비우기"
                            variant="ghost"
                            size="sm"
                            onClick={() => { setDocumentFiles([]); setDuplicateCount(0); }}
                          />
                        </HStack>
                        <div
                          style={{
                            maxHeight: 220,
                            overflowY: 'auto',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-inner)',
                          }}
                        >
                          {groupedFiles.map(([group, entries]) => (
                            <div key={group || '(낱개)'}>
                              {group && (
                                <div
                                  style={{
                                    padding: 'var(--spacing-1) var(--spacing-3)',
                                    background: 'var(--color-background-muted)',
                                    borderBottom: '1px solid var(--color-border)',
                                  }}
                                >
                                  <HStack gap={1} vAlign="center">
                                    <Icon icon={FiFolder} size="sm" color="secondary" />
                                    <Text type="supporting" weight="medium">{group} ({entries.length}개)</Text>
                                  </HStack>
                                </div>
                              )}
                              {entries.map((entry) => (
                                <div
                                  key={entry.path}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-2)',
                                    padding: '2px var(--spacing-3)',
                                    borderBottom: '1px solid var(--color-border)',
                                    paddingLeft: group ? 'var(--spacing-6)' : 'var(--spacing-3)',
                                  }}
                                >
                                  <span style={{ flex: 1, minWidth: 0 }}>
                                    <Text type="supporting" maxLines={1}>{entry.file.name}</Text>
                                  </span>
                                  <Text type="supporting" color="secondary">
                                    {(entry.file.size / 1024).toFixed(0)}KB
                                  </Text>
                                  <IconButton
                                    label={`${entry.file.name} 제거`}
                                    variant="ghost"
                                    size="sm"
                                    icon={<FiX />}
                                    onClick={() => removeFile(entry.file.name)}
                                  />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </VStack>
                    )}
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
