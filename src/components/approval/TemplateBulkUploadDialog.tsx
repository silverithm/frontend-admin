'use client';

import React, { useMemo, useRef, useState } from 'react';
import { FiFolder, FiUploadCloud, FiX } from 'react-icons/fi';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createApprovalTemplate, uploadFileToServer } from '@/lib/apiService';
import { collectFromDataTransfer, collectFromFileList, PickedFile } from '@/lib/fileDrop';

interface TemplateBulkUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 등록이 끝나면 양식 목록을 다시 읽게 한다 */
  onUploaded: () => void;
  /** 기존 양식들이 쓰는 대분류 — 선택지로 보여준다 */
  knownCategories: string[];
}

/** 양식으로 받는 확장자 — 개별 등록 화면과 같은 목록 */
const ALLOWED_EXTENSIONS = ['hwp', 'hwpx', 'doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx'];

const NEW_CATEGORY_VALUE = '__custom__';

/** 한 번에 처리하는 건수 — 파일 업로드와 등록이 한 건씩 묶여 돈다 */
const UPLOAD_BATCH = 4;

interface TemplateRow {
  entry: PickedFile;
  /** 양식명 — 파일명에서 확장자를 뗀 값으로 시작하고 화면에서 고칠 수 있다 */
  name: string;
}

/**
 * 양식 파일 여러 개를 한 번에 양식으로 등록한다.
 *
 * 파일 하나가 양식 하나가 된다. 양식명은 파일명에서 따오고 목록에서 고칠 수 있다 —
 * 수십 개를 하나씩 등록 모달로 올리는 일을 없앤다.
 */
