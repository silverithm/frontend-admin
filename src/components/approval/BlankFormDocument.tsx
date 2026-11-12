'use client';

import React, { Fragment } from 'react';
import { FormSchema } from '@/types/formSchema';
import { BlankCell, blankCellFor, blankRowTracks } from '@/lib/blankForm';
import { docRowColumnTemplate, groupFieldsIntoRows } from './formValueFormat';

interface BlankFormDocumentProps {
  /** 양식 이름 — 종이 서식의 제목이 된다 */
  title: string;
  schema: FormSchema;
  companyName: string;
  /** 결재란 머리 (기안·검토·결재) */
  approvalHeaders: string[];
  /**
   * 기관 직인 — 넘기면 종이 아래에 발신명의(기관명)를 두고 그 끝에 직인을 찍는다.
   * 전자결재에서는 최종 승인 때만 찍히는 도장이라, 찍을지는 인쇄하는 사람이 고른다(관리자만).
   */
  sealUrl?: string | null;
  /** 종이가 남을 때 반복 항목 표에 더 그릴 줄 수 — 인쇄 직전에 재서 정한다(useBlankFormPrint) */
  extraTableLines?: number;
  pageRef?: React.Ref<HTMLDivElement>;
}

/** '　　년　　월　　일' — 손으로 숫자를 써넣을 자리 */
function BlankDate() {
  return (
    <span className="carev-doc-blank-date">
      <span>년</span>
      <span>월</span>
      <span>일</span>
    </span>
  );
}

function BlankValue({ cell }: { cell: BlankCell }) {
  switch (cell.kind) {
    case 'box':
      return <div className="carev-doc-blank-box" style={{ minHeight: `${cell.lines * 22}px` }} />;
    case 'date':
      return <BlankDate />;
    case 'dateRange':
      return (
        <span className="carev-doc-blank-range">
          <BlankDate />
          <span className="carev-doc-blank-tilde">~</span>
          <BlankDate />
        </span>
      );
    case 'choices':
      return (
        <span className="carev-doc-blank-choices">
          {cell.options.map((option, index) => (
            <span key={`${option}-${index}`} className="carev-doc-blank-choice">{option}</span>
          ))}
        </span>
      );
    case 'unit':
      return <span className="carev-doc-blank-unit">{cell.unit}</span>;
    case 'table':
      return (
        <table className="carev-doc-blank-table">
          <thead>
            <tr>
              <th scope="col" className="carev-doc-blank-table-no">번호</th>
              {cell.columns.map((column, index) => (
                <th key={`${column}-${index}`} scope="col">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: cell.rows }, (_, row) => (
              <tr key={row}>
                <td className="carev-doc-blank-table-no">{row + 1}</td>
                {cell.columns.map((column, index) => (
                  <td key={`${column}-${index}`} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    default:
      return null;
  }
}

/**
 * 손으로 채우는 빈 서식 — 제출된 기안과 같은 공문 틀(carev-doc-*)에 값 대신 쓸 자리를 그린다.
 * 같은 틀이라 종이에 쓴 서식과 전자결재로 올린 문서가 같은 칸 배치로 나란히 보관된다.
 */
export default function BlankFormDocument({ title, schema, companyName, approvalHeaders, sealUrl, extraTableLines = 0, pageRef }: BlankFormDocumentProps) {
  const rows = groupFieldsIntoRows(schema.fields);
  // 한 장에 들어가는 서식(carev-doc-page--fit)에서만 쓰이는 줄 트랙 — 남는 종이를 쓰는 칸이 나눠 갖는다
  const fieldsStyle = { '--carev-blank-rows': blankRowTracks(rows, extraTableLines) } as React.CSSProperties;

  return (
    <div ref={pageRef} className="carev-doc-page carev-doc-page--blank">
      <div className="carev-doc-letterhead">{companyName}</div>

      <div className="carev-doc-topbar">
        <div className="carev-doc-meta">
          <div>문서번호 :</div>
          <div>기안일자 : <BlankDate /></div>
          <div>시행일자 : <BlankDate /></div>
        </div>

        <table className="carev-doc-approval-table">
          <thead>
            <tr>
              {approvalHeaders.map((label, index) => (
                <th key={index} scope="col">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {approvalHeaders.map((_, index) => (
                <td key={index} className="carev-doc-approval-cell" />
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="carev-doc-title">{title}</div>

      <div className="carev-doc-fields" style={fieldsStyle}>
        {rows.map((row, rowIndex) => {
          if (row.length === 1 && row[0].type === 'section') {
            return (
              <div key={`section-${rowIndex}`} className="carev-doc-field-row" style={{ gridTemplateColumns: '1fr' }}>
                <div className="carev-doc-section-row">{row[0].label}</div>
              </div>
            );
          }
          return (
            <div
              key={`row-${rowIndex}`}
              className="carev-doc-field-row"
              style={{ gridTemplateColumns: docRowColumnTemplate(row) }}
            >
              {/* 복제한 칸('… 사본')은 id가 같을 수 있어 자리 번호를 같이 쓴다 */}
              {row.map((field, index) => (
                <Fragment key={`${field.id}-${index}`}>
                  <div className="carev-doc-field-label">{field.label}</div>
                  <div className="carev-doc-field-value">
                    <BlankValue cell={blankCellFor(field, extraTableLines)} />
                  </div>
                </Fragment>
              ))}
            </div>
          );
        })}
      </div>
      {/* 발신명의(아래 기관명·직인)는 직인을 찍어 달라고 한 때만 넣는다 — 기관명은 맨 위에 이미 있고,
          늘 넣으면 칸이 꽉 찬 서식에서 기관명만 다음 장으로 넘어간다.
          모양은 결재 문서(OfficialDocument)의 발신명의와 같다: 기관명 끝 글자에 직인이 겹친다. */}
      {sealUrl && (
        <div className="carev-doc-issuer">
          <span className="carev-doc-issuer-name">
            {companyName}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sealUrl} alt="기관 직인" className="carev-doc-seal" />
          </span>
        </div>
      )}
    </div>
  );
}
