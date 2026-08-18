'use client';

import { useRef, useState } from 'react';

import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Table, TableRow, TableCell, TableHeaderCell } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';

import { FiDownload, FiUpload, FiFileText } from 'react-icons/fi';

import type { ElderlyInfo } from '@/types/elderly';
import {
  downloadElderTemplate,
  parseElderExcel,
  MAX_BULK_ELDERS,
  type ParsedElderRow,
} from '@/lib/elderExcel';
import { bulkRegisterElders, type BulkRegisterResult } from '@/lib/elderBulkApi';

interface ElderBulkUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 중복 검사용 현재 등록 명단 */
  existingSeniors: ElderlyInfo[];
  /** 등록이 끝난 뒤 목록을 다시 불러오게 한다 */
  onComplete: () => Promise<void> | void;
  onNotification: (message: string, type: 'success' | 'error') => void;
}

type Step = 'select' | 'preview' | 'uploading' | 'done';

/**
 * 어르신 엑셀 대량 등록 다이얼로그.
 * 파일 선택 → 행별 검증 프리뷰 → 등록 → 결과 요약의 4단계.
 * 검증을 등록 전에 끝내 두므로, 등록 단계에서 실패하는 행이 없는 것이 정상 경로다.
 */
export default function ElderBulkUploadDialog({
  isOpen,
  onClose,
  existingSeniors,
  onComplete,
  onNotification,
}: ElderBulkUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedElderRow[]>([]);
  const [includeExisting, setIncludeExisting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<BulkRegisterResult | null>(null);

  const reset = () => {
    setStep('select');
    setFileName('');
    setParseError(null);
    setRows([]);
    setIncludeExisting(false);
    setProgress({ done: 0, total: 0 });
    setResult(null);
  };

  const close = () => {
    // 등록 중에는 닫아도 요청이 이미 나가 있다 — 도중 닫기는 막는다
    if (step === 'uploading') return;
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    if (!/\.xlsx$/i.test(file.name)) {
      setParseError(
        /\.xls$/i.test(file.name)
          ? '구버전 .xls 파일은 지원하지 않습니다. 엑셀에서 .xlsx로 저장해 다시 올려주세요.'
          : '엑셀(.xlsx) 파일만 올릴 수 있습니다.',
      );
      return;
    }
    setIsParsing(true);
    setParseError(null);
    try {
      const parsed = await parseElderExcel(file, existingSeniors);
      if (parsed.rows.length === 0) {
        setParseError('파일에서 등록할 행을 찾지 못했습니다. 2행부터 이름을 적었는지 확인해주세요.');
        return;
      }
      setFileName(file.name);
      setRows(parsed.rows);
      setIncludeExisting(false);
      setStep('preview');
    } catch (error) {
      setParseError(error instanceof Error ? error.message : '파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsParsing(false);
    }
  };

  const registerTargets = rows.filter(
    (r) => r.status === 'ok' || (includeExisting && r.status === 'duplicateExisting'),
  );
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;
  const duplicateInFileCount = rows.filter((r) => r.status === 'duplicateInFile').length;
  const duplicateExistingCount = rows.filter((r) => r.status === 'duplicateExisting').length;
  const excludedCount = rows.length - registerTargets.length;

  const handleRegister = async () => {
    if (registerTargets.length === 0) return;
    setStep('uploading');
    setProgress({ done: 0, total: registerTargets.length });
    try {
      const registerResult = await bulkRegisterElders(
        registerTargets.map((r) => ({
          name: r.name,
          homeAddress: r.homeAddress || undefined,
          requiredFrontSeat: r.requiredFrontSeat,
        })),
        (done, total) => setProgress({ done, total }),
      );
      setResult(registerResult);
      setStep('done');
      await onComplete();
      if (registerResult.failed.length === 0) {
        onNotification(`어르신 ${registerResult.created}명을 등록했습니다.`, 'success');
      } else {
        onNotification(
          `${registerResult.created}명 등록, ${registerResult.failed.length}명은 실패했습니다.`,
          'error',
        );
      }
    } catch (error) {
      // bulk 전체 실패 — 아무도 등록되지 않았으니 프리뷰로 되돌려 다시 시도할 수 있게 한다
      setStep('preview');
      onNotification(error instanceof Error ? error.message : '등록 중 오류가 발생했습니다.', 'error');
    }
  };

  const rowStatusCell = (row: ParsedElderRow) => {
    if (row.status === 'invalid') return <Badge variant="red" label="등록 불가" />;
    if (row.status === 'duplicateInFile') return <Badge variant="yellow" label="파일 중복" />;
    if (row.status === 'duplicateExisting') {
      return includeExisting ? <Badge variant="teal" label="등록(중복)" /> : <Badge variant="yellow" label="기존 중복" />;
    }
    return <Text type="supporting" color="secondary">등록</Text>;
  };

  const progressPercent = progress.total === 0 ? 0 : progress.done / progress.total;

  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => { if (!o) close(); }} purpose="form" width={680}>
      <Layout
        header={
          <DialogHeader
            title="어르신 엑셀 등록"
            subtitle={step === 'preview' || step === 'uploading' ? fileName : `양식에 맞춰 한 번에 ${MAX_BULK_ELDERS}명까지 등록합니다`}
            onOpenChange={(o) => { if (!o) close(); }}
          />
        }
        content={
          <LayoutContent>
            {step === 'select' && (
              <VStack gap={4}>
                <Text type="body" color="secondary">
                  양식을 내려받아 이름·주소·앞자리 필요 여부를 채운 뒤 올려주세요.
                  등록 전에 행별 검사 결과를 먼저 보여드립니다.
                </Text>
                <HStack gap={2}>
                  <Button
                    label="양식 내려받기"
                    variant="secondary"
                    icon={<Icon icon={FiDownload} size="sm" />}
                    onClick={() => {
                      downloadElderTemplate().catch(() => {
                        onNotification('양식 생성에 실패했습니다.', 'error');
                      });
                    }}
                  />
                </HStack>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="엑셀 파일 선택"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFile(file);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--spacing-2)',
                    padding: 'var(--spacing-8) var(--spacing-4)',
                    border: `2px dashed ${isDragOver ? 'var(--color-accent)' : 'var(--color-border-emphasized)'}`,
                    borderRadius: 'var(--radius-inner)',
                    background: isDragOver ? 'var(--color-background-teal)' : 'var(--color-background-muted)',
                    cursor: 'pointer',
                    transition: 'border-color var(--duration-fast-min) var(--ease-standard), background var(--duration-fast-min) var(--ease-standard)',
                  }}
                >
                  <span style={{ display: 'flex', color: 'var(--color-icon-teal)' }}>
                    <Icon icon={isParsing ? FiFileText : FiUpload} size="lg" color="inherit" />
                  </span>
                  <Text type="body" weight="medium" color="primary">
                    {isParsing ? '파일을 읽는 중...' : '엑셀 파일을 끌어다 놓거나 눌러서 선택'}
                  </Text>
                  <Text type="supporting" color="secondary">.xlsx 형식</Text>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = ''; // 같은 파일을 고쳐서 다시 올릴 수 있게 초기화
                  }}
                />
                {parseError && (
                  <Banner status="error" title="파일을 읽지 못했습니다" description={parseError} container="section" />
                )}
              </VStack>
            )}

            {(step === 'preview' || step === 'uploading') && (
              <VStack gap={3}>
                <Banner
                  status={registerTargets.length > 0 ? 'info' : 'warning'}
                  title={`${registerTargets.length}명 등록 예정${excludedCount > 0 ? ` · ${excludedCount}건 제외` : ''}`}
                  description={[
                    invalidCount > 0 ? `등록 불가 ${invalidCount}건` : '',
                    duplicateInFileCount > 0 ? `파일 안 중복 ${duplicateInFileCount}건` : '',
                    duplicateExistingCount > 0 ? `이미 등록된 어르신과 중복 ${duplicateExistingCount}건` : '',
                  ].filter(Boolean).join(' · ') || '모든 행이 검사를 통과했습니다.'}
                  container="section"
                />
                {duplicateExistingCount > 0 && (
                  <CheckboxInput
                    label={`이미 등록된 어르신과 이름·주소가 같은 ${duplicateExistingCount}건도 등록에 포함`}
                    value={includeExisting}
                    onChange={(checked) => setIncludeExisting(checked)}
                    isDisabled={step === 'uploading'}
                  />
                )}
                <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-inner)' }}>
                  <Table dividers="rows">
                    <thead>
                      <TableRow isHeaderRow>
                        <TableHeaderCell>행</TableHeaderCell>
                        <TableHeaderCell>이름</TableHeaderCell>
                        <TableHeaderCell>주소</TableHeaderCell>
                        <TableHeaderCell>앞자리</TableHeaderCell>
                        <TableHeaderCell>상태</TableHeaderCell>
                      </TableRow>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <TableRow key={row.rowNumber}>
                          <TableCell>
                            <Text type="supporting" color="secondary" hasTabularNumbers>{row.rowNumber}</Text>
                          </TableCell>
                          <TableCell>
                            <Text type="body" weight="medium">{row.name || '—'}</Text>
                          </TableCell>
                          <TableCell>
                            <Text type="supporting" color="secondary" maxLines={1}>{row.homeAddress || '—'}</Text>
                          </TableCell>
                          <TableCell>
                            <Text type="supporting" color="secondary">{row.requiredFrontSeat ? 'O' : 'X'}</Text>
                          </TableCell>
                          <TableCell>
                            <VStack gap={0.5} align="start">
                              {rowStatusCell(row)}
                              {row.message && (
                                <Text type="supporting" color={row.status === 'ok' ? 'secondary' : 'primary'}>
                                  {row.message}
                                </Text>
                              )}
                            </VStack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </tbody>
                  </Table>
                </div>
                {step === 'uploading' && (
                  <VStack gap={1}>
                    <HStack hAlign="between" vAlign="center">
                      <Text type="supporting" color="secondary">등록 중… 창을 닫지 마세요.</Text>
                      <Text type="supporting" color="secondary" hasTabularNumbers>
                        {progress.done}/{progress.total}
                      </Text>
                    </HStack>
                    <div
                      role="progressbar"
                      aria-label="등록 진행도"
                      aria-valuenow={Math.round(progressPercent * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-background-muted)', overflow: 'hidden' }}
                    >
                      <div style={{ width: '100%', height: '100%', background: 'var(--color-accent)', transformOrigin: 'left', transform: `scaleX(${progressPercent})`, transition: 'transform var(--duration-fast) var(--ease-standard)' }} />
                    </div>
                  </VStack>
                )}
              </VStack>
            )}

            {step === 'done' && result && (
              <VStack gap={3}>
                <Banner
                  status={result.failed.length === 0 ? 'success' : 'warning'}
                  title={
                    result.failed.length === 0
                      ? `어르신 ${result.created}명을 등록했습니다`
                      : `${result.created}명 등록 완료 · ${result.failed.length}명 실패`
                  }
                  description={
                    result.failed.length === 0
                      ? '어르신 관리 목록에서 바로 확인할 수 있습니다.'
                      : '실패한 분들은 아래 사유를 확인한 뒤 개별 등록하거나 파일을 고쳐 다시 올려주세요.'
                  }
                  container="section"
                />
                {result.failed.length > 0 && (
                  <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-inner)' }}>
                    <Table dividers="rows">
                      <thead>
                        <TableRow isHeaderRow>
                          <TableHeaderCell>이름</TableHeaderCell>
                          <TableHeaderCell>실패 사유</TableHeaderCell>
                        </TableRow>
                      </thead>
                      <tbody>
                        {result.failed.map((f, i) => (
                          <TableRow key={`${f.input.name}-${i}`}>
                            <TableCell>
                              <Text type="body" weight="medium">{f.input.name}</Text>
                            </TableCell>
                            <TableCell>
                              <Text type="supporting" color="secondary">{f.message}</Text>
                            </TableCell>
                          </TableRow>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </VStack>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              {step === 'select' && <Button label="닫기" variant="secondary" onClick={close} />}
              {step === 'preview' && (
                <>
                  <Button label="다른 파일 선택" variant="secondary" onClick={() => { reset(); }} />
                  <Button
                    label={`${registerTargets.length}명 등록`}
                    variant="primary"
                    isDisabled={registerTargets.length === 0}
                    onClick={handleRegister}
                  />
                </>
              )}
              {step === 'uploading' && (
                <Button label="등록 중..." variant="primary" isLoading isDisabled onClick={() => {}} />
              )}
              {step === 'done' && <Button label="닫기" variant="primary" onClick={close} />}
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
