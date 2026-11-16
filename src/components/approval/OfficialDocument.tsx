'use client';

import React, { Fragment, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/theme/springs';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiPrinter } from 'react-icons/fi';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { ApprovalRequest, ApprovalStep, DocumentFooter } from '@/types/approval';
import { FormSchema, FormFieldSchema } from '@/types/formSchema';
import { chunkRowForDocTable, docRowColumnTemplate, formatFieldValueText, groupFieldsIntoRows, resolveFieldValue } from './formValueFormat';
import { getFieldSpan } from '@/lib/formSchemaLogic';
import { getFieldLabel, getValueLabel, sortFormEntries } from '@/lib/formFieldLabels';
import { isGeneratedFieldId, orphanEntries } from '@/lib/retiredFields';
import ApprovalImageValue from './ApprovalImageValue';
import SignatureImage from './SignatureImage';
import { printDocumentElement } from './printDocument';

interface OfficialDocumentProps {
  approval: ApprovalRequest;
  schema?: FormSchema;
  companyName: string;
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

function formatDateFull(value?: string): string {
  if (!value) return '-';
  try {
    return format(new Date(value), 'yyyy년 MM월 dd일', { locale: ko });
  } catch {
    return '-';
  }
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
    // <table>은 열 폭을 모든 행이 공유해 행마다 다른 너비 비율을 표현할 수 없다 —
    // 작성 화면(FormRenderer)과 동일하게 행 독립 grid로 그려 양식의 너비 설정을 반영한다.
    <div className="carev-doc-fields">
      {rows.map((row, rowIndex) => {
        if (row.length === 1 && row[0].type === 'section') {
          return (
            <div key={`section-${rowIndex}`} className="carev-doc-field-row" style={{ gridTemplateColumns: '1fr' }}>
              <div className="carev-doc-section-row">{row[0].label}</div>
            </div>
          );
        }

        // 한 줄에 들어온 필드를 그대로 편다 — 1/3 셋, 1/4 넷도 한 줄에 놓인다
        return (
          <div
            key={`row-${rowIndex}`}
            className="carev-doc-field-row"
            style={{ gridTemplateColumns: docRowColumnTemplate(row) }}
          >
            {row.map((field) => (
              <Fragment key={field.id}>
                <div className="carev-doc-field-label">{field.label}</div>
                <div className="carev-doc-field-value">
                  {field.type === 'image' ? (
                    (() => {
                      const imageValue = resolveFieldValue(field, formData) as { fileUrl?: string; fileName?: string } | undefined;
                      return <ApprovalImageValue fileUrl={imageValue?.fileUrl} fileName={imageValue?.fileName} />;
                    })()
                  ) : (
                    formatFieldValueText(field, formData)
                  )}
                </div>
              </Fragment>
            ))}
          </div>
        );
      })}
      <OrphanFieldRows schema={schema} formData={formData} />
    </div>
  );
}

/**
 * 지금 양식에 없는 항목에 써 둔 내용 — 양식을 고친 뒤 지난 문서를 열어도 쓴 것이 다 보이게 맨 아래에 붙인다.
 * (2026-11-16 업무일지: 원래 항목을 지운 뒤 지난 문서 본문이 화면에서 사라졌다 — src/lib/retiredFields.ts)
 */
function OrphanFieldRows({ schema, formData }: { schema: FormSchema; formData: Record<string, any> }) {
  const orphans = orphanEntries(schema, formData);
  if (orphans.length === 0) return null;
  const single = docRowColumnTemplate([{ id: '', type: 'text', label: '', required: false, width: 'full' }]);
  return (
    <>
      <div className="carev-doc-field-row" style={{ gridTemplateColumns: '1fr' }}>
        <div className="carev-doc-section-row">이전 양식 항목</div>
      </div>
      {orphans.map(({ key, field }) => {
        const label = field?.label || (isGeneratedFieldId(key) ? '이전 항목' : getFieldLabel(key));
        const raw = formData[key];
        return (
          <div key={`orphan-${key}`} className="carev-doc-field-row" style={{ gridTemplateColumns: single }}>
            <div className="carev-doc-field-label">{label}</div>
            <div className="carev-doc-field-value">
              {field?.type === 'image' ? (
                <ApprovalImageValue fileUrl={raw?.fileUrl} fileName={raw?.fileName} />
              ) : field ? (
                formatFieldValueText(field, formData)
              ) : raw && typeof raw === 'object' && !Array.isArray(raw) && (raw.fileName || raw.name) ? (
                String(raw.fileName || raw.name)
              ) : (
                getValueLabel(key, raw)
              )}
            </div>
          </div>
        );
      })}
    </>
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

function formatDateDotted(value?: string): string {
  if (!value) return '';
  try {
    return format(new Date(value), 'yyyy . MM. dd.', { locale: ko });
  } catch {
    return '';
  }
}

/**
 * 공문 하단 발신부.
 *
 * 표준 시행문 형식을 따른다 — 시행/접수 한 줄, 우편번호·주소와 홈페이지 한 줄,
 * 전화·전송·담당자 메일과 공개구분 한 줄. 담당·대표 줄은 위 결재란과 겹쳐서 넣지 않는다.
 * 기관 정보가 하나도 없으면 가로줄만 남아 어색하므로 통째로 감춘다.
 */
function DocumentFooterBlock({
  footer,
  docNumber,
  receivedAt,
}: {
  footer?: DocumentFooter;
  docNumber?: string;
  receivedAt?: string;
}) {
  const hasCompanyInfo = Boolean(
    footer &&
      (footer.postalCode ||
        footer.address ||
        footer.homepageUrl ||
        footer.phoneNumber ||
        footer.faxNumber ||
        footer.contactEmail),
  );
  if (!hasCompanyInfo && !docNumber) return null;

  const addressLine = [footer?.postalCode, footer?.address].filter(Boolean).join('  ');
  const contacts = [
    footer?.phoneNumber ? `전화  ${footer.phoneNumber}` : '',
    footer?.faxNumber ? `전송  ${footer.faxNumber}` : '',
  ].filter(Boolean).join('  ');

  return (
    <div className="carev-doc-footer">
      <div className="carev-doc-footer-rule" />

      {(docNumber || receivedAt) && (
        <div className="carev-doc-footer-row">
          <span className="carev-doc-footer-term">시행</span>
          <span className="carev-doc-footer-val">{docNumber || ''}</span>
          <span className="carev-doc-footer-term">접수</span>
          <span className="carev-doc-footer-val">{formatDateDotted(receivedAt)}</span>
        </div>
      )}

      {(addressLine || footer?.homepageUrl) && (
        <div className="carev-doc-footer-line">
          {addressLine && (
            <>
              <span className="carev-doc-footer-term">우</span>
              <span>{addressLine}</span>
            </>
          )}
          {footer?.homepageUrl && <span className="carev-doc-footer-sep">/ {footer.homepageUrl}</span>}
        </div>
      )}

      {(contacts || footer?.contactEmail) && (
        <div className="carev-doc-footer-line">
          {contacts && <span>{contacts}</span>}
          {footer?.contactEmail && <span>, 담당자 E-MAIL : {footer.contactEmail}</span>}
          <span className="carev-doc-footer-sep">/ {footer?.disclosureType || '공개'}</span>
        </div>
      )}
    </div>
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
  onOpenAttachment,
  showPrintButton = true,
}: OfficialDocumentProps) {
  const pageRef = useRef<HTMLDivElement>(null);

  const boxes = buildApprovalBoxes(approval);

  // 결재란 칸이 이 화면을 보는 동안 '결재중'→승인으로 바뀌면 그 칸에 도장을 찍는다(2026-11-16).
  // 문서를 처음 열 때 이미 승인된 칸은 그냥 그린다 — 열 때마다 도장이 튀면 소음이다.
  const seenStatuses = useRef<string[] | null>(null);
  const previous = seenStatuses.current;
  const justSigned = boxes.map(
    (box, index) => !!previous && previous[index] !== undefined && previous[index] !== 'APPROVED' && box.status === 'APPROVED',
  );
  useEffect(() => {
    seenStatuses.current = boxes.map((box) => box.status);
  });
  const hasFormData = approval.formData && Object.keys(approval.formData).length > 0;
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
                {/* 스크린리더가 헤더-셀 관계를 알 수 있도록 scope 지정 — 시각적 모양은 변화 없음 */}
                {boxes.map((box, index) => (
                  <th key={index} scope="col">{box.label}</th>
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
                      // 서명 파일을 못 불러오면 서명 없이 승인했을 때와 같은 글자로(2026-11-16 숲속 원장 서명 깨짐)
                      <StampIn active={justSigned[index]}>
                        <SignatureImage
                          src={box.signatureUrl}
                          name={box.name}
                          fallback={box.label === '기안' ? box.name : `${box.name} (인)`}
                          className="carev-doc-signature-img"
                        />
                      </StampIn>
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

        {/*
          발신명의 — 표준 공문 관례대로 기관명을 가운데 두고 그 끝에 관인을 겹쳐 찍는다.
          직인은 최종 승인된 문서에만 내려오므로(companySealUrl) 결재 전에는 기관명만 남는다.
          앱(official_document_view.dart)의 발신명의 블록과 같은 구성이다.
        */}
        <div className="carev-doc-issuer">
          {/* 도장은 기관명 span 안에 둔다 — 바깥에 두면 컨테이너(전체 폭) 기준으로 붙어
              가운데 정렬된 기관명과 상관없이 문서 오른쪽 끝에 떠 버린다 */}
          <span className="carev-doc-issuer-name">
            {companyName}
            {isApproved && approval.companySealUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={approval.companySealUrl}
                alt="기관 직인"
                className="carev-doc-seal"
              />
            )}
          </span>
        </div>

        {/* 발신부 — 표준 공문 하단 시행/접수·주소·연락처 줄 */}
        <DocumentFooterBlock
          footer={approval.documentFooter}
          docNumber={approval.docNumberDisplay || approval.docNumber}
          receivedAt={isApproved ? approval.processedAt : undefined}
        />
      </div>
    </div>
  );
}

/**
 * 방금 승인한 칸의 서명 — 위에서 눌러 찍듯 내려앉고, 옅은 인주 자국이 번졌다 사라진다(2026-11-16 '도장').
 * 결재 문화의 도장·서명을 그대로 빌렸다. 처음부터 승인돼 있던 칸은 움직이지 않는다([active] 거짓).
 * 동작 줄이기를 켠 사람에게는 MotionConfig가 크기·회전을 빼고 나타나기만 한다.
 */
function StampIn({ active, children }: { active: boolean; children: React.ReactNode }) {
  // 서명이 칸에 처음 나타난 순간에만 정한다 — 그 뒤 다시 그려져도 같은 모양을 유지해 그림이 새로 뜨지 않게
  const [stamped] = useState(active);
  return (
    <span className="carev-doc-stamp">
      {stamped && (
        <motion.span
          aria-hidden
          className="carev-doc-stamp-ink"
          initial={{ scale: 0.5, opacity: 0.45 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
        />
      )}
      <motion.span
        style={{ display: 'inline-flex' }}
        initial={stamped ? { scale: 1.9, rotate: -12, opacity: 0 } : false}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        // 크기·기울기는 스프링(눌렸다 서는 느낌), 나타남은 짧게 — 투명도까지 스프링이면 늦게 뜨고 깜빡인다
        transition={{ ...spring.stamp, opacity: { duration: 0.12, ease: 'easeOut' } }}
      >
        {children}
      </motion.span>
    </span>
  );
}
