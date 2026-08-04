'use client';

import React, { useRef } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiPrinter } from 'react-icons/fi';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { ApprovalRequest, ApprovalStep } from '@/types/approval';
import { FormSchema, FormFieldSchema } from '@/types/formSchema';
import { chunkRowForDocTable, formatFieldValueText, groupFieldsIntoRows } from './formValueFormat';
import { getFieldLabel, getValueLabel, sortFormEntries } from '@/lib/formFieldLabels';

interface OfficialDocumentProps {
  approval: ApprovalRequest;
  schema?: FormSchema;
  companyName: string;
  companySealUrl?: string;
  /** 첨부 열람 버튼 클릭 (없으면 버튼 미노출) */
  onOpenAttachment?: () => void;
  /** 인쇄 버튼 노출 여부 (기본 true) */
  showPrintButton?: boolean;
}

// 결재란 셀 (기안자 + 결재선 합성)
interface ApprovalBoxCell {
  label: string;              // 기안 | 검토 | 결재
  name: string;
  signatureUrl?: string;
  processedAt?: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'WAITING' | 'SKIPPED';
}

function stepRoleText(step: ApprovalStep): string {
  return step.roleLabel === 'FINAL' ? '결재' : '검토';
}

/** 결재란에 표시할 셀 목록 합성: 첫 칸은 항상 기안자, 이후 결재선(없으면 legacy 처리자) */
function buildApprovalBoxes(approval: ApprovalRequest): ApprovalBoxCell[] {
  const boxes: ApprovalBoxCell[] = [
    {
      label: '기안',
      name: approval.requesterName,
      processedAt: approval.createdAt,
      status: 'APPROVED',
    },
  ];

  if (approval.approvalLine && approval.approvalLine.length > 0) {
    const currentPending = approval.approvalLine.find((s) => s.status === 'PENDING');
    for (const step of approval.approvalLine) {
      boxes.push({
        label: stepRoleText(step),
        name: step.approverName,
        signatureUrl: step.signatureUrl,
        processedAt: step.processedAt,
        status:
          step.status === 'APPROVED' ? 'APPROVED'
          : step.status === 'REJECTED' ? 'REJECTED'
          : step.status === 'SKIPPED' ? 'SKIPPED'
          : currentPending && step.stepOrder === currentPending.stepOrder ? 'PENDING'
          : 'WAITING',
      });
    }
    return boxes;
  }

  // legacy(결재선 없음): 처리 결과 한 칸
  boxes.push({
    label: '결재',
    name: approval.processedByName || '',
    processedAt: approval.processedAt,
    status:
      approval.status === 'APPROVED' ? 'APPROVED'
      : approval.status === 'REJECTED' ? 'REJECTED'
      : 'PENDING',
  });

  return boxes;
}

function formatDateShort(value?: string): string {
  if (!value) return '';
  try {
    return format(new Date(value), 'yy.MM.dd', { locale: ko });
  } catch {
    return '';
  }
}

function formatDateFull(value?: string): string {
  if (!value) return '-';
  try {
    return format(new Date(value), 'yyyy년 MM월 dd일', { locale: ko });
  } catch {
    return '-';
  }
}