export default function TemplateBulkUploadDialog({
  isOpen,
  onClose,
  onUploaded,
  knownCategories,
}: TemplateBulkUploadDialogProps) {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [skippedNames, setSkippedNames] = useState<string[]>([]);
  const [categoryValue, setCategoryValue] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [doneMessage, setDoneMessage] = useState('');
  const [failures, setFailures] = useState<string[]>([]);

  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const categoryOptions = useMemo(
    () => [
      ...knownCategories.map((category) => ({ value: category, label: category })),
      { value: NEW_CATEGORY_VALUE, label: '+ 새 대분류 직접 입력' },
    ],
    [knownCategories],
  );

  const reset = () => {
    setRows([]);
    setSkippedNames([]);
    setCategoryValue('');
    setCustomCategory('');
    setProgress('');
    setErrorMessage('');
    setDoneMessage('');
    setFailures([]);
  };

  const close = () => {
    reset();
    onClose();
  };

  const addFiles = (incoming: PickedFile[]) => {
    setRows((current) => {
      const seen = new Set(current.map((row) => row.entry.file.name));
      const next = [...current];
      const skipped: string[] = [];
      for (const entry of incoming) {
        const extension = entry.file.name.split('.').pop()?.toLowerCase() ?? '';
        if (!ALLOWED_EXTENSIONS.includes(extension)) {
          skipped.push(entry.file.name);
          continue;
        }
        if (seen.has(entry.file.name)) continue;
        seen.add(entry.file.name);
        next.push({
          entry,
          name: entry.file.name.replace(/\.[^.]+$/, ''),
        });
      }
      if (skipped.length > 0) setSkippedNames((names) => [...names, ...skipped]);
      return next;
    });
  };

  const handleUpload = async () => {
    const category = (categoryValue === NEW_CATEGORY_VALUE ? customCategory : categoryValue).trim();

    setIsBusy(true);
    setErrorMessage('');
    setFailures([]);
    try {
      const failed: string[] = [];
      let done = 0;

      for (let i = 0; i < rows.length; i += UPLOAD_BATCH) {
        const batch = rows.slice(i, i + UPLOAD_BATCH);
        await Promise.all(batch.map(async (row) => {
          try {
            const uploaded = await uploadFileToServer(row.entry.file, { category: 'templates' });
            await createApprovalTemplate({
              name: row.name.trim() || row.entry.file.name,
              description: '',
              category,
              fileUrl: uploaded.filePath,
              fileName: uploaded.fileName,
              fileSize: uploaded.fileSize,
              templateType: 'file',
            });
          } catch (error) {
            const reason = error instanceof Error ? error.message : '등록 실패';
            failed.push(`${row.entry.file.name} — ${reason}`);
          }
        }));
        done = Math.min(i + batch.length, rows.length);
        setProgress(`양식 등록 중… (${done}/${rows.length})`);
      }

      setFailures(failed);
      setDoneMessage(`${rows.length - failed.length}개 양식이 등록되었습니다.`);
      onUploaded();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '양식 등록에 실패했습니다.');
    } finally {
      setIsBusy(false);
      setProgress('');
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => { if (!open) close(); }} purpose="form" width={720}>
      <Layout
        header={<DialogHeader title="대량 양식 업로드" onOpenChange={(open) => { if (!open) close(); }} />}
        content={
          <LayoutContent>
            <VStack gap={4}>
              {errorMessage && <Banner status="error" title={errorMessage} />}

              {doneMessage ? (
                <>
                  <Banner
                    status={failures.length > 0 ? 'warning' : 'success'}
                    title={doneMessage}
                    description={failures.length > 0 ? `${failures.length}개는 등록되지 않았습니다.` : undefined}
                  />
                  {failures.map((message) => (
                    <Text key={message} type="supporting" color="secondary">· {message}</Text>
                  ))}
                </>
              ) : (
                <>
                  <Text type="supporting" color="secondary">
                    파일 하나가 양식 하나로 등록됩니다. 양식명은 파일명에서 따오고 아래에서 고칠 수 있습니다.
                  </Text>

                  <input
                    ref={filesInputRef}
                    type="file"
                    multiple
                    accept={ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(',')}
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
                      <Text type="supporting" color="secondary">
                        양식 파일이나 폴더를 끌어다 놓으세요 ({ALLOWED_EXTENSIONS.join(', ')})
                      </Text>
                      <HStack gap={2}>
                        <Button label="파일 고르기" variant="secondary" size="sm" onClick={() => filesInputRef.current?.click()} />
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

                  {skippedNames.length > 0 && (
                    <Text type="supporting" color="secondary">
                      양식으로 쓸 수 없는 형식이라 제외: {skippedNames.join(', ')}
                    </Text>
                  )}

                  {rows.length > 0 && (
                    <>
                      <VStack gap={2}>
                        <Selector
                          label="기안 대분류 (전체 적용)"
                          placeholder="대분류를 선택하세요 (선택 안 하면 미분류)"
                          value={categoryValue}
                          options={categoryOptions}
                          hasClear
                          onChange={(value) => {
                            setCategoryValue(value || '');
                            if (value !== NEW_CATEGORY_VALUE) setCustomCategory('');
                          }}
                        />
                        {categoryValue === NEW_CATEGORY_VALUE && (
                          <TextInput
                            label="새 대분류 이름"
                            value={customCategory}
                            onChange={setCustomCategory}
                            placeholder="예: 회계, 시설, 안전"
                          />
                        )}
                      </VStack>

                      <VStack gap={1}>
                        <HStack gap={2} vAlign="center" hAlign="between">
                          <Text type="supporting" weight="medium">등록할 양식 {rows.length}개</Text>
                          <Button label="모두 비우기" variant="ghost" size="sm" onClick={() => { setRows([]); setSkippedNames([]); }} />
                        </HStack>
                        <div
                          style={{
                            maxHeight: 280,
                            overflowY: 'auto',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-inner)',
                          }}
                        >
                          {rows.map((row, index) => (
                            <div
                              key={row.entry.path}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-2)',
                                padding: 'var(--spacing-1) var(--spacing-3)',
                                borderBottom: '1px solid var(--color-border)',
                              }}
                            >
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <TextInput
                                  label={`${row.entry.file.name} 양식명`}
                                  isLabelHidden
                                  value={row.name}
                                  onChange={(value) => {
                                    setRows((current) => current.map((r, i) => (i === index ? { ...r, name: value } : r)));
                                  }}
                                />
                              </span>
                              <Text type="supporting" color="secondary" maxLines={1}>{row.entry.file.name}</Text>
                              <IconButton
                                label={`${row.entry.file.name} 제거`}
                                variant="ghost"
                                size="sm"
                                icon={<FiX />}
                                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                              />
                            </div>
                          ))}
                        </div>
                      </VStack>
                    </>
                  )}

                  {progress && <Text type="supporting" color="secondary">{progress}</Text>}
                </>
              )}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              {doneMessage ? (
                <Button label="닫기" variant="primary" onClick={close} />
              ) : (
                <>
                  <Button label="취소" variant="ghost" onClick={close} isDisabled={isBusy} />
                  <Button
                    label={`${rows.length}개 등록`}
                    variant="primary"
                    onClick={handleUpload}
                    isDisabled={rows.length === 0 || isBusy}
                    isLoading={isBusy}
                  />
                </>
              )}
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
