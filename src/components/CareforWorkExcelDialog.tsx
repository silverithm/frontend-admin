'use client';

import { useMemo, useRef, useState, type CSSProperties } from 'react';

import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

import { FiFileText, FiUpload } from 'react-icons/fi';

import type { VacationRequest } from '@/types/vacation';
import {
  buildCareforWorkFileName,
  buildCareforWorkRows,
  downloadCareforWorkExcel,
  readCareforWorkExcel,
  type CareforStaff,
} from '@/lib/careforWorkExcel';

interface CareforWorkExcelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 만들 달 — 근무표에서 보고 있는 달 */
  targetMonth: Date;
  memberNames: string[];
  vacations: VacationRequest[];
  /** 케어포 파일 없이 근무·휴무만 담은 기존 엑셀 */
  onPlainExport: () => void;
  isPlainExporting: boolean;
  onNotification: (message: string, type: 'success' | 'error') => void;
}

type Step = 'select' | 'preview' | 'done';

/** '11.요양보호사 1급' → '요양보호사 1급' (공단 번호는 화면에서 뺀다) */
const jobLabel = (job: string) => job.replace(/^\d+\.\s*/, '');

/** 미리보기 한 줄 — 이름·직종·평소 근무·쉬는 요일·이달 */
const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(64px, 0.8fr) minmax(88px, 1fr) minmax(112px, 1.3fr) minmax(56px, 0.6fr) minmax(120px, 1.3fr)',
  gap: 'var(--spacing-3)',
  alignItems: 'center',
  padding: 'var(--spacing-2) var(--spacing-3)',
  // 좁은 화면에서는 칸을 접지 않고 옆으로 밀어 본다
  minWidth: 520,
};

const namesLine = (names: string[]) =>
  names.length <= 6 ? names.join(', ') : `${names.slice(0, 6).join(', ')} 외 ${names.length - 6}명`;

/**
 * 근무표 → 케어포 8-2 근무일정표에 바로 올릴 엑셀.
 *
 * 케어포에서 받은 지난 파일로 직원별 생년월일·평소 근무시간을 읽고, 이 달 휴무를 얹는다.
 * 파일은 브라우저 안에서만 읽는다 — 생년월일을 서버로 보내거나 남기지 않는다.
 */