/** 문서를 숨은 iframe으로 복제해 인쇄 (모달/오버레이 환경에서도 안전) */
function printDocumentElement(element: HTMLElement) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }

  const headHtml = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((node) => node.outerHTML)
    .join('');

  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>전자결재 인쇄</title>${headHtml}</head>` +
    `<body style="background:#fff">${element.outerHTML}</body></html>`,
  );
  doc.close();

  // 스타일시트 로드 대기 후 인쇄
  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    }
  }, 350);
}

/** 폼 데이터 본문을 공문 표로 렌더 */
function DocumentFieldsTable({
  schema,
  formData,
}: {
  schema: FormSchema;
  formData: Record<string, any>;
}) {
  // 3필드 이상 묶인 행은 2개씩 쪼갠다 — 표는 한 행에 최대 2필드(4셀)라 그대로 두면 유실된다
  const rows = groupFieldsIntoRows(schema.fields).flatMap(chunkRowForDocTable);

  return (
    <table className="carev-doc-fields-table">
      <tbody>
        {rows.map((row, rowIndex) => {
          if (row.length === 1 && row[0].type === 'section') {
            return (
              <tr key={`section-${rowIndex}`}>
                <td className="carev-doc-section-row" colSpan={4}>
                  {row[0].label}
                </td>
              </tr>
            );
          }

          if (row.length === 2) {
            return (
              <tr key={`row-${rowIndex}`}>
                <td className="carev-doc-field-label">{row[0].label}</td>
                <td className="carev-doc-field-value" style={{ width: '32%' }}>
                  {formatFieldValueText(row[0], formData)}
                </td>
                <td className="carev-doc-field-label">{row[1].label}</td>
                <td className="carev-doc-field-value" style={{ width: '32%' }}>
                  {formatFieldValueText(row[1], formData)}
                </td>
              </tr>
            );
          }

          const field = row[0] as FormFieldSchema;
          return (
            <tr key={`row-${rowIndex}`}>
              <td className="carev-doc-field-label">{field.label}</td>
              <td className="carev-doc-field-value" colSpan={3}>
                {formatFieldValueText(field, formData)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** 스키마 없이 저장된 formData 표시 (양식 삭제 등 fallback) */
function DocumentFallbackTable({ formData }: { formData: Record<string, any> }) {
  return (
    <table className="carev-doc-fields-table">
      <tbody>
        {sortFormEntries(formData).map(([key, value]) => (
          <tr key={key}>
            <td className="carev-doc-field-label">{getFieldLabel(key)}</td>
            <td className="carev-doc-field-value" colSpan={3}>
              {getValueLabel(key, value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * 표준 기안문 형태의 공문 렌더러.
 * A4 고정 레이아웃(bespoke) — Astryx 컴포넌트 조합이 아닌 순수 div + carev-doc-* 클래스.
 */
export default function OfficialDocument({
  approval,
  schema,
  companyName,
  companySealUrl,
  onOpenAttachment,
  showPrintButton = true,
}: OfficialDocumentProps) {
  const pageRef = useRef<HTMLDivElement>(null);

  const boxes = buildApprovalBoxes(approval);
  const hasFormData = approval.formData && Object.keys(approval.formData).length > 0;
  const sealUrl = companySealUrl || approval.companySealUrl;
  const isApproved = approval.status === 'APPROVED';
  const isRejected = approval.status === 'REJECTED';

  const handlePrint = () => {
    if (pageRef.current) {
      printDocumentElement(pageRef.current);
    }
  };

  return (
    <div>
      {showPrintButton && (
        <HStack hAlign="end" className="carev-doc-noprint" style={{ marginBottom: 'var(--spacing-2)' }}>
          <Button
            label="인쇄"
            variant="secondary"
            size="sm"
            icon={<FiPrinter />}
            onClick={handlePrint}
          />
        </HStack>
      )}

      <div ref={pageRef} className="carev-doc-page">
        {/* 레터헤드 */}
        <div className="carev-doc-letterhead">{companyName}</div>

        {/* 문서정보 + 결재란 */}
        <div className="carev-doc-topbar">
          <div className="carev-doc-meta">
            <div>문서번호 : {approval.docNumberDisplay || approval.docNumber || '-'}</div>
            <div>기안일자 : {formatDateFull(approval.createdAt)}</div>
            <div>시행일자 : {isApproved ? formatDateFull(approval.processedAt) : '-'}</div>
          </div>

          <table className="carev-doc-approval-table">
            <thead>
              <tr>
                {boxes.map((box, index) => (
                  <th key={index}>{box.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {boxes.map((box, index) => (
                  <td
                    key={index}
                    className={`carev-doc-approval-cell${box.status === 'REJECTED' ? ' carev-doc-approval-cell--rejected' : ''}`}
                  >
                    {box.status === 'REJECTED' ? (
                      '반려'
                    ) : box.signatureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={box.signatureUrl}
                        alt={`${box.name} 서명`}
                        className="carev-doc-signature-img"
                      />
                    ) : box.status === 'APPROVED' && box.name ? (
                      box.label === '기안' ? box.name : `${box.name} (인)`
                    ) : box.status === 'SKIPPED' ? (
                      // 관리자 직권 승인(전결)으로 건너뛴 단계
                      '전결'
                    ) : box.status === 'PENDING' ? (
                      '결재중'
                    ) : (
                      ''
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                {boxes.map((box, index) => (
                  <td key={index} className="carev-doc-approval-name">
                    {box.name || '-'}
                    <br />
                    {box.status === 'APPROVED' || box.status === 'REJECTED'
                      ? formatDateShort(box.processedAt)
                      : ''}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* 제목 */}
        <div className="carev-doc-title">{approval.title}</div>

        {/* 반려 사유 */}
        {isRejected && approval.rejectReason && (
          <div className="carev-doc-reject-banner">반려 사유: {approval.rejectReason}</div>
        )}

        {/* 본문 */}
        {hasFormData ? (
          schema ? (
            <DocumentFieldsTable schema={schema} formData={approval.formData} />
          ) : (
            <DocumentFallbackTable formData={approval.formData} />
          )
        ) : (
          <div className="carev-doc-body-note">
            위 건에 대하여 붙임과 같이 기안하오니 결재하여 주시기 바랍니다.
            <br />
            (본문: 별첨 문서 참조)
          </div>
        )}

        {/* 발신명의 + 직인 */}
        <div className="carev-doc-sender">
          <span className="carev-doc-sender-name-wrap">
            <span className="carev-doc-sender-name">{companyName}</span>
            {isApproved && sealUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sealUrl} alt="기관 직인" className="carev-doc-seal-img" />
            )}
          </span>
        </div>

        {/* 붙임 */}
        {approval.attachmentFileName && (
          <div className="carev-doc-attachments">
            <HStack gap={2} vAlign="center">
              <span>붙임 : {approval.attachmentFileName} 1부. 끝.</span>
              {onOpenAttachment && (
                <span className="carev-doc-noprint">
                  <Button label="열람" variant="ghost" size="sm" onClick={onOpenAttachment} />
                </span>
              )}
            </HStack>
          </div>
        )}
      </div>
    </div>
  );
}