export default function CareforWorkExcelDialog({
  isOpen,
  onClose,
  targetMonth,
  memberNames,
  vacations,
  onPlainExport,
  isPlainExporting,
  onNotification,
}: CareforWorkExcelDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState('');
  const [staff, setStaff] = useState<CareforStaff[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();
  const monthLabel = `${year}년 ${month + 1}월`;

  const result = useMemo(
    () => (staff.length > 0 ? buildCareforWorkRows({ year, month, staff, memberNames, vacations }) : null),
    [staff, year, month, memberNames, vacations],
  );

  const reset = () => {
    setStep('select');
    setFileName('');
    setStaff([]);
    setParseError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    if (!/\.xlsx$/i.test(file.name)) {
      setParseError('케어포에서 받은 .xlsx 파일만 넣을 수 있습니다.');
      return;
    }
    setIsParsing(true);
    setParseError(null);
    try {
      const parsed = await readCareforWorkExcel(file);
      if (parsed.staff.length === 0) {
        setParseError('파일에서 직원을 찾지 못했습니다. 케어포 8-2에서 받은 직원근무일정 파일인지 확인해주세요.');
        return;
      }
      setFileName(file.name);
      setStaff(parsed.staff);
      setStep('preview');
    } catch (error) {
      setParseError(error instanceof Error ? error.message : '파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownload = async () => {
    if (!result || result.staff.length === 0) return;
    setIsSaving(true);
    try {
      await downloadCareforWorkExcel(result.rows, buildCareforWorkFileName(year, month));
      setStep('done');
      onNotification(`${monthLabel} 케어포용 근무일정 ${result.staff.length}명을 내려받았습니다.`, 'success');
    } catch (error) {
      console.error('케어포용 근무일정 만들기 실패:', error);
      onNotification('엑셀을 만들지 못했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const mismatchCount = result
    ? result.careforOnly.length + result.sameName.length + result.carevOnly.length
    : 0;

  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => { if (!o) close(); }} purpose="form" width={720}>
      <Layout
        header={
          <DialogHeader
            title="케어포용 근무일정 만들기"
            subtitle={step === 'select' ? `${monthLabel} · 케어포 8-2 근무일정표에 바로 올리는 파일` : `${monthLabel} · ${fileName}`}
            onOpenChange={(o) => { if (!o) close(); }}
          />
        }
        content={
          <LayoutContent>
            {step === 'select' && (
              <VStack gap={4}>
                <VStack gap={1}>
                  <Text type="body" color="primary">
                    케어포에서 지난달 근무일정 파일을 받아 넣어주세요.
                  </Text>
                  <Text type="supporting" color="secondary">
                    케어포 8-2 근무일정표 → 근무내용 공단연동 → [케어포 ➔ 공단] → 케어포 ➔ 공단 근무내용 연동 (엑셀파일)
                  </Text>
                  <Text type="supporting" color="secondary">
                    이 파일에서 직원별 생년월일·평소 근무시간·쉬는 요일을 읽고, 케어브이의 {monthLabel} 휴무·연차·반차를 얹습니다.
                  </Text>
                </VStack>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="케어포 근무일정 파일 선택"
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
                    {isParsing ? '파일을 읽는 중...' : '‘직원근무일정.xlsx’를 끌어다 놓거나 눌러서 선택'}
                  </Text>
                  <Text type="supporting" color="secondary">파일은 이 컴퓨터에서만 읽고 서버로 보내지 않습니다</Text>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = '';
                  }}
                />
                {parseError && (
                  <Banner status="error" title="파일을 읽지 못했습니다" description={parseError} container="section" />
                )}
              </VStack>
            )}

            {step === 'preview' && result && (
              <VStack gap={3}>
                <Banner
                  status={result.staff.length > 0 ? 'info' : 'warning'}
                  title={
                    result.staff.length > 0
                      ? `${result.staff.length}명의 ${monthLabel} 근무일정을 만듭니다`
                      : '케어브이 직원과 이름이 맞는 사람이 없습니다'
                  }
                  description={
                    result.staff.length > 0
                      ? [
                          '평소 근무시간은 지난 파일에서 가장 많이 쓴 시간입니다. 그날만 다른 시간은 올린 뒤 케어포에서 고쳐주세요.',
                          result.leaveOnRestDays.length > 0
                            ? `일요일·평소 쉬는 요일에 잡힌 연차·반차 ${result.leaveOnRestDays.length}건(${namesLine(
                                result.leaveOnRestDays.map((l) => `${l.name} ${Number(l.date.slice(5, 7))}/${Number(l.date.slice(8))}`),
                              )})은 케어포 연차가 깎이지 않도록 넣지 않았습니다.`
                            : '',
                        ].filter(Boolean).join(' ')
                      : '케어포 직원 이름과 케어브이 직원 이름이 같은지 확인해주세요.'
                  }
                  container="section"
                />
                {mismatchCount > 0 && (
                  <Banner
                    status="warning"
                    title={`이름이 맞지 않아 넣지 않는 직원 ${mismatchCount}명`}
                    description={[
                      result.careforOnly.length > 0
                        ? `케어포에만 있음 ${namesLine(result.careforOnly)} — 케어포에 넣어 둔 일정이 그대로 남습니다.`
                        : '',
                      result.sameName.length > 0
                        ? `케어포에 같은 이름이 둘 ${namesLine(result.sameName)} — 케어포에서 직접 넣어주세요.`
                        : '',
                      result.carevOnly.length > 0
                        ? `케어브이에만 있음 ${namesLine(result.carevOnly)} — 케어포 직원 이름과 다르거나 등록 전입니다. 케어포에서 직접 넣어주세요.`
                        : '',
                    ].filter(Boolean).join(' ')}
                    container="section"
                  />
                )}
                {result.staff.length > 0 && (
                  <div
                    role="table"
                    aria-label={`${monthLabel} 케어포용 근무일정 미리보기`}
                    style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-inner)' }}
                  >
                    <div role="row" style={{ ...GRID, position: 'sticky', top: 0, background: 'var(--color-background-muted)', borderBottom: '1px solid var(--color-border)' }}>
                      {['이름', '직종', '평소 근무', '쉬는 요일', `${month + 1}월`].map((label) => (
                        <span key={label} role="columnheader">
                          <Text type="supporting" color="secondary" weight="medium">{label}</Text>
                        </span>
                      ))}
                    </div>
                    {result.staff.map((s, index) => (
                      <div
                        key={s.name}
                        role="row"
                        style={{ ...GRID, borderTop: index === 0 ? 'none' : '1px solid var(--color-border)' }}
                      >
                        <span role="cell"><Text type="body" weight="medium" maxLines={1}>{s.name}</Text></span>
                        <span role="cell"><Text type="supporting" color="secondary" maxLines={1}>{jobLabel(s.job)}</Text></span>
                        <span role="cell"><Text type="supporting" color="secondary" hasTabularNumbers>{s.usualTime}</Text></span>
                        <span role="cell"><Text type="supporting" color="secondary">{s.offWeekdays}</Text></span>
                        <span role="cell">
                          <Text type="supporting" color="secondary" hasTabularNumbers>
                            {[
                              `근무 ${s.workDays}일`,
                              s.offDays > 0 ? `휴무 ${s.offDays}` : '',
                              s.annualDays > 0 ? `연차 ${s.annualDays}` : '',
                              s.halfDays > 0 ? `반차 ${s.halfDays}` : '',
                            ].filter(Boolean).join(' · ')}
                          </Text>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </VStack>
            )}

            {step === 'done' && result && (
              <VStack gap={3}>
                <Banner
                  status="success"
                  title="파일을 내려받았습니다. 이제 케어포에 올려주세요"
                  description={`케어포 8-2 근무일정표 → 근무내용 공단연동 → [공단 ➔ 케어포] 탭에서 위쪽 달을 ${monthLabel}로 맞추고 ‘공단 ➔ 케어포 근무내용 연동 (엑셀파일)’을 눌러 방금 받은 파일을 고르세요.`}
                  container="section"
                />
                <Banner
                  status="warning"
                  title={`올리면 이 ${result.staff.length}명의 ${monthLabel} 근무일정이 파일 내용으로 바뀝니다`}
                  description="케어포에 이미 넣어 둔 그 달 일정은 지워지고 다시 써집니다. 파일에 없는 직원의 일정은 그대로입니다."
                  container="section"
                />
              </VStack>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="between" vAlign="center">
              {step === 'select' ? (
                <Button
                  label={isPlainExporting ? '내보내는 중...' : '근무·휴무만 담은 엑셀'}
                  variant="ghost"
                  size="sm"
                  isLoading={isPlainExporting}
                  isDisabled={isPlainExporting}
                  onClick={onPlainExport}
                />
              ) : <span />}
              <HStack gap={2} hAlign="end">
                {step === 'select' && <Button label="닫기" variant="secondary" onClick={close} />}
                {step === 'preview' && (
                  <>
                    <Button label="다른 파일 선택" variant="secondary" onClick={reset} />
                    <Button
                      label={isSaving ? '만드는 중...' : `${month + 1}월 케어포용 엑셀 받기`}
                      variant="primary"
                      isLoading={isSaving}
                      isDisabled={!result || result.staff.length === 0 || isSaving}
                      onClick={handleDownload}
                    />
                  </>
                )}
                {step === 'done' && <Button label="닫기" variant="primary" onClick={close} />}
              </HStack>
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
